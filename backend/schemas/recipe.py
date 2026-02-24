from pydantic import BaseModel, Field, model_validator, field_validator
from typing import Optional, List, Any
from datetime import datetime

from schemas.user import ShareableUser


# ============================================================================
# INGREDIENT SCHEMAS
# ============================================================================

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

    @field_validator('unit', 'preparation', 'ingredient_group', 'notes', mode='before')
    @classmethod
    def convert_null_string_to_none(cls, v):
        """Convert the literal string 'null' to None (Gemini sometimes returns this)."""
        if isinstance(v, str) and v.strip().lower() == 'null':
            return None
        return v

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


# ============================================================================
# INSTRUCTION SCHEMAS
# ============================================================================

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


# ============================================================================
# TAG SCHEMAS
# ============================================================================

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


# ============================================================================
# COLLECTION SCHEMAS
# ============================================================================

class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    privacy_level: Optional[str] = None  # None = use user's default


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
    owner: Optional[ShareableUser] = None  # Present for partner collections

    class Config:
        from_attributes = True


class CollectionWithRecipes(Collection):
    recipes: List["RecipeSummary"] = []


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


# ============================================================================
# RECIPE SCHEMAS
# ============================================================================

class RecipeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
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
    video_start_seconds: Optional[int] = None
    notes: Optional[str] = None


class RecipeCreate(RecipeBase):
    ingredients: List[RecipeIngredientCreate] = []
    instructions: List[RecipeInstructionCreate] = []
    tag_ids: List[str] = []
    collection_ids: List[str] = []
    sub_recipe_inputs: List["SubRecipeInput"] = []
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
    notes: Optional[str] = None
    status: Optional[str] = None
    ingredients: Optional[List[RecipeIngredientCreate]] = None
    instructions: Optional[List[RecipeInstructionCreate]] = None
    tag_ids: Optional[List[str]] = None
    collection_ids: Optional[List[str]] = None
    sub_recipe_inputs: Optional[List["SubRecipeInput"]] = None


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
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    privacy_level: str
    status: str
    author: RecipeAuthor
    tags: List[Tag] = []
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


# ============================================================================
# SUB-RECIPE SCHEMAS
# ============================================================================

class SubRecipeInput(BaseModel):
    """Input for linking a sub-recipe to a parent recipe"""
    sub_recipe_id: str
    sort_order: int = 0
    scale_factor: float = Field(default=1.0, gt=0)
    section_title: Optional[str] = Field(None, max_length=100)


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
    sort_order: int = 0
    scale_factor: float = 1.0
    section_title: Optional[str] = None
    ingredients: List[RecipeIngredient] = []

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
    sub_recipes: List[SubRecipeInfo] = []
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


# ============================================================================
# MASTER INGREDIENT SCHEMAS
# ============================================================================

class IngredientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = None


class IngredientCreate(IngredientBase):
    pass


class IngredientUpdate(BaseModel):
    """Update an ingredient - only category can be changed."""
    category: Optional[str] = Field(None, max_length=50)


class Ingredient(IngredientBase):
    id: str
    normalized_name: str
    is_system: bool = False
    user_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# MEASUREMENT UNIT SCHEMAS
# ============================================================================

class MeasurementUnitBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    abbreviation: Optional[str] = None
    type: Optional[str] = None


class MeasurementUnit(MeasurementUnitBase):
    id: str
    is_system: bool = False

    class Config:
        from_attributes = True


# ============================================================================
# INGREDIENT PARSER SCHEMAS
# ============================================================================

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


# ============================================================================
# PAGINATION SCHEMAS
# ============================================================================

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


# ============================================================================
# RECIPE IMPORT SCHEMAS
# ============================================================================

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
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    tags: List[str] = []
    video_start_seconds: Optional[int] = None


class RecipeImportMultiResponse(BaseModel):
    """Response for recipe import that may contain multiple recipes (e.g., from YouTube)"""
    recipes: List[RecipeImportResponse]
    source_type: str = "webpage"  # "webpage" or "youtube"


# Resolve forward references
CollectionWithRecipes.model_rebuild()
RecipeCreate.model_rebuild()
RecipeUpdate.model_rebuild()
SubRecipeInfo.model_rebuild()
