from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    id: str
    is_admin: bool = False
    created_at: datetime
    username: Optional[str] = None
    bio: Optional[str] = None
    is_public: bool = False
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserProfileUpdate(BaseModel):
    """Schema for updating user profile settings"""
    name: Optional[str] = None
    username: Optional[str] = Field(None, min_length=3, max_length=30, pattern="^[a-zA-Z0-9_]+$")
    bio: Optional[str] = Field(None, max_length=500)
    is_public: Optional[bool] = None


class UserProfile(User):
    """Extended user schema with profile info"""
    follower_count: int = 0
    following_count: int = 0


# Notification Schemas
class NotificationBase(BaseModel):
    type: str
    title: str
    message: str
    link: Optional[str] = None
    data: Optional[Dict[str, Any]] = Field(None, serialization_alias='metadata')


class NotificationCreate(NotificationBase):
    user_id: str


class Notification(NotificationBase):
    id: str
    user_id: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class NotificationMarkRead(BaseModel):
    notification_ids: List[str]


# Public Profile Schemas
class PublicUserProfile(BaseModel):
    """Public view of user profile"""
    id: str
    name: str
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


# User Follow Schemas
class UserSearchResult(BaseModel):
    """Minimal user info for search results"""
    id: str
    name: str
    username: Optional[str] = None
    profile_image_url: Optional[str] = None
    is_public: bool
    is_followed_by_me: bool = False
    follow_status: Optional[str] = None

    class Config:
        from_attributes = True


class UserFollowBase(BaseModel):
    follower_id: str
    following_id: str
    status: str


class UserFollow(UserFollowBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FollowRequest(BaseModel):
    """Request to follow a user"""
    user_id: str


class FollowResponse(BaseModel):
    """Response after follow action"""
    status: str
    message: str


class UserProfilePublic(BaseModel):
    """Public user profile (for viewing others)"""
    id: str
    name: str
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    is_public: bool
    follower_count: int
    following_count: int
    is_followed_by_me: bool
    follow_status: Optional[str] = None

    class Config:
        from_attributes = True
