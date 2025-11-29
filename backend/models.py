from sqlalchemy import Boolean, Column, ForeignKey, String, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid
import secrets


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth users
    oauth_provider = Column(String, nullable=True)  # 'google', etc.
    oauth_id = Column(String, nullable=True)  # Provider-specific user ID
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_verified = Column(Boolean, default=False, nullable=False)

    # Profile fields
    is_public = Column(Boolean, default=False, nullable=False)
    username = Column(String, unique=True, nullable=True, index=True)
    bio = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)

    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="owner", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="recipient", cascade="all, delete-orphan")
    following = relationship("UserFollow", foreign_keys="UserFollow.follower_id", back_populates="follower", cascade="all, delete-orphan")
    followers = relationship("UserFollow", foreign_keys="UserFollow.following_id", back_populates="following_user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=generate_uuid)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked = Column(Boolean, default=False)

    # Relationships
    owner = relationship("User", back_populates="refresh_tokens")


class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    type = Column(String, nullable=False)  # 'verify_email' or 'reset_password'
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    data = Column('metadata', JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    recipient = relationship("User", back_populates="notifications")


class UserFollow(Base):
    __tablename__ = "user_follows"

    id = Column(String, primary_key=True, default=generate_uuid)
    follower_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    following_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    status = Column(String, nullable=False)  # 'pending', 'confirmed', 'declined'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following_user = relationship("User", foreign_keys=[following_id], back_populates="followers")
