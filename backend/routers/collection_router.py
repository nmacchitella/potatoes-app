"""
Collection Router

CRUD operations for recipe collections with sharing support.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import List, Optional, Tuple

from database import get_db
from auth import get_current_user
from models import User, Collection, Recipe, collection_recipes, CollectionShare, Notification
from schemas import (
    CollectionCreate, CollectionUpdate, Collection as CollectionSchema,
    CollectionWithRecipes, RecipeSummary,
    CollectionShareCreate, CollectionShareUpdate, CollectionShare as CollectionShareSchema,
    CollectionShareUser, SharedCollection,
)

router = APIRouter(prefix="/collections", tags=["collections"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_collection_access(
    db: Session,
    collection_id: str,
    user: User
) -> Tuple[Optional[Collection], Optional[str]]:
    """
    Check if user has access to a collection and return the permission level.
    Returns (collection, permission) where permission is 'owner', 'editor', 'viewer', or None.
    """
    collection = db.query(Collection).filter(Collection.id == collection_id).first()

    if not collection:
        return None, None

    # Owner has full access
    if collection.user_id == user.id:
        return collection, "owner"

    # Check if shared with user
    share = db.query(CollectionShare).filter(
        CollectionShare.collection_id == collection_id,
        CollectionShare.user_id == user.id
    ).first()

    if share:
        return collection, share.permission

    return collection, None


def require_collection_access(
    db: Session,
    collection_id: str,
    user: User,
    min_permission: str = "viewer"
) -> Tuple[Collection, str]:
    """
    Get collection and verify user has at least the minimum permission level.
    Raises HTTPException if not found or insufficient permissions.
    """
    collection, permission = get_collection_access(db, collection_id, user)

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if not permission:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Permission hierarchy: owner > editor > viewer
    permission_levels = {"viewer": 1, "editor": 2, "owner": 3}

    if permission_levels.get(permission, 0) < permission_levels.get(min_permission, 0):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    return collection, permission


def can_share_collection(permission: str) -> bool:
    """Check if a permission level allows sharing the collection."""
    return permission in ("owner", "editor")


@router.get("", response_model=List[CollectionSchema])
async def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List current user's collections."""
    # Get collections with recipe counts
    collections = db.query(Collection).filter(
        Collection.user_id == current_user.id
    ).order_by(Collection.sort_order, Collection.created_at).all()

    # Add recipe counts
    result = []
    for collection in collections:
        schema = CollectionSchema.model_validate(collection)
        schema.recipe_count = len(collection.recipes)
        result.append(schema)

    return result


@router.post("", response_model=CollectionSchema, status_code=201)
async def create_collection(
    collection_data: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new collection."""
    # Get max sort_order
    max_order = db.query(func.max(Collection.sort_order)).filter(
        Collection.user_id == current_user.id
    ).scalar() or 0

    # Determine privacy level: use provided value or default based on user's public status
    privacy_level = collection_data.privacy_level
    if privacy_level is None:
        privacy_level = "public" if current_user.is_public else "private"

    collection = Collection(
        user_id=current_user.id,
        name=collection_data.name,
        description=collection_data.description,
        cover_image_url=collection_data.cover_image_url,
        privacy_level=privacy_level,
        sort_order=max_order + 1,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)

    schema = CollectionSchema.model_validate(collection)
    schema.recipe_count = 0
    return schema


# NOTE: This endpoint MUST be defined before /{collection_id} routes
@router.get("/shared-with-me", response_model=List[SharedCollection])
async def list_shared_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List collections that have been shared with the current user."""
    shares = db.query(CollectionShare).options(
        joinedload(CollectionShare.collection).joinedload(Collection.user),
        joinedload(CollectionShare.collection).joinedload(Collection.recipes)
    ).filter(
        CollectionShare.user_id == current_user.id
    ).all()

    result = []
    for share in shares:
        collection = share.collection
        owner = collection.user
        result.append(SharedCollection(
            id=collection.id,
            name=collection.name,
            description=collection.description,
            cover_image_url=collection.cover_image_url,
            recipe_count=len([r for r in collection.recipes if r.deleted_at is None]),
            permission=share.permission,
            owner=CollectionShareUser(
                id=owner.id,
                name=owner.name,
                username=owner.username,
                profile_image_url=owner.profile_image_url
            ),
            created_at=collection.created_at
        ))

    return result


@router.get("/{collection_id}", response_model=CollectionWithRecipes)
async def get_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a collection with its recipes. Accessible by owner or shared users."""
    # Check access (viewer permission is enough to view)
    collection, permission = require_collection_access(db, collection_id, current_user, "viewer")

    # Load recipes with eager loading
    collection = db.query(Collection).options(
        joinedload(Collection.recipes).joinedload(Recipe.author),
        joinedload(Collection.recipes).joinedload(Recipe.tags)
    ).filter(Collection.id == collection_id).first()

    # Filter out deleted recipes
    active_recipes = [r for r in collection.recipes if r.deleted_at is None]

    result = CollectionWithRecipes.model_validate(collection)
    result.recipe_count = len(active_recipes)
    result.recipes = [RecipeSummary.model_validate(r) for r in active_recipes]

    return result


@router.put("/{collection_id}", response_model=CollectionSchema)
async def update_collection(
    collection_id: str,
    collection_data: CollectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a collection. Requires editor permission."""
    collection, permission = require_collection_access(db, collection_id, current_user, "editor")

    # Don't allow updating default collections
    if collection.is_default and collection_data.name:
        raise HTTPException(status_code=400, detail="Cannot rename default collection")

    update_data = collection_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(collection, field, value)

    db.commit()
    db.refresh(collection)

    schema = CollectionSchema.model_validate(collection)
    schema.recipe_count = len(collection.recipes)
    return schema


@router.delete("/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a collection. Only the owner can delete."""
    collection, permission = require_collection_access(db, collection_id, current_user, "owner")

    # Don't allow deleting default collections
    if collection.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default collection")

    db.delete(collection)
    db.commit()

    return None


@router.post("/{collection_id}/recipes/{recipe_id}", status_code=201)
async def add_recipe_to_collection(
    collection_id: str,
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a recipe to a collection. Requires editor permission."""
    collection, permission = require_collection_access(db, collection_id, current_user, "editor")

    # For shared collections, users can add any recipe they have access to
    # For now, allow adding any non-deleted recipe (trust-based)
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.deleted_at.is_(None)
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Check if already in collection
    if recipe in collection.recipes:
        raise HTTPException(status_code=400, detail="Recipe already in collection")

    collection.recipes.append(recipe)
    db.commit()

    return {"message": "Recipe added to collection"}


@router.delete("/{collection_id}/recipes/{recipe_id}", status_code=204)
async def remove_recipe_from_collection(
    collection_id: str,
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a recipe from a collection. Requires editor permission."""
    collection, permission = require_collection_access(db, collection_id, current_user, "editor")

    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if recipe not in collection.recipes:
        raise HTTPException(status_code=400, detail="Recipe not in collection")

    collection.recipes.remove(recipe)
    db.commit()

    return None


# ============================================================================
# COLLECTION SHARING ENDPOINTS
# ============================================================================

@router.get("/{collection_id}/shares", response_model=List[CollectionShareSchema])
async def list_collection_shares(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all users a collection is shared with. Requires editor permission."""
    collection, permission = require_collection_access(db, collection_id, current_user, "editor")

    shares = db.query(CollectionShare).options(
        joinedload(CollectionShare.user)
    ).filter(
        CollectionShare.collection_id == collection_id
    ).all()

    result = []
    for share in shares:
        result.append(CollectionShareSchema(
            id=share.id,
            collection_id=share.collection_id,
            user_id=share.user_id,
            permission=share.permission,
            invited_by_id=share.invited_by_id,
            created_at=share.created_at,
            user=CollectionShareUser(
                id=share.user.id,
                name=share.user.name,
                username=share.user.username,
                profile_image_url=share.user.profile_image_url
            )
        ))

    return result


@router.post("/{collection_id}/shares", response_model=CollectionShareSchema, status_code=201)
async def share_collection(
    collection_id: str,
    share_data: CollectionShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Share a collection with another user. Requires editor permission."""
    collection, permission = require_collection_access(db, collection_id, current_user, "editor")

    # Validate permission level
    if share_data.permission not in ("viewer", "editor"):
        raise HTTPException(status_code=400, detail="Permission must be 'viewer' or 'editor'")

    # Can't share with yourself
    if share_data.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    # Can't share with the owner
    if share_data.user_id == collection.user_id:
        raise HTTPException(status_code=400, detail="Cannot share with the collection owner")

    # Check if user exists
    target_user = db.query(User).filter(User.id == share_data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already shared
    existing = db.query(CollectionShare).filter(
        CollectionShare.collection_id == collection_id,
        CollectionShare.user_id == share_data.user_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Collection already shared with this user")

    # Create the share
    share = CollectionShare(
        collection_id=collection_id,
        user_id=share_data.user_id,
        permission=share_data.permission,
        invited_by_id=current_user.id
    )
    db.add(share)

    # Create notification for the target user
    notification = Notification(
        user_id=share_data.user_id,
        type="collection_shared",
        title="Collection shared with you",
        message=f"{current_user.name} shared the collection \"{collection.name}\" with you",
        link=f"/collections/{collection_id}",
        data={
            "collection_id": collection_id,
            "collection_name": collection.name,
            "shared_by_id": current_user.id,
            "shared_by_name": current_user.name,
            "permission": share_data.permission
        }
    )
    db.add(notification)

    db.commit()
    db.refresh(share)

    return CollectionShareSchema(
        id=share.id,
        collection_id=share.collection_id,
        user_id=share.user_id,
        permission=share.permission,
        invited_by_id=share.invited_by_id,
        created_at=share.created_at,
        user=CollectionShareUser(
            id=target_user.id,
            name=target_user.name,
            username=target_user.username,
            profile_image_url=target_user.profile_image_url
        )
    )


@router.put("/{collection_id}/shares/{user_id}", response_model=CollectionShareSchema)
async def update_collection_share(
    collection_id: str,
    user_id: str,
    share_data: CollectionShareUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a user's permission level. Requires editor permission."""
    collection, permission = require_collection_access(db, collection_id, current_user, "editor")

    # Validate permission level
    if share_data.permission not in ("viewer", "editor"):
        raise HTTPException(status_code=400, detail="Permission must be 'viewer' or 'editor'")

    share = db.query(CollectionShare).filter(
        CollectionShare.collection_id == collection_id,
        CollectionShare.user_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    share.permission = share_data.permission
    db.commit()
    db.refresh(share)

    target_user = db.query(User).filter(User.id == user_id).first()

    return CollectionShareSchema(
        id=share.id,
        collection_id=share.collection_id,
        user_id=share.user_id,
        permission=share.permission,
        invited_by_id=share.invited_by_id,
        created_at=share.created_at,
        user=CollectionShareUser(
            id=target_user.id,
            name=target_user.name,
            username=target_user.username,
            profile_image_url=target_user.profile_image_url
        )
    )


@router.delete("/{collection_id}/shares/{user_id}", status_code=204)
async def remove_collection_share(
    collection_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a user's access to a collection. Requires editor permission."""
    collection, permission = require_collection_access(db, collection_id, current_user, "editor")

    share = db.query(CollectionShare).filter(
        CollectionShare.collection_id == collection_id,
        CollectionShare.user_id == user_id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()

    return None


@router.delete("/{collection_id}/leave", status_code=204)
async def leave_shared_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave a collection that was shared with you."""
    # Find the share for this user
    share = db.query(CollectionShare).filter(
        CollectionShare.collection_id == collection_id,
        CollectionShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="You are not a member of this collection")

    db.delete(share)
    db.commit()

    return None
