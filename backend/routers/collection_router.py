"""
Collection Router

CRUD operations for recipe collections.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional

from database import get_db
from auth import get_current_user
from models import User, Collection, Recipe, collection_recipes
from schemas import (
    CollectionCreate, CollectionUpdate, Collection as CollectionSchema,
    CollectionWithRecipes, RecipeSummary,
)

router = APIRouter(prefix="/collections", tags=["collections"])


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


@router.get("/{collection_id}", response_model=CollectionWithRecipes)
async def get_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a collection with its recipes."""
    collection = db.query(Collection).options(
        joinedload(Collection.recipes).joinedload(Recipe.author),
        joinedload(Collection.recipes).joinedload(Recipe.tags)
    ).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

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
    """Update a collection."""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

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
    """Delete a collection."""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

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
    """Add a recipe to a collection."""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.author_id == current_user.id,
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
    """Remove a recipe from a collection."""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

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
