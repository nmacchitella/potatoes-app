from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    id: str
    is_admin: bool = False
    is_verified: bool = False
    created_at: datetime
    bio: Optional[str] = None
    is_public: bool = False
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int  # seconds until access token expires


class TokenData(BaseModel):
    email: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


class UserProfileUpdate(BaseModel):
    """Schema for updating user profile settings"""
    name: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    is_public: Optional[bool] = None


class UserProfile(User):
    """Extended user schema with profile info"""
    follower_count: int = 0
    following_count: int = 0


# ============================================================================
# NOTIFICATION SCHEMAS
# ============================================================================

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
    is_actionable: Optional[bool] = None  # For follow_request: True if still pending

    class Config:
        from_attributes = True
        populate_by_name = True


class NotificationMarkRead(BaseModel):
    notification_ids: List[str]


# ============================================================================
# PUBLIC PROFILE SCHEMAS
# ============================================================================

class PublicUserProfile(BaseModel):
    """Public view of user profile"""
    id: str
    name: str
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class ShareableUser(BaseModel):
    """
    Common user info for all sharing contexts.
    Used in Collection shares, MealPlan shares, and GroceryList shares.
    """
    id: str
    name: str
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# SOCIAL / FOLLOW SCHEMAS
# ============================================================================

class UserSearchResult(BaseModel):
    """Minimal user info for search results"""
    id: str
    name: str
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


class FollowResponse(BaseModel):
    """Response after follow action"""
    status: str
    message: str


class UserProfilePublic(BaseModel):
    """Public user profile (for viewing others)"""
    id: str
    name: str
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    is_public: bool
    follower_count: int
    following_count: int
    is_followed_by_me: bool
    follow_status: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# USER SETTINGS SCHEMAS
# ============================================================================

class UserSettingsBase(BaseModel):
    preferred_unit_system: str = "metric"  # imperial, metric
    default_servings: int = 4
    email_new_follower: bool = True
    email_follow_request: bool = True
    email_recipe_saved: bool = False


class UserSettingsUpdate(BaseModel):
    preferred_unit_system: Optional[str] = None
    default_servings: Optional[int] = None
    email_new_follower: Optional[bool] = None
    email_follow_request: Optional[bool] = None
    email_recipe_saved: Optional[bool] = None


class UserSettings(UserSettingsBase):
    user_id: str
    updated_at: datetime

    class Config:
        from_attributes = True
