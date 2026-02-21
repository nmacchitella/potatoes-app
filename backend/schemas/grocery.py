from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import datetime, date

from schemas.user import ShareableUser


# ============================================================================
# GROCERY LIST ITEM SCHEMAS
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


# ============================================================================
# GROCERY LIST SCHEMAS
# ============================================================================

# Alias for backwards compatibility
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
    share_count: int = 0
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
    merge: bool = False
    calendar_ids: Optional[List[str]] = None


class GroceryListBulkCheckRequest(BaseModel):
    """Request to bulk check/uncheck items."""
    item_ids: List[str]
    is_checked: bool


# Alias for backwards compatibility
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
    is_existing_user: bool
    message: str


class GroceryListAcceptPublicShareResponse(BaseModel):
    """Response after accepting a public share link."""
    grocery_list_id: str
    grocery_list_name: str
    already_had_access: bool = False
