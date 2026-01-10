from pydantic import BaseModel, EmailStr, Field, model_validator, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date


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
    new_password: str


class UserProfileUpdate(BaseModel):
    """Schema for updating user profile settings"""
    name: Optional[str] = None
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
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# SHARED USER TYPE (used across Collection, MealPlan, GroceryList sharing)
# ============================================================================

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


# User Follow Schemas
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

    @field_validator('quantity', 'quantity_max', mode='before')
    @classmethod
    def convert_zero_to_none(cls, v):
        """Convert 0 to None since quantity=0 doesn't make sense."""
        if v == 0:
            return None
        return v

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


# --- Collection Share Schemas ---
class CollectionShareCreate(BaseModel):
    user_id: str
    permission: str = "viewer"  # viewer, editor


class CollectionShareUpdate(BaseModel):
    permission: str  # viewer, editor


# Alias for backwards compatibility - use ShareableUser for new code
CollectionShareUser = ShareableUser


class CollectionShare(BaseModel):
    id: str
    collection_id: str
    user_id: str
    permission: str
    invited_by_id: Optional[str] = None
    created_at: datetime
    user: CollectionShareUser

    class Config:
        from_attributes = True


class SharedCollection(BaseModel):
    """Collection info when listing collections shared with me"""
    id: str
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    recipe_count: int = 0
    permission: str  # my permission level
    owner: CollectionShareUser  # collection owner info
    created_at: datetime

    class Config:
        from_attributes = True


# --- Recipe Schemas ---
class RecipeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    yield_quantity: Optional[float] = None  # None means not specified
    yield_unit: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    privacy_level: Optional[str] = None  # None = use user's default (public user -> public, private user -> private)
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    video_start_seconds: Optional[int] = None  # For YouTube: when this recipe starts in the video


class RecipeCreate(RecipeBase):
    ingredients: List[RecipeIngredientCreate] = []
    instructions: List[RecipeInstructionCreate] = []
    tag_ids: List[str] = []
    collection_ids: List[str] = []
    sub_recipe_inputs: List["SubRecipeInput"] = []  # Composite recipes
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
    sub_recipe_inputs: Optional[List["SubRecipeInput"]] = None  # Composite recipes


class RecipeAuthor(BaseModel):
    id: str
    name: str
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class CollectionInfo(BaseModel):
    """Minimal collection info for recipe lists"""
    id: str
    name: str

    class Config:
        from_attributes = True


class RecipeSummary(BaseModel):
    """Minimal recipe info for lists"""
    id: str
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    yield_quantity: Optional[float] = None  # None means not specified
    yield_unit: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    privacy_level: str
    status: str  # draft or published
    author: RecipeAuthor
    tags: List["Tag"] = []
    collections: List[CollectionInfo] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ForkedFromInfo(BaseModel):
    """Info about the original recipe this was cloned from"""
    recipe_id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class ClonedByMeInfo(BaseModel):
    """Info about if/when the current user cloned this recipe"""
    cloned_recipe_id: str
    cloned_at: datetime

    class Config:
        from_attributes = True


# --- Sub-Recipe Schemas (composite recipes like Lasagna = Ragù + Besciamella) ---
class SubRecipeInput(BaseModel):
    """Input for linking a sub-recipe to a parent recipe"""
    sub_recipe_id: str
    sort_order: int = 0
    scale_factor: float = Field(default=1.0, gt=0, description="Scale factor, e.g., 1.5 for 1.5x the sub-recipe")
    section_title: Optional[str] = Field(None, max_length=100, description="Optional override title for this section")


class SubRecipeInfo(BaseModel):
    """Info about a sub-recipe in a composite recipe"""
    id: str
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    # Junction table data
    sort_order: int = 0
    scale_factor: float = 1.0
    section_title: Optional[str] = None
    # Nested data for display
    ingredients: List["RecipeIngredient"] = []

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
    sub_recipes: List[SubRecipeInfo] = []  # Composite recipes
    created_at: datetime
    updated_at: datetime
    forked_from: Optional[ForkedFromInfo] = None

    class Config:
        from_attributes = True


class RecipeWithScale(Recipe):
    """Recipe with scaled ingredients"""
    scale_factor: float = 1.0
    scaled_yield_quantity: Optional[float] = None
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


class RecipeParseTextRequest(BaseModel):
    text: str


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
    yield_quantity: Optional[float] = None  # None means not specified
    yield_unit: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    tags: List[str] = []
    video_start_seconds: Optional[int] = None  # For YouTube: when this recipe starts in the video


class RecipeImportMultiResponse(BaseModel):
    """Response for recipe import that may contain multiple recipes (e.g., from YouTube)"""
    recipes: List[RecipeImportResponse]
    source_type: str = "webpage"  # "webpage" or "youtube"


# ============================================================================
# MEAL PLAN SCHEMAS
# ============================================================================

class MealPlanCreate(BaseModel):
    """Create a new meal plan entry."""
    recipe_id: str
    planned_date: date
    meal_type: str = Field(..., pattern="^(breakfast|lunch|dinner|snack)$")
    servings: float = 4
    notes: Optional[str] = None


class MealPlanUpdate(BaseModel):
    """Update an existing meal plan entry."""
    planned_date: Optional[date] = None
    meal_type: Optional[str] = Field(None, pattern="^(breakfast|lunch|dinner|snack)$")
    servings: Optional[float] = None
    notes: Optional[str] = None


class MealPlanMove(BaseModel):
    """Move a meal to a different date/slot."""
    planned_date: date
    meal_type: str = Field(..., pattern="^(breakfast|lunch|dinner|snack)$")


class MealPlanCopy(BaseModel):
    """Copy meals from one date range to another."""
    source_start: date
    source_end: date
    target_start: date


class MealPlanRecurring(BaseModel):
    """Create a recurring meal."""
    recipe_id: str
    meal_type: str = Field(..., pattern="^(breakfast|lunch|dinner|snack)$")
    day_of_week: int = Field(..., ge=0, le=6)  # 0=Monday, 6=Sunday
    start_date: date
    end_date: date
    servings: float = 4


class MealPlanRecipe(BaseModel):
    """Minimal recipe info for meal plan responses."""
    id: str
    title: str
    cover_image_url: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None

    class Config:
        from_attributes = True


class MealPlan(BaseModel):
    """Meal plan entry response."""
    id: str
    planned_date: date
    meal_type: str
    servings: float
    notes: Optional[str] = None
    recurrence_id: Optional[str] = None
    recipe: MealPlanRecipe
    created_at: datetime

    class Config:
        from_attributes = True


class MealPlanListResponse(BaseModel):
    """Response for listing meal plans."""
    items: List[MealPlan]
    start_date: date
    end_date: date


# ============================================================================
# MEAL PLAN SHARING SCHEMAS
# ============================================================================

# Alias for backwards compatibility - use ShareableUser for new code
MealPlanShareUser = ShareableUser


class MealPlanShareCreate(BaseModel):
    """Create a meal plan share."""
    user_id: str
    permission: str = "viewer"  # viewer, editor


class MealPlanShareUpdate(BaseModel):
    """Update a meal plan share."""
    permission: str  # viewer, editor


class MealPlanShareResponse(BaseModel):
    """Meal plan share response."""
    id: str
    permission: str
    created_at: datetime
    shared_with: MealPlanShareUser

    class Config:
        from_attributes = True


# Alias for backwards compatibility - use ShareableUser for new code
SharedMealPlanOwner = ShareableUser


class SharedMealPlanAccess(BaseModel):
    """Info about a meal plan shared with the current user."""
    id: str
    owner: SharedMealPlanOwner
    permission: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# GROCERY LIST SCHEMAS
# ============================================================================

class GroceryListItemCreate(BaseModel):
    """Create a manual grocery list item."""
    name: str = Field(..., min_length=1, max_length=255)
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None


class GroceryListItemUpdate(BaseModel):
    """Update a grocery list item."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    quantity: Optional[float] = None
    unit: Optional[str] = None
    is_checked: Optional[bool] = None
    is_staple: Optional[bool] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None


class SourceRecipeInfo(BaseModel):
    """Minimal recipe info for grocery list items."""
    id: str
    title: str


class GroceryListItemResponse(BaseModel):
    """Grocery list item response."""
    id: str
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    is_checked: bool
    is_staple: bool
    is_manual: bool
    source_recipe_ids: Optional[List[str]] = None
    source_recipes: List[SourceRecipeInfo] = []
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


# Alias for backwards compatibility - use ShareableUser for new code
GroceryListShareUser = ShareableUser


class GroceryListCreate(BaseModel):
    """Create a new grocery list."""
    name: str = Field(default="Grocery List", min_length=1, max_length=200)


class GroceryListUpdate(BaseModel):
    """Update a grocery list."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)


class GroceryListSummary(BaseModel):
    """Summary info for grocery list sidebar."""
    id: str
    name: str
    item_count: int
    share_count: int = 0  # Number of users the list is shared with
    share_token: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GroceryListShareCreate(BaseModel):
    """Create a grocery list share."""
    user_id: str


class GroceryListShareUpdate(BaseModel):
    """Update a grocery list share."""
    permission: str  # editor


class GroceryListShareResponse(BaseModel):
    """Grocery list share response."""
    id: str
    user_id: str
    permission: str
    status: str  # pending, accepted, declined
    created_at: datetime
    user: GroceryListShareUser

    class Config:
        from_attributes = True


class GroceryListResponse(BaseModel):
    """Full grocery list response."""
    id: str
    name: str
    items: List[GroceryListItemResponse] = []
    items_by_category: Dict[str, List[GroceryListItemResponse]] = {}
    shares: List[GroceryListShareResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GroceryListGenerateRequest(BaseModel):
    """Request to generate grocery list from meal plan."""
    start_date: date
    end_date: date
    merge: bool = False  # True = merge with existing, False = replace


class GroceryListBulkCheckRequest(BaseModel):
    """Request to bulk check/uncheck items."""
    item_ids: List[str]
    is_checked: bool


# Alias for backwards compatibility - use ShareableUser for new code
SharedGroceryListOwner = ShareableUser


class SharedGroceryListAccess(BaseModel):
    """Info about a grocery list shared with the current user."""
    id: str  # share id
    grocery_list_id: str
    grocery_list_name: str
    owner: SharedGroceryListOwner
    permission: str
    status: str  # pending, accepted, declined
    created_at: datetime

    class Config:
        from_attributes = True


class GroceryListEmailShareRequest(BaseModel):
    """Request to share grocery list via email."""
    email: EmailStr


class GroceryListEmailShareResponse(BaseModel):
    """Response after sharing via email."""
    success: bool
    is_existing_user: bool  # True if email belongs to registered user
    message: str


class GroceryListAcceptPublicShareResponse(BaseModel):
    """Response after accepting a public share link."""
    grocery_list_id: str
    grocery_list_name: str
    already_had_access: bool = False


# Update forward references
CollectionWithRecipes.model_rebuild()
SubRecipeInfo.model_rebuild()
RecipeCreate.model_rebuild()
RecipeUpdate.model_rebuild()
