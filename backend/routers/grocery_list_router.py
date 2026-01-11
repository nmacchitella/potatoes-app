"""
Grocery List Router

CRUD operations for grocery lists with sharing support.
Users can have multiple grocery lists.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.background import BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional, Tuple
import secrets
import os

from database import get_db
from auth import get_current_user, get_current_user_optional
from models import User, GroceryList, GroceryListItem, GroceryListShare, Recipe, Notification, Ingredient
from schemas import (
    GroceryListResponse, GroceryListItemCreate, GroceryListItemUpdate,
    GroceryListItemResponse, GroceryListGenerateRequest, GroceryListBulkCheckRequest,
    GroceryListShareCreate, GroceryListShareUpdate, GroceryListShareResponse,
    GroceryListShareUser, SharedGroceryListAccess, SharedGroceryListOwner,
    SourceRecipeInfo, GroceryListCreate, GroceryListUpdate, GroceryListSummary,
    GroceryListEmailShareRequest, GroceryListEmailShareResponse,
    GroceryListAcceptPublicShareResponse,
)
from services.grocery_list_service import (
    clear_grocery_list, generate_from_meal_plan, group_items_by_category,
    DEFAULT_CATEGORY, normalize_ingredient_name
)
from services.email_service import EmailService

router = APIRouter(prefix="/grocery-list", tags=["grocery-list"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_grocery_list_access(
    db: Session,
    grocery_list_id: str,
    user: User
) -> Tuple[Optional[GroceryList], Optional[str]]:
    """
    Check if user has access to a grocery list and return the permission level.
    Returns (grocery_list, permission) where permission is 'owner', 'editor', or None.
    """
    grocery_list = db.query(GroceryList).filter(GroceryList.id == grocery_list_id).first()

    if not grocery_list:
        return None, None

    # Owner has full access
    if grocery_list.user_id == user.id:
        return grocery_list, "owner"

    # Check if shared with user (and accepted)
    share = db.query(GroceryListShare).filter(
        GroceryListShare.grocery_list_id == grocery_list_id,
        GroceryListShare.user_id == user.id,
        GroceryListShare.status == "accepted"
    ).first()

    if share:
        return grocery_list, share.permission

    return grocery_list, None


def require_grocery_list_access(
    db: Session,
    grocery_list_id: str,
    user: User,
    min_permission: str = "editor"
) -> Tuple[GroceryList, str]:
    """
    Get grocery list and verify user has at least the minimum permission level.
    Raises HTTPException if not found or insufficient permissions.
    """
    grocery_list, permission = get_grocery_list_access(db, grocery_list_id, user)

    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    if not permission:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    # Permission hierarchy: editor > owner (owner can do everything editor can plus more)
    permission_levels = {"editor": 1, "owner": 2}

    if permission_levels.get(permission, 0) < permission_levels.get(min_permission, 0):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    return grocery_list, permission


def build_grocery_list_response(grocery_list: GroceryList, db: Session) -> GroceryListResponse:
    """Build full grocery list response with items grouped by category."""
    # Collect all recipe IDs from items
    all_recipe_ids = set()
    for item in grocery_list.items:
        if item.source_recipe_ids:
            all_recipe_ids.update(item.source_recipe_ids)

    # Fetch recipe titles in one query
    recipe_titles = {}
    if all_recipe_ids:
        recipes = db.query(Recipe.id, Recipe.title).filter(Recipe.id.in_(all_recipe_ids)).all()
        recipe_titles = {r.id: r.title for r in recipes}

    def build_item_response(item: GroceryListItem) -> GroceryListItemResponse:
        source_recipes = []
        if item.source_recipe_ids:
            for recipe_id in item.source_recipe_ids:
                if recipe_id in recipe_titles:
                    source_recipes.append(SourceRecipeInfo(id=recipe_id, title=recipe_titles[recipe_id]))
        return GroceryListItemResponse(
            id=item.id,
            name=item.name,
            quantity=item.quantity,
            unit=item.unit,
            category=item.category,
            is_checked=item.is_checked,
            is_staple=item.is_staple,
            is_manual=item.is_manual,
            source_recipe_ids=item.source_recipe_ids,
            source_recipes=source_recipes,
            sort_order=item.sort_order,
            created_at=item.created_at
        )

    items = [build_item_response(item) for item in grocery_list.items]
    items_by_category = {}

    for cat, cat_items in group_items_by_category(grocery_list.items).items():
        items_by_category[cat] = [build_item_response(item) for item in cat_items]

    shares = []
    for share in grocery_list.shares:
        share_response = GroceryListShareResponse(
            id=share.id,
            user_id=share.user_id,
            permission=share.permission,
            status=share.status,
            created_at=share.created_at,
            user=GroceryListShareUser(
                id=share.user.id,
                name=share.user.name,
                profile_image_url=share.user.profile_image_url
            )
        )
        shares.append(share_response)

    return GroceryListResponse(
        id=grocery_list.id,
        name=grocery_list.name,
        items=items,
        items_by_category=items_by_category,
        shares=shares,
        created_at=grocery_list.created_at,
        updated_at=grocery_list.updated_at
    )


def create_share_notification(db: Session, share: GroceryListShare, grocery_list: GroceryList, owner: User):
    """Create a notification for a new grocery list share invitation."""
    notification = Notification(
        user_id=share.user_id,
        type="grocery_share_invitation",
        title="Grocery List Shared",
        message=f"{owner.name} wants to share their grocery list \"{grocery_list.name}\" with you",
        link="/grocery",
        data={
            "share_id": share.id,
            "grocery_list_id": grocery_list.id,
            "grocery_list_name": grocery_list.name,
            "owner_id": owner.id,
            "owner_name": owner.name,
        }
    )
    db.add(notification)


# ============================================================================
# GROCERY LIST CRUD ENDPOINTS
# ============================================================================

@router.get("", response_model=List[GroceryListSummary])
async def list_grocery_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all grocery lists owned by the current user."""
    grocery_lists = db.query(GroceryList).filter(
        GroceryList.user_id == current_user.id
    ).order_by(GroceryList.created_at.desc()).all()

    # Create a default list if user has none
    if not grocery_lists:
        default_list = GroceryList(
            user_id=current_user.id,
            name="Grocery List"
        )
        db.add(default_list)
        db.commit()
        db.refresh(default_list)
        grocery_lists = [default_list]

    # Get item counts and share counts
    result = []
    for gl in grocery_lists:
        item_count = db.query(func.count(GroceryListItem.id)).filter(
            GroceryListItem.grocery_list_id == gl.id
        ).scalar()
        share_count = db.query(func.count(GroceryListShare.id)).filter(
            GroceryListShare.grocery_list_id == gl.id
        ).scalar()
        result.append(GroceryListSummary(
            id=gl.id,
            name=gl.name,
            item_count=item_count,
            share_count=share_count,
            share_token=gl.share_token,
            created_at=gl.created_at,
            updated_at=gl.updated_at
        ))

    return result


@router.post("", response_model=GroceryListSummary, status_code=201)
async def create_grocery_list(
    data: GroceryListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new grocery list."""
    grocery_list = GroceryList(
        user_id=current_user.id,
        name=data.name
    )
    db.add(grocery_list)
    db.commit()
    db.refresh(grocery_list)

    return GroceryListSummary(
        id=grocery_list.id,
        name=grocery_list.name,
        item_count=0,
        share_token=grocery_list.share_token,
        created_at=grocery_list.created_at,
        updated_at=grocery_list.updated_at
    )


@router.get("/shared-with-me", response_model=List[SharedGroceryListAccess])
async def list_shared_with_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List grocery lists shared with the current user."""
    shares = db.query(GroceryListShare).options(
        joinedload(GroceryListShare.grocery_list).joinedload(GroceryList.user)
    ).filter(
        GroceryListShare.user_id == current_user.id
    ).all()

    return [
        SharedGroceryListAccess(
            id=share.id,
            grocery_list_id=share.grocery_list.id,
            grocery_list_name=share.grocery_list.name,
            owner=SharedGroceryListOwner(
                id=share.grocery_list.user.id,
                name=share.grocery_list.user.name,
                profile_image_url=share.grocery_list.user.profile_image_url
            ),
            permission=share.permission,
            status=share.status,
            created_at=share.created_at
        )
        for share in shares
    ]


@router.get("/{list_id}", response_model=GroceryListResponse)
async def get_grocery_list(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific grocery list by ID."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "editor")

    # Reload with relationships
    grocery_list = db.query(GroceryList).options(
        joinedload(GroceryList.items),
        joinedload(GroceryList.shares).joinedload(GroceryListShare.user)
    ).filter(GroceryList.id == grocery_list.id).first()

    return build_grocery_list_response(grocery_list, db)


@router.patch("/{list_id}", response_model=GroceryListSummary)
async def update_grocery_list(
    list_id: str,
    data: GroceryListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a grocery list (rename). Only owner can do this."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "owner")

    if data.name is not None:
        grocery_list.name = data.name

    db.commit()
    db.refresh(grocery_list)

    item_count = db.query(func.count(GroceryListItem.id)).filter(
        GroceryListItem.grocery_list_id == grocery_list.id
    ).scalar()

    return GroceryListSummary(
        id=grocery_list.id,
        name=grocery_list.name,
        item_count=item_count,
        share_token=grocery_list.share_token,
        created_at=grocery_list.created_at,
        updated_at=grocery_list.updated_at
    )


@router.delete("/{list_id}")
async def delete_grocery_list(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a grocery list. Only owner can do this."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "owner")

    db.delete(grocery_list)
    db.commit()

    return {"deleted": True}


# ============================================================================
# GENERATE FROM MEAL PLAN
# ============================================================================

@router.post("/{list_id}/generate", response_model=GroceryListResponse)
async def generate_grocery_list(
    list_id: str,
    request: GroceryListGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate grocery list items from meal plan for date range."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "editor")

    if request.end_date < request.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Limit date range to 90 days
    days_diff = (request.end_date - request.start_date).days
    if days_diff > 90:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    grocery_list = generate_from_meal_plan(
        db=db,
        grocery_list=grocery_list,
        user=current_user,
        start_date=request.start_date,
        end_date=request.end_date,
        merge=request.merge,
        calendar_ids=request.calendar_ids
    )

    # Reload with relationships
    grocery_list = db.query(GroceryList).options(
        joinedload(GroceryList.items),
        joinedload(GroceryList.shares).joinedload(GroceryListShare.user)
    ).filter(GroceryList.id == grocery_list.id).first()

    return build_grocery_list_response(grocery_list, db)


@router.delete("/{list_id}/clear")
async def clear_list(
    list_id: str,
    checked_only: bool = Query(False, description="Only clear checked items"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear all items from grocery list, or just checked items."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "editor")
    count = clear_grocery_list(db, grocery_list, checked_only=checked_only)
    return {"deleted": count}


# ============================================================================
# ITEM ENDPOINTS
# ============================================================================

@router.post("/{list_id}/items", response_model=GroceryListItemResponse, status_code=201)
async def add_item(
    list_id: str,
    item_data: GroceryListItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a manual item to the grocery list."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "editor")

    # Get max sort_order
    max_order = db.query(GroceryListItem).filter(
        GroceryListItem.grocery_list_id == grocery_list.id
    ).count()

    item = GroceryListItem(
        grocery_list_id=grocery_list.id,
        name=item_data.name,
        quantity=item_data.quantity,
        unit=item_data.unit,
        category=item_data.category or DEFAULT_CATEGORY,
        is_manual=True,
        sort_order=max_order
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return GroceryListItemResponse.model_validate(item)


@router.patch("/{list_id}/items/{item_id}", response_model=GroceryListItemResponse)
async def update_item(
    list_id: str,
    item_id: str,
    item_data: GroceryListItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a grocery list item."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "editor")

    item = db.query(GroceryListItem).filter(
        GroceryListItem.id == item_id,
        GroceryListItem.grocery_list_id == grocery_list.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)

    # If category is being updated, also update the master Ingredient
    if "category" in update_data and update_data["category"]:
        new_category = update_data["category"]
        normalized_name = normalize_ingredient_name(item.name)

        # First check for user's custom ingredient
        user_ingredient = db.query(Ingredient).filter(
            Ingredient.user_id == current_user.id,
            Ingredient.normalized_name == normalized_name
        ).first()

        if user_ingredient:
            # Update user's custom ingredient
            user_ingredient.category = new_category
        else:
            # Check for system ingredient
            system_ingredient = db.query(Ingredient).filter(
                Ingredient.is_system == True,
                Ingredient.normalized_name == normalized_name
            ).first()

            if system_ingredient:
                # Create a user-specific copy with the new category
                user_ingredient = Ingredient(
                    name=system_ingredient.name,
                    normalized_name=normalized_name,
                    category=new_category,
                    is_system=False,
                    user_id=current_user.id,
                )
                db.add(user_ingredient)
            else:
                # No existing ingredient - create a new user ingredient
                user_ingredient = Ingredient(
                    name=item.name,
                    normalized_name=normalized_name,
                    category=new_category,
                    is_system=False,
                    user_id=current_user.id,
                )
                db.add(user_ingredient)

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return GroceryListItemResponse.model_validate(item)


@router.delete("/{list_id}/items/{item_id}")
async def delete_item(
    list_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a grocery list item."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "editor")

    item = db.query(GroceryListItem).filter(
        GroceryListItem.id == item_id,
        GroceryListItem.grocery_list_id == grocery_list.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()

    return {"deleted": True}


@router.patch("/{list_id}/items/bulk-check")
async def bulk_check_items(
    list_id: str,
    request: GroceryListBulkCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk check/uncheck multiple items."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "editor")

    updated = db.query(GroceryListItem).filter(
        GroceryListItem.grocery_list_id == grocery_list.id,
        GroceryListItem.id.in_(request.item_ids)
    ).update({GroceryListItem.is_checked: request.is_checked}, synchronize_session=False)

    db.commit()

    return {"updated": updated}


# ============================================================================
# SHARING ENDPOINTS
# ============================================================================

@router.get("/{list_id}/shares", response_model=List[GroceryListShareResponse])
async def list_shares(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all users the grocery list is shared with. Only owner can see this."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "owner")

    shares = db.query(GroceryListShare).options(
        joinedload(GroceryListShare.user)
    ).filter(
        GroceryListShare.grocery_list_id == grocery_list.id
    ).all()

    return [
        GroceryListShareResponse(
            id=share.id,
            user_id=share.user_id,
            permission=share.permission,
            status=share.status,
            created_at=share.created_at,
            user=GroceryListShareUser(
                id=share.user.id,
                name=share.user.name,
                profile_image_url=share.user.profile_image_url
            )
        )
        for share in shares
    ]


@router.post("/{list_id}/shares", response_model=GroceryListShareResponse, status_code=201)
async def share_grocery_list(
    list_id: str,
    share_data: GroceryListShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Share grocery list with another user. Only owner can do this."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "owner")

    # Can't share with yourself
    if share_data.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    # Check if user exists
    target_user = db.query(User).filter(User.id == share_data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already shared
    existing = db.query(GroceryListShare).filter(
        GroceryListShare.grocery_list_id == grocery_list.id,
        GroceryListShare.user_id == share_data.user_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")

    share = GroceryListShare(
        grocery_list_id=grocery_list.id,
        user_id=share_data.user_id,
        permission="editor",  # Always editor for user shares
        status="pending"
    )
    db.add(share)

    # Create notification for the target user
    create_share_notification(db, share, grocery_list, current_user)

    db.commit()
    db.refresh(share)

    return GroceryListShareResponse(
        id=share.id,
        user_id=share.user_id,
        permission=share.permission,
        status=share.status,
        created_at=share.created_at,
        user=GroceryListShareUser(
            id=target_user.id,
            name=target_user.name,
            profile_image_url=target_user.profile_image_url
        )
    )


@router.delete("/{list_id}/shares/{user_id}")
async def remove_share(
    list_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove sharing with a user. Only owner can do this."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "owner")

    share = db.query(GroceryListShare).filter(
        GroceryListShare.grocery_list_id == grocery_list.id,
        GroceryListShare.user_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()

    return {"deleted": True}


# ============================================================================
# SHARE INVITATION ENDPOINTS
# ============================================================================

@router.post("/shares/{share_id}/accept")
async def accept_share(
    share_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Accept a grocery list share invitation."""
    share = db.query(GroceryListShare).filter(
        GroceryListShare.id == share_id,
        GroceryListShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share invitation not found")

    if share.status != "pending":
        raise HTTPException(status_code=400, detail="Invitation already responded to")

    share.status = "accepted"
    db.commit()

    return {"accepted": True}


@router.post("/shares/{share_id}/decline")
async def decline_share(
    share_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Decline a grocery list share invitation."""
    share = db.query(GroceryListShare).filter(
        GroceryListShare.id == share_id,
        GroceryListShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share invitation not found")

    if share.status != "pending":
        raise HTTPException(status_code=400, detail="Invitation already responded to")

    share.status = "declined"
    db.commit()

    return {"declined": True}


@router.delete("/shares/{share_id}/leave")
async def leave_shared_list(
    share_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave a grocery list that was shared with you."""
    share = db.query(GroceryListShare).filter(
        GroceryListShare.id == share_id,
        GroceryListShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Shared list not found")

    db.delete(share)
    db.commit()

    return {"left": True}


# ============================================================================
# PUBLIC SHARE ENDPOINTS
# ============================================================================

@router.post("/{list_id}/share-link")
async def get_or_create_share_link(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get or create a public share link for the grocery list. Only owner can do this."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "owner")

    # Generate token if not exists
    if not grocery_list.share_token:
        grocery_list.share_token = secrets.token_urlsafe(16)
        db.commit()
        db.refresh(grocery_list)

    return {"share_token": grocery_list.share_token}


@router.delete("/{list_id}/share-link")
async def disable_share_link(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disable the public share link by removing the token. Only owner can do this."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "owner")

    grocery_list.share_token = None
    db.commit()

    return {"disabled": True}


@router.get("/public/{token}", response_model=GroceryListResponse)
async def get_public_grocery_list(
    token: str,
    db: Session = Depends(get_db)
):
    """Get a grocery list by public share token. No authentication required."""
    grocery_list = db.query(GroceryList).options(
        joinedload(GroceryList.items),
        joinedload(GroceryList.user)
    ).filter(
        GroceryList.share_token == token
    ).first()

    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    # Build a simplified response without shares info
    all_recipe_ids = set()
    for item in grocery_list.items:
        if item.source_recipe_ids:
            all_recipe_ids.update(item.source_recipe_ids)

    recipe_titles = {}
    if all_recipe_ids:
        recipes = db.query(Recipe.id, Recipe.title).filter(Recipe.id.in_(all_recipe_ids)).all()
        recipe_titles = {r.id: r.title for r in recipes}

    def build_item_response(item: GroceryListItem) -> GroceryListItemResponse:
        source_recipes = []
        if item.source_recipe_ids:
            for recipe_id in item.source_recipe_ids:
                if recipe_id in recipe_titles:
                    source_recipes.append(SourceRecipeInfo(id=recipe_id, title=recipe_titles[recipe_id]))
        return GroceryListItemResponse(
            id=item.id,
            name=item.name,
            quantity=item.quantity,
            unit=item.unit,
            category=item.category,
            is_checked=item.is_checked,
            is_staple=item.is_staple,
            is_manual=item.is_manual,
            source_recipe_ids=item.source_recipe_ids,
            source_recipes=source_recipes,
            sort_order=item.sort_order,
            created_at=item.created_at
        )

    items = [build_item_response(item) for item in grocery_list.items]
    items_by_category = {}

    for cat, cat_items in group_items_by_category(grocery_list.items).items():
        items_by_category[cat] = [build_item_response(item) for item in cat_items]

    return GroceryListResponse(
        id=grocery_list.id,
        name=grocery_list.name,
        items=items,
        items_by_category=items_by_category,
        shares=[],  # Don't expose shares to public
        created_at=grocery_list.created_at,
        updated_at=grocery_list.updated_at
    )


@router.post("/public/{token}/accept", response_model=GroceryListAcceptPublicShareResponse)
async def accept_public_share(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Accept a public share link and add the list to the user's shared lists."""
    # Find the grocery list by token
    grocery_list = db.query(GroceryList).filter(
        GroceryList.share_token == token
    ).first()

    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found or link is invalid")

    # Can't add your own list
    if grocery_list.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="This is your own grocery list")

    # Check if already shared with user
    existing_share = db.query(GroceryListShare).filter(
        GroceryListShare.grocery_list_id == grocery_list.id,
        GroceryListShare.user_id == current_user.id
    ).first()

    if existing_share:
        # Update status to accepted if it was pending
        if existing_share.status == "pending":
            existing_share.status = "accepted"
            db.commit()
        return GroceryListAcceptPublicShareResponse(
            grocery_list_id=grocery_list.id,
            grocery_list_name=grocery_list.name,
            already_had_access=True
        )

    # Create new share with accepted status (no invitation needed since they have the link)
    share = GroceryListShare(
        grocery_list_id=grocery_list.id,
        user_id=current_user.id,
        permission="editor",
        status="accepted"
    )
    db.add(share)
    db.commit()

    return GroceryListAcceptPublicShareResponse(
        grocery_list_id=grocery_list.id,
        grocery_list_name=grocery_list.name,
        already_had_access=False
    )


@router.post("/{list_id}/share-email", response_model=GroceryListEmailShareResponse)
async def share_via_email(
    list_id: str,
    data: GroceryListEmailShareRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Share grocery list via email. If the email belongs to an existing user, also creates a share invitation."""
    grocery_list, permission = require_grocery_list_access(db, list_id, current_user, "owner")

    # Can't share with yourself
    if data.email.lower() == current_user.email.lower():
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    # Generate share link
    if not grocery_list.share_token:
        grocery_list.share_token = secrets.token_urlsafe(16)
        db.commit()
        db.refresh(grocery_list)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    share_link = f"{frontend_url}/grocery/share/{grocery_list.share_token}"

    # Check if email belongs to existing user
    target_user = db.query(User).filter(
        func.lower(User.email) == data.email.lower()
    ).first()

    is_existing_user = target_user is not None

    if is_existing_user:
        # Check if already shared
        existing_share = db.query(GroceryListShare).filter(
            GroceryListShare.grocery_list_id == grocery_list.id,
            GroceryListShare.user_id == target_user.id
        ).first()

        if not existing_share:
            # Create share with pending status
            share = GroceryListShare(
                grocery_list_id=grocery_list.id,
                user_id=target_user.id,
                permission="editor",
                status="pending"
            )
            db.add(share)

            # Create notification
            create_share_notification(db, share, grocery_list, current_user)
            db.commit()

            message = f"Invitation sent to {data.email}. They'll see it in their Potatoes account."
        else:
            message = f"{data.email} already has access to this list."
    else:
        message = f"Email sent to {data.email} with a link to view the list."

    # Send email
    email_service = EmailService()
    await email_service.send_share_invitation_email(
        email=data.email,
        share_link=share_link,
        list_name=grocery_list.name,
        owner_name=current_user.name,
        is_existing_user=is_existing_user,
        background_tasks=background_tasks
    )

    return GroceryListEmailShareResponse(
        success=True,
        is_existing_user=is_existing_user,
        message=message
    )
