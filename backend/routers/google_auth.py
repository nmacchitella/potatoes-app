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
import secrets
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class GoogleMobileTokenRequest(BaseModel):
    access_token: str


class OAuthCodeExchangeRequest(BaseModel):
    code: str


# In-memory store for OAuth codes (in production, use Redis or database)
# Format: {code: {"tokens": {...}, "expires_at": datetime}}
_oauth_code_store: dict = {}

router = APIRouter(prefix="/auth/google", tags=["google-auth"])


def _find_or_create_google_user(db: Session, email: str, name: str, google_id: str) -> models.User:
    """Find existing user or create a new one from Google OAuth data.

    Handles linking OAuth to existing accounts and creating default resources.
    Uses a single transaction for atomicity.
    """
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
        db.flush()  # Get user ID without committing

        # Create default grocery list in the same transaction
        default_grocery_list = models.GroceryList(
            user_id=db_user.id,
            name="My Grocery List"
        )
        db.add(default_grocery_list)
        db.commit()
        db.refresh(db_user)

    return db_user


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


def _cleanup_expired_codes():
    """Remove expired OAuth codes from memory"""
    now = datetime.now(timezone.utc)
    expired = [code for code, data in _oauth_code_store.items() if data["expires_at"] < now]
    for code in expired:
        del _oauth_code_store[code]


def _create_oauth_code(tokens: dict) -> str:
    """Create a short-lived code that can be exchanged for tokens"""
    _cleanup_expired_codes()
    code = secrets.token_urlsafe(32)
    _oauth_code_store[code] = {
        "tokens": tokens,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    return code


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
                logger.warning(f"Failed to exchange Google OAuth code: {token_response.status_code}")
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
                logger.warning(f"Failed to get Google user info: {userinfo_response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user info from Google"
                )

            user_info = userinfo_response.json()

            email = user_info.get("email")
            # Validate email exists before using it
            if not email:
                logger.error("Google OAuth: No email provided in user info")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email not provided by Google. Please ensure your Google account has an email."
                )

            name = user_info.get("name", email.split("@")[0])
            google_id = user_info.get("id")

            db_user = _find_or_create_google_user(db, email, name, google_id)
            jwt_tokens = auth.create_token_pair(db_user, db)

            # Create a short-lived code instead of putting tokens in URL
            oauth_code = _create_oauth_code(jwt_tokens)

            frontend_redirect = f"{settings.frontend_url}/auth/callback?code={oauth_code}"
            return RedirectResponse(url=frontend_redirect)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("OAuth callback failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed. Please try again."
        )


@router.post("/exchange")
async def exchange_oauth_code(request: OAuthCodeExchangeRequest):
    """Exchange a short-lived OAuth code for JWT tokens.

    This endpoint is called by the frontend after OAuth redirect to securely
    retrieve the tokens without exposing them in the URL.
    """
    _cleanup_expired_codes()

    code_data = _oauth_code_store.pop(request.code, None)
    if not code_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code"
        )

    if code_data["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code has expired"
        )

    return code_data["tokens"]


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

            db_user = _find_or_create_google_user(db, email, name, google_id)
            return auth.create_token_pair(db_user, db)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Mobile authentication failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed. Please try again."
        )
