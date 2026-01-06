"""
Grocery List Router

CRUD operations for grocery lists with sharing support.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Tuple
import secrets

from database import get_db
from auth import get_current_user
from models import User, GroceryList, GroceryListItem, GroceryListShare, Recipe
from schemas import (
    GroceryListResponse, GroceryListItemCreate, GroceryListItemUpdate,
    GroceryListItemResponse, GroceryListGenerateRequest, GroceryListBulkCheckRequest,
    GroceryListShareCreate, GroceryListShareUpdate, GroceryListShareResponse,
    GroceryListShareUser, SharedGroceryListAccess, SharedGroceryListOwner,
    SourceRecipeInfo,
)
from services.grocery_list_service import (
    get_or_create_grocery_list, get_grocery_list_with_items,
    clear_grocery_list, generate_from_meal_plan, group_items_by_category,
    normalize_ingredient_name, DEFAULT_CATEGORY
)

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
    Returns (grocery_list, permission) where permission is 'owner', 'editor', 'viewer', or None.
    """
    grocery_list = db.query(GroceryList).filter(GroceryList.id == grocery_list_id).first()

    if not grocery_list:
        return None, None

    # Owner has full access
    if grocery_list.user_id == user.id:
        return grocery_list, "owner"

    # Check if shared with user
    share = db.query(GroceryListShare).filter(
        GroceryListShare.grocery_list_id == grocery_list_id,
        GroceryListShare.user_id == user.id
    ).first()

    if share:
        return grocery_list, share.permission

    return grocery_list, None


def require_grocery_list_access(
    db: Session,
    grocery_list_id: str,
    user: User,
    min_permission: str = "viewer"
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

    # Permission hierarchy: owner > editor > viewer
    permission_levels = {"viewer": 1, "editor": 2, "owner": 3}

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


# ============================================================================
# GROCERY LIST ENDPOINTS
# ============================================================================

@router.get("", response_model=GroceryListResponse)
async def get_grocery_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's grocery list, creating one if it doesn't exist."""
    grocery_list = get_or_create_grocery_list(db, current_user)

    # Reload with relationships
    grocery_list = db.query(GroceryList).options(
        joinedload(GroceryList.items),
        joinedload(GroceryList.shares).joinedload(GroceryListShare.user)
    ).filter(GroceryList.id == grocery_list.id).first()

    return build_grocery_list_response(grocery_list, db)


@router.post("/generate", response_model=GroceryListResponse)
async def generate_grocery_list(
    request: GroceryListGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate grocery list from meal plan for date range."""
    if request.end_date < request.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Limit date range to 90 days
    days_diff = (request.end_date - request.start_date).days
    if days_diff > 90:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    grocery_list = generate_from_meal_plan(
        db=db,
        user=current_user,
        start_date=request.start_date,
        end_date=request.end_date,
        merge=request.merge
    )

    # Reload with relationships
    grocery_list = db.query(GroceryList).options(
        joinedload(GroceryList.items),
        joinedload(GroceryList.shares).joinedload(GroceryListShare.user)
    ).filter(GroceryList.id == grocery_list.id).first()

    return build_grocery_list_response(grocery_list, db)


@router.delete("/clear")
async def clear_list(
    checked_only: bool = Query(False, description="Only clear checked items"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear all items from grocery list, or just checked items."""
    grocery_list = get_or_create_grocery_list(db, current_user)
    count = clear_grocery_list(db, grocery_list, checked_only=checked_only)
    return {"deleted": count}


# ============================================================================
# ITEM ENDPOINTS
# ============================================================================

@router.post("/items", response_model=GroceryListItemResponse, status_code=201)
async def add_item(
    item_data: GroceryListItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a manual item to the grocery list."""
    grocery_list = get_or_create_grocery_list(db, current_user)

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


@router.patch("/items/{item_id}", response_model=GroceryListItemResponse)
async def update_item(
    item_id: str,
    item_data: GroceryListItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a grocery list item."""
    grocery_list = get_or_create_grocery_list(db, current_user)

    item = db.query(GroceryListItem).filter(
        GroceryListItem.id == item_id,
        GroceryListItem.grocery_list_id == grocery_list.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return GroceryListItemResponse.model_validate(item)


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a grocery list item."""
    grocery_list = get_or_create_grocery_list(db, current_user)

    item = db.query(GroceryListItem).filter(
        GroceryListItem.id == item_id,
        GroceryListItem.grocery_list_id == grocery_list.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()

    return {"deleted": True}


@router.patch("/items/bulk-check")
async def bulk_check_items(
    request: GroceryListBulkCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk check/uncheck multiple items."""
    grocery_list = get_or_create_grocery_list(db, current_user)

    updated = db.query(GroceryListItem).filter(
        GroceryListItem.grocery_list_id == grocery_list.id,
        GroceryListItem.id.in_(request.item_ids)
    ).update({GroceryListItem.is_checked: request.is_checked}, synchronize_session=False)

    db.commit()

    return {"updated": updated}


# ============================================================================
# SHARING ENDPOINTS
# ============================================================================

@router.get("/shares", response_model=List[GroceryListShareResponse])
async def list_shares(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all users the grocery list is shared with."""
    grocery_list = get_or_create_grocery_list(db, current_user)

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
            created_at=share.created_at,
            user=GroceryListShareUser(
                id=share.user.id,
                name=share.user.name,
                profile_image_url=share.user.profile_image_url
            )
        )
        for share in shares
    ]


@router.post("/shares", response_model=GroceryListShareResponse, status_code=201)
async def share_grocery_list(
    share_data: GroceryListShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Share grocery list with another user."""
    grocery_list = get_or_create_grocery_list(db, current_user)

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
        permission=share_data.permission
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    return GroceryListShareResponse(
        id=share.id,
        user_id=share.user_id,
        permission=share.permission,
        created_at=share.created_at,
        user=GroceryListShareUser(
            id=target_user.id,
            name=target_user.name,
            profile_image_url=target_user.profile_image_url
        )
    )


@router.put("/shares/{user_id}", response_model=GroceryListShareResponse)
async def update_share(
    user_id: str,
    share_data: GroceryListShareUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update permission for a shared user."""
    grocery_list = get_or_create_grocery_list(db, current_user)

    share = db.query(GroceryListShare).options(
        joinedload(GroceryListShare.user)
    ).filter(
        GroceryListShare.grocery_list_id == grocery_list.id,
        GroceryListShare.user_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    share.permission = share_data.permission
    db.commit()
    db.refresh(share)

    return GroceryListShareResponse(
        id=share.id,
        user_id=share.user_id,
        permission=share.permission,
        created_at=share.created_at,
        user=GroceryListShareUser(
            id=share.user.id,
            name=share.user.name,
            profile_image_url=share.user.profile_image_url
        )
    )


@router.delete("/shares/{user_id}")
async def remove_share(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove sharing with a user."""
    grocery_list = get_or_create_grocery_list(db, current_user)

    share = db.query(GroceryListShare).filter(
        GroceryListShare.grocery_list_id == grocery_list.id,
        GroceryListShare.user_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()

    return {"deleted": True}


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
            owner=SharedGroceryListOwner(
                id=share.grocery_list.user.id,
                name=share.grocery_list.user.name,
                profile_image_url=share.grocery_list.user.profile_image_url
            ),
            permission=share.permission,
            created_at=share.created_at
        )
        for share in shares
    ]


@router.delete("/shares/leave/{owner_id}")
async def leave_shared_list(
    owner_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave a grocery list that was shared with you."""
    # Find the share for this owner's grocery list
    share = db.query(GroceryListShare).join(GroceryList).filter(
        GroceryList.user_id == owner_id,
        GroceryListShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Shared list not found")

    db.delete(share)
    db.commit()

    return {"left": True}


@router.get("/shared/{owner_id}", response_model=GroceryListResponse)
async def get_shared_grocery_list(
    owner_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a grocery list that was shared with you."""
    # Find the owner's grocery list
    grocery_list = db.query(GroceryList).filter(
        GroceryList.user_id == owner_id
    ).first()

    if not grocery_list:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    # Check if shared with current user
    share = db.query(GroceryListShare).filter(
        GroceryListShare.grocery_list_id == grocery_list.id,
        GroceryListShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Grocery list not found")

    # Reload with relationships
    grocery_list = db.query(GroceryList).options(
        joinedload(GroceryList.items),
        joinedload(GroceryList.shares).joinedload(GroceryListShare.user)
    ).filter(GroceryList.id == grocery_list.id).first()

    return build_grocery_list_response(grocery_list, db)


# ============================================================================
# PUBLIC SHARE ENDPOINTS
# ============================================================================

@router.post("/share-link")
async def get_or_create_share_link(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get or create a public share link for the grocery list."""
    grocery_list = get_or_create_grocery_list(db, current_user)

    # Generate token if not exists
    if not grocery_list.share_token:
        grocery_list.share_token = secrets.token_urlsafe(16)
        db.commit()
        db.refresh(grocery_list)

    return {"share_token": grocery_list.share_token}


@router.delete("/share-link")
async def disable_share_link(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disable the public share link by removing the token."""
    grocery_list = get_or_create_grocery_list(db, current_user)

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
