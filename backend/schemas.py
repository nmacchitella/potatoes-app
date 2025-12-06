from pydantic import BaseModel, EmailStr, Field, model_validator
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
    is_verified: bool = False
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
    is_actionable: Optional[bool] = None  # For follow_request: True if still pending

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


# User Settings Schemas
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


# ============================================================================
# RECIPE SCHEMAS
# ============================================================================

# --- Ingredient Schemas ---
class RecipeIngredientBase(BaseModel):
    quantity: Optional[float] = Field(None, gt=0, description="Must be positive if provided")
    quantity_max: Optional[float] = Field(None, gt=0, description="Must be positive if provided")
    unit: Optional[str] = None
    name: str
    preparation: Optional[str] = None
    is_optional: bool = False
    is_staple: bool = False
    ingredient_group: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode='after')
    def validate_quantity_range(self):
        if self.quantity is not None and self.quantity_max is not None:
            if self.quantity_max <= self.quantity:
                raise ValueError('quantity_max must be greater than quantity')
        return self


class RecipeIngredientCreate(RecipeIngredientBase):
    sort_order: int = 0


class RecipeIngredient(RecipeIngredientBase):
    id: str
    ingredient_id: Optional[str] = None  # Link to master Ingredient entity
    sort_order: int

    class Config:
        from_attributes = True


# --- Instruction Schemas ---
class RecipeInstructionBase(BaseModel):
    instruction_text: str
    duration_minutes: Optional[int] = None
    instruction_group: Optional[str] = None


class RecipeInstructionCreate(RecipeInstructionBase):
    step_number: int


class RecipeInstruction(RecipeInstructionBase):
    id: str
    step_number: int

    class Config:
        from_attributes = True


# --- Tag Schemas ---
class TagBase(BaseModel):
    name: str
    category: Optional[str] = None


class TagCreate(TagBase):
    pass


class Tag(TagBase):
    id: str
    is_system: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# --- Collection Schemas ---
class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    privacy_level: Optional[str] = None  # None = use user's default (public user -> public, private user -> private)


class CollectionCreate(CollectionBase):
    pass


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    privacy_level: Optional[str] = None
    sort_order: Optional[int] = None


class Collection(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    privacy_level: str  # Always has a value from database
    is_default: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
    recipe_count: int = 0

    class Config:
        from_attributes = True


class CollectionWithRecipes(Collection):
    recipes: List["RecipeSummary"] = []


# --- Recipe Schemas ---
class RecipeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    yield_quantity: float = 4
    yield_unit: str = "servings"
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    privacy_level: Optional[str] = None  # None = use user's default (public user -> public, private user -> private)
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    cover_image_url: Optional[str] = None


class RecipeCreate(RecipeBase):
    ingredients: List[RecipeIngredientCreate] = []
    instructions: List[RecipeInstructionCreate] = []
    tag_ids: List[str] = []
    collection_ids: List[str] = []
    status: str = "published"


class RecipeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    privacy_level: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    status: Optional[str] = None
    ingredients: Optional[List[RecipeIngredientCreate]] = None
    instructions: Optional[List[RecipeInstructionCreate]] = None
    tag_ids: Optional[List[str]] = None
    collection_ids: Optional[List[str]] = None


class RecipeAuthor(BaseModel):
    id: str
    name: str
    username: Optional[str] = None
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class RecipeSummary(BaseModel):
    """Minimal recipe info for lists"""
    id: str
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    yield_quantity: float
    yield_unit: str
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    privacy_level: str
    status: str  # draft or published
    author: RecipeAuthor
    tags: List["Tag"] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ForkedFromInfo(BaseModel):
    """Info about the original recipe this was cloned from"""
    recipe_id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_username: Optional[str] = None

    class Config:
        from_attributes = True


class ClonedByMeInfo(BaseModel):
    """Info about if/when the current user cloned this recipe"""
    cloned_recipe_id: str
    cloned_at: datetime

    class Config:
        from_attributes = True


class Recipe(RecipeBase):
    """Full recipe with all details"""
    id: str
    author_id: str
    author: RecipeAuthor
    status: str
    ingredients: List[RecipeIngredient] = []
    instructions: List[RecipeInstruction] = []
    tags: List[Tag] = []
    created_at: datetime
    updated_at: datetime
    forked_from: Optional[ForkedFromInfo] = None

    class Config:
        from_attributes = True


class RecipeWithScale(Recipe):
    """Recipe with scaled ingredients"""
    scale_factor: float = 1.0
    scaled_yield_quantity: float = 4
    cloned_by_me: Optional[ClonedByMeInfo] = None


# --- Master Ingredient Schemas (for autocomplete) ---
class IngredientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = None


class IngredientCreate(IngredientBase):
    pass


class Ingredient(IngredientBase):
    id: str
    normalized_name: str
    is_system: bool = False
    user_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Measurement Unit Schemas ---
class MeasurementUnitBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    abbreviation: Optional[str] = None
    type: Optional[str] = None


class MeasurementUnit(MeasurementUnitBase):
    id: str
    is_system: bool = False

    class Config:
        from_attributes = True


# --- Ingredient Parser Schemas ---
class ParsedIngredient(BaseModel):
    quantity: Optional[float] = None
    quantity_max: Optional[float] = None
    unit: Optional[str] = None
    name: str
    preparation: Optional[str] = None
    notes: Optional[str] = None
    original_text: str


class IngredientParseRequest(BaseModel):
    text: str


class IngredientParseResponse(BaseModel):
    ingredients: List[ParsedIngredient]


# --- Pagination Schemas ---
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class RecipeListResponse(BaseModel):
    items: List[RecipeSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# --- Recipe Import Schemas ---
class RecipeImportRequest(BaseModel):
    url: str


class ImportedIngredient(BaseModel):
    name: str
    quantity: Optional[float] = None
    quantity_max: Optional[float] = None
    unit: Optional[str] = None
    preparation: Optional[str] = None
    is_optional: bool = False
    notes: Optional[str] = None


class ImportedInstruction(BaseModel):
    step_number: int
    instruction_text: str
    duration_minutes: Optional[int] = None


class RecipeImportResponse(BaseModel):
    title: str
    description: Optional[str] = None
    ingredients: List[ImportedIngredient] = []
    instructions: List[ImportedInstruction] = []
    yield_quantity: float = 4
    yield_unit: str = "servings"
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    tags: List[str] = []


class RecipeImportMultiResponse(BaseModel):
    """Response for recipe import that may contain multiple recipes (e.g., from YouTube)"""
    recipes: List[RecipeImportResponse]
    source_type: str = "webpage"  # "webpage" or "youtube"


# Update forward references
CollectionWithRecipes.model_rebuild()
