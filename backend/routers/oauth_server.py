"""
OAuth 2.1 Authorization Server for MCP (claude.ai custom connectors).

Endpoints:
- /.well-known/oauth-protected-resource  (RFC 9728)
- /.well-known/oauth-authorization-server (RFC 8414)
- /oauth/authorize                        (Authorization endpoint)
- /oauth/google-callback                  (Google OAuth callback for MCP flow)
- /oauth/token                            (Token endpoint)
"""

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
import httpx

from database import get_db
from config import settings, logger
import auth
import models

router = APIRouter(tags=["oauth-server"])


# ---------------------------------------------------------------------------
# Well-Known Metadata
# ---------------------------------------------------------------------------

@router.get("/.well-known/oauth-protected-resource")
async def protected_resource_metadata():
    """RFC 9728 — Protected Resource Metadata."""
    resource = f"{settings.backend_url}/mcp"
    return {
        "resource": resource,
        "authorization_servers": [settings.backend_url],
        "bearer_methods_supported": ["header"],
    }


@router.get("/.well-known/oauth-authorization-server")
async def authorization_server_metadata():
    """RFC 8414 — Authorization Server Metadata."""
    return {
        "issuer": settings.backend_url,
        "authorization_endpoint": f"{settings.backend_url}/oauth/authorize",
        "token_endpoint": f"{settings.backend_url}/oauth/token",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
        "scopes_supported": ["openid", "profile"],
    }


# ---------------------------------------------------------------------------
# Authorization Endpoint
# ---------------------------------------------------------------------------

@router.get("/oauth/authorize")
async def oauth_authorize(
    request: Request,
    response_type: str,
    client_id: str,
    redirect_uri: str,
    state: str,
    code_challenge: str,
    code_challenge_method: str = "S256",
    scope: str = "",
    resource: str = "",
):
    """OAuth 2.1 Authorization Endpoint. Redirects user to Google for login."""
    if not settings.mcp_oauth_client_id:
        raise HTTPException(501, "OAuth not configured")

    if client_id != settings.mcp_oauth_client_id:
        raise HTTPException(400, "Invalid client_id")

    if response_type != "code":
        raise HTTPException(400, "Only response_type=code is supported")

    if code_challenge_method != "S256":
        raise HTTPException(400, "Only S256 code_challenge_method is supported")

    # Validate redirect_uri
    allowed_redirects = [
        "https://claude.ai/api/mcp/auth_callback",
        "https://claude.com/api/mcp/auth_callback",
    ]
    if redirect_uri not in allowed_redirects:
        raise HTTPException(400, "Invalid redirect_uri")

    # Validate resource parameter if provided
    expected_resource = f"{settings.backend_url}/mcp"
    if resource and resource != expected_resource:
        raise HTTPException(400, "Invalid resource parameter")

    # Store OAuth params in session for the Google callback
    request.session["oauth_state"] = state
    request.session["oauth_redirect_uri"] = redirect_uri
    request.session["oauth_code_challenge"] = code_challenge
    request.session["oauth_code_challenge_method"] = code_challenge_method
    request.session["oauth_client_id"] = client_id
    request.session["oauth_scope"] = scope

    # Redirect to Google OAuth
    google_redirect_uri = f"{settings.backend_url}/oauth/google-callback"
    params = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    })
    return RedirectResponse(url=f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


# ---------------------------------------------------------------------------
# Google OAuth Callback (MCP flow)
# ---------------------------------------------------------------------------

@router.get("/oauth/google-callback")
async def oauth_google_callback(
    request: Request,
    code: str,
    db: Session = Depends(get_db),
):
    """Google OAuth callback for the MCP authorization flow."""
    # Retrieve stored OAuth params
    oauth_state = request.session.get("oauth_state")
    redirect_uri = request.session.get("oauth_redirect_uri")
    code_challenge = request.session.get("oauth_code_challenge")
    code_challenge_method = request.session.get("oauth_code_challenge_method")
    client_id = request.session.get("oauth_client_id")
    scope = request.session.get("oauth_scope", "")

    if not oauth_state or not redirect_uri or not code_challenge:
        raise HTTPException(400, "Missing OAuth session data. Please restart the flow.")

    # Exchange Google code for tokens
    google_redirect_uri = f"{settings.backend_url}/oauth/google-callback"
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_response.status_code != 200:
            logger.error(f"Google token exchange failed: {token_response.text}")
            raise HTTPException(400, "Failed to exchange Google code for token")

        access_token = token_response.json()["access_token"]

        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(400, "Failed to get user info from Google")

        user_info = userinfo_response.json()

    # Get or create user
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
            is_verified=True,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

    # Clean up expired authorization codes (best-effort, don't block the flow)
    try:
        db.query(models.OAuthAuthorizationCode).filter(
            models.OAuthAuthorizationCode.expires_at <= datetime.now(timezone.utc)
        ).delete()
        db.commit()
    except Exception:
        db.rollback()

    # Generate authorization code
    auth_code = secrets.token_urlsafe(40)
    db_code = models.OAuthAuthorizationCode(
        code=auth_code,
        user_id=db_user.id,
        client_id=client_id,
        redirect_uri=redirect_uri,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        scope=scope,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(db_code)
    db.commit()

    # Clear OAuth session data
    for key in ["oauth_state", "oauth_redirect_uri", "oauth_code_challenge",
                "oauth_code_challenge_method", "oauth_client_id", "oauth_scope"]:
        request.session.pop(key, None)

    # Redirect to Claude's callback
    params = urlencode({"code": auth_code, "state": oauth_state})
    return RedirectResponse(url=f"{redirect_uri}?{params}", status_code=302)


# ---------------------------------------------------------------------------
# Token Endpoint
# ---------------------------------------------------------------------------

@router.post("/oauth/token")
async def oauth_token(request: Request, db: Session = Depends(get_db)):
    """OAuth 2.1 Token Endpoint. Supports authorization_code and refresh_token grants."""
    form = await request.form()
    grant_type = form.get("grant_type")
    client_id = form.get("client_id")
    client_secret = form.get("client_secret")

    # Validate client credentials
    if client_id != settings.mcp_oauth_client_id or client_secret != settings.mcp_oauth_client_secret:
        return JSONResponse(status_code=401, content={"error": "invalid_client"})

    if grant_type == "authorization_code":
        return _handle_authorization_code(form, client_id, db)
    elif grant_type == "refresh_token":
        return _handle_refresh_token(form, db)
    else:
        return JSONResponse(status_code=400, content={"error": "unsupported_grant_type"})


def _handle_authorization_code(form, client_id: str, db: Session):
    code = form.get("code")
    code_verifier = form.get("code_verifier")
    redirect_uri = form.get("redirect_uri")

    if not code or not code_verifier:
        return JSONResponse(status_code=400, content={"error": "invalid_request"})

    # Look up the authorization code
    db_code = db.query(models.OAuthAuthorizationCode).filter(
        models.OAuthAuthorizationCode.code == code,
        models.OAuthAuthorizationCode.client_id == client_id,
        models.OAuthAuthorizationCode.expires_at > datetime.now(timezone.utc),
    ).first()

    if not db_code:
        return JSONResponse(status_code=400, content={"error": "invalid_grant"})

    # Verify redirect_uri matches
    if redirect_uri and redirect_uri != db_code.redirect_uri:
        db.delete(db_code)
        db.commit()
        return JSONResponse(status_code=400, content={"error": "invalid_grant"})

    # Verify PKCE: base64url(SHA256(code_verifier)) must equal stored code_challenge
    verifier_hash = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")

    if verifier_hash != db_code.code_challenge:
        db.delete(db_code)
        db.commit()
        return JSONResponse(status_code=400, content={"error": "invalid_grant"})

    # Code is valid — delete it (single-use)
    user_id = db_code.user_id
    db.delete(db_code)
    db.commit()

    # Load user
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return JSONResponse(status_code=400, content={"error": "invalid_grant"})

    # Issue tokens
    access_token = auth.create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(hours=1),
    )
    refresh_token = auth.create_refresh_token(user.id, db)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 3600,
        "refresh_token": refresh_token,
    }


def _handle_refresh_token(form, db: Session):
    refresh_token_value = form.get("refresh_token")
    if not refresh_token_value:
        return JSONResponse(status_code=400, content={"error": "invalid_request"})

    user = auth.verify_refresh_token(refresh_token_value, db)
    if not user:
        return JSONResponse(status_code=400, content={"error": "invalid_grant"})

    # Rotate: revoke old, create new
    auth.revoke_refresh_token(refresh_token_value, db)

    new_access_token = auth.create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(hours=1),
    )
    new_refresh_token = auth.create_refresh_token(user.id, db)

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": 3600,
        "refresh_token": new_refresh_token,
    }
