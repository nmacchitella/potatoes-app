from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime, date

from schemas.user import ShareableUser


# ============================================================================
# MEAL PLAN CALENDAR SCHEMAS
# ============================================================================

class MealPlanCalendarCreate(BaseModel):
    """Create a new meal plan calendar."""
    name: str = Field(default="Meal Plan", min_length=1, max_length=200)


class MealPlanCalendarUpdate(BaseModel):
    """Update a meal plan calendar."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)


class MealPlanCalendarSummary(BaseModel):
    """Summary info for calendar sidebar."""
    id: str
    name: str
    is_owner: bool = True
    permission: Optional[str] = None  # 'viewer' or 'editor' if shared, None if owner
    owner: Optional[ShareableUser] = None  # Present if not owner
    share_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# MEAL PLAN SCHEMAS
# ============================================================================

class CustomMealGroceryItem(BaseModel):
    """A grocery item attached to a custom meal plan entry."""
    name: str = Field(..., min_length=1, max_length=255)
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None  # produce, dairy, nuts, etc.


class MealPlanCreate(BaseModel):
    """Create a new meal plan entry (recipe-based or custom item)."""
    calendar_id: str
    recipe_id: Optional[str] = None
    custom_title: Optional[str] = Field(None, max_length=255)
    custom_description: Optional[str] = None
    grocery_items: Optional[List[CustomMealGroceryItem]] = None
    planned_date: date
    meal_type: str = Field(..., pattern="^(breakfast|lunch|dinner|snack)$")
    servings: float = 4
    notes: Optional[str] = None

    @model_validator(mode='after')
    def validate_recipe_or_custom(self):
        if not self.recipe_id and not self.custom_title:
            raise ValueError('Either recipe_id or custom_title is required')
        if self.recipe_id and self.custom_title:
            raise ValueError('Cannot specify both recipe_id and custom_title')
        return self


class MealPlanUpdate(BaseModel):
    """Update an existing meal plan entry."""
    planned_date: Optional[date] = None
    meal_type: Optional[str] = Field(None, pattern="^(breakfast|lunch|dinner|snack)$")
    servings: Optional[float] = None
    notes: Optional[str] = None
    custom_title: Optional[str] = Field(None, max_length=255)
    custom_description: Optional[str] = None
    grocery_items: Optional[List[CustomMealGroceryItem]] = None


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
    calendar_id: str
    planned_date: date
    meal_type: str
    servings: float
    notes: Optional[str] = None
    recurrence_id: Optional[str] = None
    recipe: Optional[MealPlanRecipe] = None
    custom_title: Optional[str] = None
    custom_description: Optional[str] = None
    grocery_items: Optional[List[CustomMealGroceryItem]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MealPlanListResponse(BaseModel):
    """Response for listing meal plans."""
    items: List[MealPlan]
    start_date: date
    end_date: date
    calendar_ids: List[str] = []


# ============================================================================
# MEAL PLAN CALENDAR SHARING SCHEMAS
# ============================================================================

# Alias for backwards compatibility
MealPlanShareUser = ShareableUser


class MealPlanCalendarShareCreate(BaseModel):
    """Create a calendar share."""
    user_id: str
    permission: str = "editor"  # viewer, editor


class MealPlanCalendarShareUpdate(BaseModel):
    """Update a calendar share."""
    permission: str  # viewer, editor


class MealPlanCalendarShareResponse(BaseModel):
    """Calendar share response."""
    id: str
    calendar_id: str
    user_id: str
    permission: str
    created_at: datetime
    user: MealPlanShareUser

    class Config:
        from_attributes = True


# Alias for backwards compatibility
SharedMealPlanOwner = ShareableUser


class SharedMealPlanCalendarAccess(BaseModel):
    """Info about a calendar shared with the current user."""
    id: str  # share id
    calendar_id: str
    calendar_name: str
    owner: SharedMealPlanOwner
    permission: str
    created_at: datetime

    class Config:
        from_attributes = True


# Deprecated aliases for backwards compatibility
MealPlanShareCreate = MealPlanCalendarShareCreate
MealPlanShareUpdate = MealPlanCalendarShareUpdate
MealPlanShareResponse = MealPlanCalendarShareResponse
SharedMealPlanAccess = SharedMealPlanCalendarAccess
