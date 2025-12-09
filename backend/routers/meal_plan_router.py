"""
Meal Plan Router

CRUD operations for meal planning - scheduling recipes on specific dates.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, timedelta
import uuid

from database import get_db
from auth import get_current_user
from models import User, Recipe, MealPlan as MealPlanModel, MealPlanShare as MealPlanShareModel
from schemas import (
    MealPlanCreate, MealPlanUpdate, MealPlan as MealPlanSchema,
    MealPlanMove, MealPlanCopy, MealPlanRecurring,
    MealPlanListResponse,
    MealPlanShareCreate, MealPlanShareUpdate, MealPlanShareResponse, SharedMealPlanAccess,
)

router = APIRouter(prefix="/meal-plan", tags=["meal-plan"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_meal_plan_or_404(db: Session, meal_plan_id: str, user: User) -> MealPlanModel:
    """Get a meal plan entry owned by the user or raise 404."""
    meal_plan = db.query(MealPlanModel).filter(
        MealPlanModel.id == meal_plan_id,
        MealPlanModel.user_id == user.id
    ).first()

    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")

    return meal_plan


def verify_recipe_access(db: Session, recipe_id: str, user: User) -> Recipe:
    """Verify user can access the recipe (owns it or it's public)."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # User can add their own recipes or public recipes to their meal plan
    if recipe.author_id != user.id and recipe.privacy_level != "public":
        raise HTTPException(status_code=403, detail="Cannot add this recipe to meal plan")

    return recipe


def get_meal_plan_access(db: Session, owner_id: str, user: User) -> Optional[str]:
    """
    Check if user has access to another user's meal plan.
    Returns permission level ('viewer', 'editor') or None.
    """
    if owner_id == user.id:
        return "owner"

    share = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.owner_id == owner_id,
        MealPlanShareModel.shared_with_id == user.id
    ).first()

    return share.permission if share else None


def require_meal_plan_edit_access(db: Session, owner_id: str, user: User) -> None:
    """Verify user has edit access to the meal plan (owner or editor)."""
    permission = get_meal_plan_access(db, owner_id, user)
    if permission not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Edit access required")


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("", response_model=MealPlanListResponse)
async def list_meal_plans(
    start: date = Query(..., description="Start date (inclusive)"),
    end: date = Query(..., description="End date (inclusive)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all meal plan entries for a date range."""
    if end < start:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Limit range to prevent abuse (max 90 days)
    if (end - start).days > 90:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    meal_plans = db.query(MealPlanModel).options(
        joinedload(MealPlanModel.recipe)
    ).filter(
        MealPlanModel.user_id == current_user.id,
        MealPlanModel.planned_date >= start,
        MealPlanModel.planned_date <= end
    ).order_by(
        MealPlanModel.planned_date,
        MealPlanModel.meal_type
    ).all()

    return MealPlanListResponse(
        items=meal_plans,
        start_date=start,
        end_date=end
    )


@router.post("", response_model=MealPlanSchema)
async def create_meal_plan(
    data: MealPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a recipe to the meal plan."""
    # Verify recipe exists and user can access it
    verify_recipe_access(db, data.recipe_id, current_user)

    meal_plan = MealPlanModel(
        user_id=current_user.id,
        recipe_id=data.recipe_id,
        planned_date=data.planned_date,
        meal_type=data.meal_type,
        servings=data.servings,
        notes=data.notes
    )

    db.add(meal_plan)
    db.commit()
    db.refresh(meal_plan)

    # Load recipe relationship for response
    db.refresh(meal_plan, ['recipe'])

    return meal_plan


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
        MealPlanModel.id == meal_plan_id,
        MealPlanModel.user_id == current_user.id
    ).first()

    if not meal_plan:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")

    return meal_plan


@router.patch("/{meal_plan_id}", response_model=MealPlanSchema)
async def update_meal_plan(
    meal_plan_id: str,
    data: MealPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a meal plan entry (date, meal type, servings, notes)."""
    meal_plan = get_meal_plan_or_404(db, meal_plan_id, current_user)

    update_data = data.model_dump(exclude_unset=True)
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
    meal_plan = get_meal_plan_or_404(db, meal_plan_id, current_user)

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
    meal_plan = get_meal_plan_or_404(db, meal_plan_id, current_user)

    meal_plan.planned_date = data.planned_date
    meal_plan.meal_type = data.meal_type

    db.commit()
    db.refresh(meal_plan, ['recipe'])

    return meal_plan


@router.post("/copy", response_model=List[MealPlanSchema])
async def copy_meal_plans(
    data: MealPlanCopy,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Copy meals from one date range to another, maintaining day offsets."""
    if data.source_end < data.source_start:
        raise HTTPException(status_code=400, detail="Source end date must be after start date")

    # Get source meals
    source_meals = db.query(MealPlanModel).filter(
        MealPlanModel.user_id == current_user.id,
        MealPlanModel.planned_date >= data.source_start,
        MealPlanModel.planned_date <= data.source_end
    ).all()

    if not source_meals:
        raise HTTPException(status_code=400, detail="No meals found in source date range")

    # Create copies with adjusted dates
    new_meals = []
    for source in source_meals:
        day_offset = (source.planned_date - data.source_start).days
        new_date = data.target_start + timedelta(days=day_offset)

        new_meal = MealPlanModel(
            user_id=current_user.id,
            recipe_id=source.recipe_id,
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a recurring meal for a specific day of the week."""
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
            user_id=current_user.id,
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
    query = db.query(MealPlanModel).filter(
        MealPlanModel.user_id == current_user.id,
        MealPlanModel.recurrence_id == recurrence_id
    )

    if future_only:
        query = query.filter(MealPlanModel.planned_date >= date.today())

    count = query.count()

    if count == 0:
        raise HTTPException(status_code=404, detail="No recurring meals found")

    query.delete()
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
    meal1 = get_meal_plan_or_404(db, meal_plan_id_1, current_user)
    meal2 = get_meal_plan_or_404(db, meal_plan_id_2, current_user)

    # Swap date and meal_type
    meal1.planned_date, meal2.planned_date = meal2.planned_date, meal1.planned_date
    meal1.meal_type, meal2.meal_type = meal2.meal_type, meal1.meal_type

    db.commit()

    return {"status": "swapped"}


# ============================================================================
# SHARING ENDPOINTS
# ============================================================================

@router.get("/shared-with-me", response_model=List[SharedMealPlanAccess])
async def list_shared_with_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List meal plans shared with the current user."""
    shares = db.query(MealPlanShareModel).options(
        joinedload(MealPlanShareModel.owner)
    ).filter(
        MealPlanShareModel.shared_with_id == current_user.id
    ).all()

    return shares


@router.get("/shared/{user_id}", response_model=MealPlanListResponse)
async def get_shared_meal_plan(
    user_id: str,
    start: date = Query(..., description="Start date (inclusive)"),
    end: date = Query(..., description="End date (inclusive)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """View another user's meal plan (if shared with you)."""
    permission = get_meal_plan_access(db, user_id, current_user)
    if not permission:
        raise HTTPException(status_code=403, detail="No access to this meal plan")

    if end < start:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    if (end - start).days > 90:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    meal_plans = db.query(MealPlanModel).options(
        joinedload(MealPlanModel.recipe)
    ).filter(
        MealPlanModel.user_id == user_id,
        MealPlanModel.planned_date >= start,
        MealPlanModel.planned_date <= end
    ).order_by(
        MealPlanModel.planned_date,
        MealPlanModel.meal_type
    ).all()

    return MealPlanListResponse(
        items=meal_plans,
        start_date=start,
        end_date=end
    )


@router.get("/shares", response_model=List[MealPlanShareResponse])
async def list_shares(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List users you've shared your meal plan with."""
    shares = db.query(MealPlanShareModel).options(
        joinedload(MealPlanShareModel.shared_with)
    ).filter(
        MealPlanShareModel.owner_id == current_user.id
    ).all()

    return shares


@router.post("/shares", response_model=MealPlanShareResponse)
async def share_meal_plan(
    data: MealPlanShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Share your meal plan with another user."""
    # Can't share with yourself
    if data.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    # Check user exists
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check not already shared
    existing = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.owner_id == current_user.id,
        MealPlanShareModel.shared_with_id == data.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")

    share = MealPlanShareModel(
        owner_id=current_user.id,
        shared_with_id=data.user_id,
        permission=data.permission
    )
    db.add(share)
    db.commit()
    db.refresh(share, ['shared_with'])

    return share


@router.put("/shares/{user_id}", response_model=MealPlanShareResponse)
async def update_share(
    user_id: str,
    data: MealPlanShareUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update permission for a shared user."""
    share = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.owner_id == current_user.id,
        MealPlanShareModel.shared_with_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    share.permission = data.permission
    db.commit()
    db.refresh(share, ['shared_with'])

    return share


@router.delete("/shares/{user_id}")
async def remove_share(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stop sharing your meal plan with a user."""
    share = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.owner_id == current_user.id,
        MealPlanShareModel.shared_with_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()

    return {"status": "removed"}


@router.delete("/shares/leave/{owner_id}")
async def leave_shared_meal_plan(
    owner_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave a meal plan that was shared with you."""
    share = db.query(MealPlanShareModel).filter(
        MealPlanShareModel.owner_id == owner_id,
        MealPlanShareModel.shared_with_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()

    return {"status": "left"}
