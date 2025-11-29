from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db, get_settings
import schemas
import auth
from services.email_service import EmailService

router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()


@router.post("/register", response_model=schemas.User)
async def register(
    user: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    db_user = auth.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    new_user = auth.create_user(db=db, user=user)
    token = auth.create_verification_token(new_user.id, "verify_email", db)

    email_service = EmailService()
    await email_service.send_verification_email(new_user.email, token, background_tasks)

    return new_user


@router.post("/login", response_model=schemas.Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and get access token"""
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox."
        )

    return auth.create_token_pair(user, db)


@router.post("/login-json", response_model=schemas.Token)
def login_json(user_login: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login with JSON payload (alternative to form data)"""
    user = auth.authenticate_user(db, user_login.email, user_login.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox."
        )

    return auth.create_token_pair(user, db)


@router.get("/me", response_model=schemas.User)
def get_current_user_info(current_user: schemas.User = Depends(auth.get_current_user)):
    """Get current user information"""
    return current_user


@router.put("/me", response_model=schemas.User)
def update_current_user(
    user_update: schemas.UserUpdate,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user information"""
    db_user = db.query(auth.models.User).filter(auth.models.User.id == current_user.id).first()

    if user_update.name is not None:
        db_user.name = user_update.name

    if user_update.email is not None:
        existing_user = auth.get_user_by_email(db, user_update.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        db_user.email = user_update.email

    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/me/password")
def change_password(
    password_change: schemas.PasswordChange,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user password"""
    db_user = db.query(auth.models.User).filter(auth.models.User.id == current_user.id).first()

    if not auth.verify_password(password_change.current_password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    db_user.hashed_password = auth.get_password_hash(password_change.new_password)
    db.commit()

    return {"message": "Password updated successfully"}


@router.delete("/me")
def delete_current_user(
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Delete current user account"""
    db_user = db.query(auth.models.User).filter(auth.models.User.id == current_user.id).first()
    db.delete(db_user)
    db.commit()
    return {"message": "Account deleted successfully"}


@router.post("/refresh", response_model=schemas.Token)
def refresh_token(
    refresh_request: schemas.RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    user = auth.verify_refresh_token(refresh_request.refresh_token, db)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = auth.create_access_token(data={"sub": user.email})
    auth.revoke_refresh_token(refresh_request.refresh_token, db)
    new_refresh_token = auth.create_refresh_token(user.id, db, timedelta(days=7))

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout")
def logout(
    refresh_request: schemas.RefreshTokenRequest,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Logout and revoke refresh token"""
    auth.revoke_refresh_token(refresh_request.refresh_token, db)
    return {"message": "Logged out successfully"}


@router.post("/logout-all")
def logout_all(
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Logout from all devices by revoking all refresh tokens"""
    count = auth.revoke_all_user_tokens(current_user.id, db)
    return {"message": f"Logged out from {count} devices"}


@router.get("/profile", response_model=schemas.UserProfile)
def get_current_user_profile(
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile with extended information."""
    return schemas.UserProfile(
        **current_user.__dict__,
        follower_count=0,
        following_count=0
    )


@router.patch("/profile", response_model=schemas.UserProfile)
def update_user_profile(
    profile_update: schemas.UserProfileUpdate,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile settings (name, username, bio, privacy)."""
    db_user = db.query(auth.models.User).filter(auth.models.User.id == current_user.id).first()

    if profile_update.name is not None:
        db_user.name = profile_update.name

    if profile_update.username is not None:
        existing_user = db.query(auth.models.User).filter(
            auth.models.User.username.ilike(profile_update.username),
            auth.models.User.id != current_user.id
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )

        db_user.username = profile_update.username

    if profile_update.bio is not None:
        db_user.bio = profile_update.bio

    if profile_update.is_public is not None:
        db_user.is_public = profile_update.is_public

    db.commit()
    db.refresh(db_user)

    return schemas.UserProfile(
        **db_user.__dict__,
        follower_count=0,
        following_count=0
    )


@router.post("/verify-email")
def verify_email(
    token: str,
    db: Session = Depends(get_db)
):
    """Verify email address using token"""
    user_id = auth.verify_verification_token(token, "verify_email", db)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    user = db.query(auth.models.User).filter(auth.models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_verified:
        return {"message": "Email already verified"}

    user.is_verified = True

    db.query(auth.models.VerificationToken).filter(
        auth.models.VerificationToken.token == token
    ).delete()

    db.commit()
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend verification email"""
    user = auth.get_user_by_email(db, email)
    if not user:
        return {"message": "If an account exists, a verification email has been sent"}

    if user.is_verified:
        return {"message": "Email already verified"}

    token = auth.create_verification_token(user.id, "verify_email", db)

    email_service = EmailService()
    await email_service.send_verification_email(user.email, token, background_tasks)

    return {"message": "Verification email sent"}


@router.post("/forgot-password")
async def forgot_password(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Request password reset"""
    user = auth.get_user_by_email(db, email)
    if not user:
        return {"message": "If an account exists, a password reset email has been sent"}

    token = auth.create_verification_token(user.id, "reset_password", db)

    email_service = EmailService()
    await email_service.send_password_reset_email(user.email, token, background_tasks)

    return {"message": "Password reset email sent"}


@router.post("/reset-password")
def reset_password(
    token: str,
    new_password: str,
    db: Session = Depends(get_db)
):
    """Reset password using token"""
    user_id = auth.verify_verification_token(token, "reset_password", db)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    user = db.query(auth.models.User).filter(auth.models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = auth.get_password_hash(new_password)

    db.query(auth.models.VerificationToken).filter(
        auth.models.VerificationToken.token == token
    ).delete()

    db.commit()
    return {"message": "Password reset successfully"}
