from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from jwt.exceptions import PyJWTError as JWTError
import bcrypt
import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from config import settings
import models
import schemas

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def authenticate_user(db: Session, email: str, password: str):
    """Authenticate user with email and password.

    Returns False if:
    - User doesn't exist
    - User is an OAuth-only account (no password set)
    - Password is incorrect
    """
    user = get_user_by_email(db, email)
    if not user:
        return False
    # OAuth users have no password - they must use OAuth to login
    if not user.hashed_password:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create default grocery list for the new user
    default_grocery_list = models.GroceryList(
        user_id=db_user.id,
        name="My Grocery List"
    )
    db.add(default_grocery_list)
    db.commit()

    return db_user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Optional authentication - returns None if no valid token"""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            return None
        user = get_user_by_email(db, email=email)
        return user
    except JWTError:
        return None


def create_refresh_token(user_id: str, db: Session, expires_delta: timedelta = None) -> str:
    """Create a new refresh token for a user"""
    if expires_delta is None:
        expires_delta = timedelta(days=settings.refresh_token_expire_days)

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + expires_delta

    db_refresh_token = models.RefreshToken(
        token=token,
        user_id=user_id,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    db.commit()

    return token


def verify_refresh_token(token: str, db: Session) -> Optional[models.User]:
    """Verify a refresh token and return the associated user"""
    db_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token == token,
        models.RefreshToken.revoked == False,
        models.RefreshToken.expires_at > datetime.now(timezone.utc)
    ).first()

    if not db_token:
        return None

    return db_token.owner


def revoke_refresh_token(token: str, db: Session) -> bool:
    """Revoke a refresh token"""
    db_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token == token
    ).first()

    if not db_token:
        return False

    db_token.revoked = True
    db.commit()
    return True


def revoke_all_user_tokens(user_id: str, db: Session) -> int:
    """Revoke all refresh tokens for a user"""
    count = db.query(models.RefreshToken).filter(
        models.RefreshToken.user_id == user_id,
        models.RefreshToken.revoked == False
    ).update({"revoked": True})
    db.commit()
    return count


def create_token_pair(user: models.User, db: Session) -> dict:
    """Create access and refresh token pair for a user"""
    access_token = create_access_token(
        data={"sub": user.email}
    )
    refresh_token = create_refresh_token(user.id, db)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60  # seconds
    }


def create_verification_token(user_id: str, token_type: str, db: Session) -> str:
    """Create a verification or password reset token"""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    db_token = models.VerificationToken(
        token=token,
        user_id=user_id,
        type=token_type,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    return token


def verify_verification_token(token: str, token_type: str, db: Session) -> Optional[models.User]:
    """Verify a token and return the user"""
    db_token = db.query(models.VerificationToken).filter(
        models.VerificationToken.token == token,
        models.VerificationToken.type == token_type,
        models.VerificationToken.expires_at > datetime.now(timezone.utc)
    ).first()

    if not db_token:
        return None

    return db_token.user_id
