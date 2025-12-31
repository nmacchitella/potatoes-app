from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from pydantic import BaseModel
from database import get_db
from config import settings
import auth
import models
import httpx
from datetime import timedelta


class GoogleMobileTokenRequest(BaseModel):
    access_token: str

router = APIRouter(prefix="/auth/google", tags=["google-auth"])

# Initialize OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)


@router.get("/login")
async def google_login():
    """Initiate Google OAuth flow"""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured"
        )

    redirect_uri = f"{settings.backend_url}/api/auth/google/callback"
    authorization_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.google_client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile&"
        f"access_type=offline"
    )

    return {"authorization_url": authorization_url}


@router.get("/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """Handle Google OAuth callback"""
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No authorization code provided"
        )

    try:
        token_url = "https://oauth2.googleapis.com/token"
        redirect_uri = f"{settings.backend_url}/api/auth/google/callback"

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                token_url,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                }
            )

            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to exchange code for token"
                )

            tokens = token_response.json()
            access_token = tokens.get("access_token")

            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if userinfo_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user info from Google"
                )

            user_info = userinfo_response.json()

            email = user_info.get("email")
            name = user_info.get("name", email.split("@")[0])
            google_id = user_info.get("id")

            db_user = db.query(models.User).filter(models.User.email == email).first()

            if db_user:
                if not db_user.oauth_provider:
                    db_user.oauth_provider = "google"
                    db_user.oauth_id = google_id
                if not db_user.is_verified:
                    db_user.is_verified = True
                db.commit()
                db.refresh(db_user)
            else:
                db_user = models.User(
                    email=email,
                    name=name,
                    hashed_password=None,
                    oauth_provider="google",
                    oauth_id=google_id,
                    is_verified=True
                )
                db.add(db_user)
                db.commit()
                db.refresh(db_user)

            tokens = auth.create_token_pair(db_user, db)

            frontend_redirect = f"{settings.frontend_url}/auth/callback?token={tokens['access_token']}&refresh_token={tokens['refresh_token']}"
            return RedirectResponse(url=frontend_redirect)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth callback failed: {str(e)}"
        )


@router.post("/mobile")
async def google_mobile_auth(
    token_request: GoogleMobileTokenRequest,
    db: Session = Depends(get_db)
):
    """Handle Google OAuth from mobile apps using native Google Sign-In"""
    try:
        async with httpx.AsyncClient() as client:
            # Validate the access token with Google
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {token_request.access_token}"}
            )

            if userinfo_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google access token"
                )

            user_info = userinfo_response.json()

            email = user_info.get("email")
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email not provided by Google"
                )

            name = user_info.get("name", email.split("@")[0])
            google_id = user_info.get("id")

            # Find or create user
            db_user = db.query(models.User).filter(models.User.email == email).first()

            if db_user:
                if not db_user.oauth_provider:
                    db_user.oauth_provider = "google"
                    db_user.oauth_id = google_id
                if not db_user.is_verified:
                    db_user.is_verified = True
                db.commit()
                db.refresh(db_user)
            else:
                db_user = models.User(
                    email=email,
                    name=name,
                    hashed_password=None,
                    oauth_provider="google",
                    oauth_id=google_id,
                    is_verified=True
                )
                db.add(db_user)
                db.commit()
                db.refresh(db_user)

            # Return tokens
            return auth.create_token_pair(db_user, db)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mobile authentication failed: {str(e)}"
        )
