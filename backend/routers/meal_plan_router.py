"""
Meal Plan Router

CRUD operations for meal planning with multiple calendars.
Users can have multiple calendars and share specific calendars with others.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import date, timedelta
import uuid

from database import get_db
from auth import get_current_user
from models import (
    User, Recipe,
    MealPlanCalendar as MealPlanCalendarModel,
    MealPlan as MealPlanModel,
    MealPlanShare as MealPlanShareModel,
    Notification
)
from schemas import (
    MealPlanCreate, MealPlanUpdate, MealPlan as MealPlanSchema,
    MealPlanMove, MealPlanCopy, MealPlanRecurring,
    MealPlanListResponse,
    MealPlanCalendarCreate, MealPlanCalendarUpdate, MealPlanCalendarSummary,
    MealPlanCalendarShareCreate, MealPlanCalendarShareUpdate,
    MealPlanCalendarShareResponse, SharedMealPlanCalendarAccess,
)

router = APIRouter(prefix="/meal-plan", tags=["meal-plan"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_calendar_or_404(db: Session, calendar_id: str, user: User) -> MealPlanCalendarModel:
    """Get a calendar owned by the user or raise 404."""
    calendar = db.query(MealPlanCalendarModel).filter(
        MealPlanCalendarModel.id == calendar_id,
        MealPlanCalendarModel.user_id == user.id
    ).first()

    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")

    return calendar


def get_calendar_access(db: Session, calendar_id: str, user: User) -> Optional[str]:
    """
    Check if user has access to a calendar.
    Returns permission level ('owner', 'viewer', 'editor') or None.
    """
    # Check if user owns the calendar
    calendar = db.query(MealPlanCalendarModel).filter(
        MealPlanCalendarModel.id == calendar_id
    ).first()

    if not calendar:
        return None

    if calendar.user_id == user.id:
        return "owner"

    # Check for share
    share = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.calendar_id == calendar_id,
        MealPlanShareModel.user_id == user.id
    ).first()

    return share.permission if share else None


def require_calendar_access(db: Session, calendar_id: str, user: User, edit_required: bool = False) -> str:
    """
    Verify user has access to the calendar.
    Returns permission level or raises 403.
    """
    permission = get_calendar_access(db, calendar_id, user)

    if not permission:
        raise HTTPException(status_code=403, detail="No access to this calendar")

    if edit_required and permission == "viewer":
        raise HTTPException(status_code=403, detail="Edit access required")

    return permission


def get_user_accessible_calendar_ids(db: Session, user: User) -> List[str]:
    """Get list of calendar IDs the user can access (owned + shared)."""
    # Own calendars
    owned = db.query(MealPlanCalendarModel.id).filter(
        MealPlanCalendarModel.user_id == user.id
    ).all()

    # Shared calendars
    shared = db.query(MealPlanShareModel.calendar_id).filter(
        MealPlanShareModel.user_id == user.id
    ).all()

    return [c[0] for c in owned] + [c[0] for c in shared]


def verify_recipe_access(db: Session, recipe_id: str, user: User) -> Recipe:
    """Verify user can access the recipe (owns it or it's public)."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # User can add their own recipes or public recipes to their meal plan
    if recipe.author_id != user.id and recipe.privacy_level != "public":
        raise HTTPException(status_code=403, detail="Cannot add this recipe to meal plan")

    return recipe


def get_or_create_default_calendar(db: Session, user: User) -> MealPlanCalendarModel:
    """Get user's first calendar or create a default one."""
    calendar = db.query(MealPlanCalendarModel).filter(
        MealPlanCalendarModel.user_id == user.id
    ).first()

    if not calendar:
        calendar = MealPlanCalendarModel(
            user_id=user.id,
            name="Meal Plan"
        )
        db.add(calendar)
        db.commit()
        db.refresh(calendar)

    return calendar


# ============================================================================
# CALENDAR CRUD ENDPOINTS
# ============================================================================

@router.get("/calendars", response_model=List[MealPlanCalendarSummary])
async def list_calendars(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all calendars accessible to the user (owned + shared)."""
    # Get owned calendars with share counts
    owned_calendars = db.query(
        MealPlanCalendarModel,
        func.count(MealPlanShareModel.id).label('share_count')
    ).outerjoin(
        MealPlanShareModel,
        MealPlanShareModel.calendar_id == MealPlanCalendarModel.id
    ).filter(
        MealPlanCalendarModel.user_id == current_user.id
    ).group_by(
        MealPlanCalendarModel.id
    ).all()

    # Get shared calendars
    shared_calendars = db.query(
        MealPlanCalendarModel,
        MealPlanShareModel.permission,
        User
    ).join(
        MealPlanShareModel,
        MealPlanShareModel.calendar_id == MealPlanCalendarModel.id
    ).join(
        User,
        User.id == MealPlanCalendarModel.user_id
    ).filter(
        MealPlanShareModel.user_id == current_user.id
    ).all()

    result = []

    # Add owned calendars
    for calendar, share_count in owned_calendars:
        result.append(MealPlanCalendarSummary(
            id=calendar.id,
            name=calendar.name,
            is_owner=True,
            permission=None,
            owner=None,
            share_count=share_count,
            created_at=calendar.created_at,
            updated_at=calendar.updated_at
        ))

    # Add shared calendars
    for calendar, permission, owner in shared_calendars:
        result.append(MealPlanCalendarSummary(
            id=calendar.id,
            name=calendar.name,
            is_owner=False,
            permission=permission,
            owner={
                "id": owner.id,
                "name": owner.name,
                "profile_image_url": owner.profile_image_url
            },
            share_count=0,
            created_at=calendar.created_at,
            updated_at=calendar.updated_at
        ))

    return result


@router.post("/calendars", response_model=MealPlanCalendarSummary)
async def create_calendar(
    data: MealPlanCalendarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new meal plan calendar."""
    calendar = MealPlanCalendarModel(
        user_id=current_user.id,
        name=data.name
    )
    db.add(calendar)
    db.commit()
    db.refresh(calendar)

    return MealPlanCalendarSummary(
        id=calendar.id,
        name=calendar.name,
        is_owner=True,
        permission=None,
        owner=None,
        share_count=0,
        created_at=calendar.created_at,
        updated_at=calendar.updated_at
    )


@router.patch("/calendars/{calendar_id}", response_model=MealPlanCalendarSummary)
async def update_calendar(
    calendar_id: str,
    data: MealPlanCalendarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a calendar (name). Only owner can update."""
    calendar = get_calendar_or_404(db, calendar_id, current_user)

    if data.name is not None:
        calendar.name = data.name

    db.commit()
    db.refresh(calendar)

    # Get share count
    share_count = db.query(func.count(MealPlanShareModel.id)).filter(
        MealPlanShareModel.calendar_id == calendar_id
    ).scalar()

    return MealPlanCalendarSummary(
        id=calendar.id,
        name=calendar.name,
        is_owner=True,
        permission=None,
        owner=None,
        share_count=share_count,
        created_at=calendar.created_at,
        updated_at=calendar.updated_at
    )


@router.delete("/calendars/{calendar_id}")
async def delete_calendar(
    calendar_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a calendar. Only owner can delete. All items and shares are deleted."""
    calendar = get_calendar_or_404(db, calendar_id, current_user)

    # Check if this is the user's only calendar
    calendar_count = db.query(func.count(MealPlanCalendarModel.id)).filter(
        MealPlanCalendarModel.user_id == current_user.id
    ).scalar()

    if calendar_count <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your only calendar. Create another one first."
        )

    db.delete(calendar)
    db.commit()

    return {"status": "deleted"}


# ============================================================================
# CALENDAR SHARING ENDPOINTS
# ============================================================================

@router.get("/calendars/{calendar_id}/shares", response_model=List[MealPlanCalendarShareResponse])
async def list_calendar_shares(
    calendar_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List users a calendar is shared with. Only owner can view."""
    calendar = get_calendar_or_404(db, calendar_id, current_user)

    shares = db.query(MealPlanShareModel).options(
        joinedload(MealPlanShareModel.user)
    ).filter(
        MealPlanShareModel.calendar_id == calendar_id
    ).all()

    return shares


@router.post("/calendars/{calendar_id}/shares", response_model=MealPlanCalendarShareResponse)
async def share_calendar(
    calendar_id: str,
    data: MealPlanCalendarShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Share a calendar with another user. Only owner can share."""
    calendar = get_calendar_or_404(db, calendar_id, current_user)

    # Can't share with yourself
    if data.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    # Check user exists
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check not already shared
    existing = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.calendar_id == calendar_id,
        MealPlanShareModel.user_id == data.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")

    share = MealPlanShareModel(
        calendar_id=calendar_id,
        user_id=data.user_id,
        permission=data.permission
    )
    db.add(share)

    # Create notification for the shared user
    notification = Notification(
        user_id=data.user_id,
        type="meal_plan_shared",
        title="Meal Plan Shared",
        message=f"{current_user.name} shared their meal plan '{calendar.name}' with you",
        link="/calendar",
        data={"calendar_id": calendar_id, "sharer_id": current_user.id}
    )
    db.add(notification)

    db.commit()
    db.refresh(share, ['user'])

    return share


@router.patch("/calendars/{calendar_id}/shares/{user_id}", response_model=MealPlanCalendarShareResponse)
async def update_calendar_share(
    calendar_id: str,
    user_id: str,
    data: MealPlanCalendarShareUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update permission for a shared user. Only owner can update."""
    calendar = get_calendar_or_404(db, calendar_id, current_user)

    share = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.calendar_id == calendar_id,
        MealPlanShareModel.user_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    share.permission = data.permission
    db.commit()
    db.refresh(share, ['user'])

    return share


@router.delete("/calendars/{calendar_id}/shares/{user_id}")
async def remove_calendar_share(
    calendar_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stop sharing a calendar with a user. Only owner can remove."""
    calendar = get_calendar_or_404(db, calendar_id, current_user)

    share = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.calendar_id == calendar_id,
        MealPlanShareModel.user_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()

    return {"status": "removed"}


@router.delete("/calendars/{calendar_id}/leave")
async def leave_shared_calendar(
    calendar_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave a calendar that was shared with you."""
    share = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.calendar_id == calendar_id,
        MealPlanShareModel.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()

    return {"status": "left"}


# ============================================================================
# MEAL PLAN CRUD ENDPOINTS
# ============================================================================

@router.get("", response_model=MealPlanListResponse)
async def list_meal_plans(
    start: date = Query(..., description="Start date (inclusive)"),
    end: date = Query(..., description="End date (inclusive)"),
    calendar_ids: Optional[List[str]] = Query(None, description="Filter by calendar IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all meal plan entries for a date range across accessible calendars."""
    if end < start:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Limit range to prevent abuse (max 90 days)
    if (end - start).days > 90:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    # Get accessible calendar IDs
    accessible_ids = get_user_accessible_calendar_ids(db, current_user)

    if not accessible_ids:
        # Create default calendar if user has none
        default_cal = get_or_create_default_calendar(db, current_user)
        accessible_ids = [default_cal.id]

    # If specific calendars requested, filter to only those the user can access
    if calendar_ids:
        filtered_ids = [cid for cid in calendar_ids if cid in accessible_ids]
        if not filtered_ids:
            raise HTTPException(status_code=403, detail="No access to requested calendars")
        query_calendar_ids = filtered_ids
    else:
        query_calendar_ids = accessible_ids

    meal_plans = db.query(MealPlanModel).options(
        joinedload(MealPlanModel.recipe)
    ).filter(
        MealPlanModel.calendar_id.in_(query_calendar_ids),
        MealPlanModel.planned_date >= start,
        MealPlanModel.planned_date <= end
    ).order_by(
        MealPlanModel.planned_date,
        MealPlanModel.meal_type
    ).all()

    return MealPlanListResponse(
        items=meal_plans,
        start_date=start,
        end_date=end,
        calendar_ids=query_calendar_ids
    )


@router.post("", response_model=MealPlanSchema)
async def create_meal_plan(
    data: MealPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a recipe or custom item to a calendar."""
    # Verify user has edit access to the calendar
    require_calendar_access(db, data.calendar_id, current_user, edit_required=True)

    # If recipe-based, verify recipe exists and user can access it
    if data.recipe_id:
        verify_recipe_access(db, data.recipe_id, current_user)

    meal_plan = MealPlanModel(
        calendar_id=data.calendar_id,
        recipe_id=data.recipe_id,
        custom_title=data.custom_title,
        custom_description=data.custom_description,
        grocery_items=[gi.model_dump() for gi in data.grocery_items] if data.grocery_items else None,
        planned_date=data.planned_date,
        meal_type=data.meal_type,
        servings=data.servings,
        notes=data.notes
    )

    db.add(meal_plan)
    db.commit()
    db.refresh(meal_plan)

    # Load recipe relationship for response (if recipe-based)
    if data.recipe_id:
        db.refresh(meal_plan, ['recipe'])

    return meal_plan


# ============================================================================
# STATIC PATH ENDPOINTS (must be before dynamic /{meal_plan_id} routes)
# ============================================================================

@router.get("/shares", response_model=List[MealPlanCalendarShareResponse])
async def list_shares_legacy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """[DEPRECATED] List users you've shared your calendars with."""
    # Get first calendar's shares for backwards compatibility
    calendar = db.query(MealPlanCalendarModel).filter(
        MealPlanCalendarModel.user_id == current_user.id
    ).first()

    if not calendar:
        return []

    shares = db.query(MealPlanShareModel).options(
        joinedload(MealPlanShareModel.user)
    ).filter(
        MealPlanShareModel.calendar_id == calendar.id
    ).all()

    return shares


@router.get("/shared-with-me", response_model=List[SharedMealPlanCalendarAccess])
async def list_shared_with_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List calendars shared with the current user."""
    shares = db.query(
        MealPlanShareModel,
        MealPlanCalendarModel,
        User
    ).join(
        MealPlanCalendarModel,
        MealPlanCalendarModel.id == MealPlanShareModel.calendar_id
    ).join(
        User,
        User.id == MealPlanCalendarModel.user_id
    ).filter(
        MealPlanShareModel.user_id == current_user.id
    ).all()

    result = []
    for share, calendar, owner in shares:
        result.append(SharedMealPlanCalendarAccess(
            id=share.id,
            calendar_id=calendar.id,
            calendar_name=calendar.name,
            owner={
                "id": owner.id,
                "name": owner.name,
                "profile_image_url": owner.profile_image_url
            },
            permission=share.permission,
            created_at=share.created_at
        ))

    return result


# ============================================================================
# DYNAMIC PATH ENDPOINTS (/{meal_plan_id} routes)
# ============================================================================

@router.get("/{meal_plan_id}", response_model=MealPlanSchema)
async def get_meal_plan(
    meal_plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific meal plan entry."""
    meal_plan = db.query(MealPlanModel).options(
        joinedload(MealPlanModel.recipe)
    ).filter(
        MealPlanModel.id == meal_plan_id
    ).first()

    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")

    # Check access to the calendar
    require_calendar_access(db, meal_plan.calendar_id, current_user)

    return meal_plan


@router.patch("/{meal_plan_id}", response_model=MealPlanSchema)
async def update_meal_plan(
    meal_plan_id: str,
    data: MealPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a meal plan entry (date, meal type, servings, notes)."""
    meal_plan = db.query(MealPlanModel).options(
        joinedload(MealPlanModel.recipe)
    ).filter(
        MealPlanModel.id == meal_plan_id
    ).first()

    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")

    # Check edit access to the calendar
    require_calendar_access(db, meal_plan.calendar_id, current_user, edit_required=True)

    update_data = data.model_dump(exclude_unset=True)
    if 'grocery_items' in update_data and update_data['grocery_items'] is not None:
        update_data['grocery_items'] = [
            gi if isinstance(gi, dict) else gi.model_dump()
            for gi in update_data['grocery_items']
        ]
    for field, value in update_data.items():
        setattr(meal_plan, field, value)

    db.commit()
    db.refresh(meal_plan, ['recipe'])

    return meal_plan


@router.delete("/{meal_plan_id}")
async def delete_meal_plan(
    meal_plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a meal from the plan."""
    meal_plan = db.query(MealPlanModel).filter(
        MealPlanModel.id == meal_plan_id
    ).first()

    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")

    # Check edit access to the calendar
    require_calendar_access(db, meal_plan.calendar_id, current_user, edit_required=True)

    db.delete(meal_plan)
    db.commit()

    return {"status": "deleted"}


@router.post("/{meal_plan_id}/move", response_model=MealPlanSchema)
async def move_meal_plan(
    meal_plan_id: str,
    data: MealPlanMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move a meal to a different date/slot."""
    meal_plan = db.query(MealPlanModel).options(
        joinedload(MealPlanModel.recipe)
    ).filter(
        MealPlanModel.id == meal_plan_id
    ).first()

    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")

    # Check edit access to the calendar
    require_calendar_access(db, meal_plan.calendar_id, current_user, edit_required=True)

    meal_plan.planned_date = data.planned_date
    meal_plan.meal_type = data.meal_type

    db.commit()
    db.refresh(meal_plan, ['recipe'])

    return meal_plan


@router.post("/copy", response_model=List[MealPlanSchema])
async def copy_meal_plans(
    data: MealPlanCopy,
    calendar_id: Optional[str] = Query(None, description="Target calendar ID (defaults to source calendar)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Copy meals from one date range to another, maintaining day offsets."""
    if data.source_end < data.source_start:
        raise HTTPException(status_code=400, detail="Source end date must be after start date")

    # Get accessible calendar IDs
    accessible_ids = get_user_accessible_calendar_ids(db, current_user)

    # Get source meals from accessible calendars
    source_meals = db.query(MealPlanModel).filter(
        MealPlanModel.calendar_id.in_(accessible_ids),
        MealPlanModel.planned_date >= data.source_start,
        MealPlanModel.planned_date <= data.source_end
    ).all()

    if not source_meals:
        raise HTTPException(status_code=400, detail="No meals found in source date range")

    # Determine target calendar
    if calendar_id:
        require_calendar_access(db, calendar_id, current_user, edit_required=True)
        target_calendar_id = calendar_id
    else:
        # Use the calendar of the first source meal
        target_calendar_id = source_meals[0].calendar_id
        require_calendar_access(db, target_calendar_id, current_user, edit_required=True)

    # Create copies with adjusted dates
    new_meals = []
    for source in source_meals:
        day_offset = (source.planned_date - data.source_start).days
        new_date = data.target_start + timedelta(days=day_offset)

        new_meal = MealPlanModel(
            calendar_id=target_calendar_id,
            recipe_id=source.recipe_id,
            custom_title=source.custom_title,
            custom_description=source.custom_description,
            grocery_items=source.grocery_items,
            planned_date=new_date,
            meal_type=source.meal_type,
            servings=source.servings,
            notes=source.notes
        )
        db.add(new_meal)
        new_meals.append(new_meal)

    db.commit()

    # Refresh to get relationships
    for meal in new_meals:
        db.refresh(meal, ['recipe'])

    return new_meals


@router.post("/recurring", response_model=List[MealPlanSchema])
async def create_recurring_meal(
    data: MealPlanRecurring,
    calendar_id: str = Query(..., description="Calendar ID to add recurring meals to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a recurring meal for a specific day of the week."""
    # Verify calendar access
    require_calendar_access(db, calendar_id, current_user, edit_required=True)

    # Verify recipe access
    verify_recipe_access(db, data.recipe_id, current_user)

    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Limit to max 52 weeks (1 year)
    if (data.end_date - data.start_date).days > 365:
        raise HTTPException(status_code=400, detail="Recurrence period cannot exceed 1 year")

    # Generate a recurrence ID to group these meals
    recurrence_id = str(uuid.uuid4())

    # Find all matching days in the range
    new_meals = []
    current = data.start_date

    # Find first matching day of week
    while current.weekday() != data.day_of_week:
        current += timedelta(days=1)
        if current > data.end_date:
            raise HTTPException(
                status_code=400,
                detail="No matching days found in the specified date range"
            )

    # Create meal for each matching day
    while current <= data.end_date:
        new_meal = MealPlanModel(
            calendar_id=calendar_id,
            recipe_id=data.recipe_id,
            planned_date=current,
            meal_type=data.meal_type,
            servings=data.servings,
            recurrence_id=recurrence_id
        )
        db.add(new_meal)
        new_meals.append(new_meal)
        current += timedelta(days=7)

    db.commit()

    # Refresh to get relationships
    for meal in new_meals:
        db.refresh(meal, ['recipe'])

    return new_meals


@router.delete("/recurring/{recurrence_id}")
async def delete_recurring_meals(
    recurrence_id: str,
    future_only: bool = Query(True, description="Only delete future instances"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all instances of a recurring meal."""
    # Get accessible calendar IDs
    accessible_ids = get_user_accessible_calendar_ids(db, current_user)

    query = db.query(MealPlanModel).filter(
        MealPlanModel.calendar_id.in_(accessible_ids),
        MealPlanModel.recurrence_id == recurrence_id
    )

    if future_only:
        query = query.filter(MealPlanModel.planned_date >= date.today())

    # Check that user has edit access to the calendar of these meals
    first_meal = query.first()
    if first_meal:
        require_calendar_access(db, first_meal.calendar_id, current_user, edit_required=True)

    count = query.count()

    if count == 0:
        raise HTTPException(status_code=404, detail="No recurring meals found")

    query.delete(synchronize_session=False)
    db.commit()

    return {"status": "deleted", "count": count}


@router.post("/swap")
async def swap_meals(
    meal_plan_id_1: str = Query(..., description="First meal plan ID"),
    meal_plan_id_2: str = Query(..., description="Second meal plan ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Swap two meals (exchange their dates and meal types)."""
    meal1 = db.query(MealPlanModel).filter(MealPlanModel.id == meal_plan_id_1).first()
    meal2 = db.query(MealPlanModel).filter(MealPlanModel.id == meal_plan_id_2).first()

    if not meal1 or not meal2:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")

    # Check edit access to both calendars
    require_calendar_access(db, meal1.calendar_id, current_user, edit_required=True)
    require_calendar_access(db, meal2.calendar_id, current_user, edit_required=True)

    # Swap date and meal_type
    meal1.planned_date, meal2.planned_date = meal2.planned_date, meal1.planned_date
    meal1.meal_type, meal2.meal_type = meal2.meal_type, meal1.meal_type

    db.commit()

    return {"status": "swapped"}
