"""
Ingredient Router

API endpoints for master ingredients list (autocomplete) and measurement units.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from database import get_db
from auth import get_current_user
from models import User, Ingredient, MeasurementUnit
from schemas import (
    IngredientCreate,
    Ingredient as IngredientSchema,
    MeasurementUnit as MeasurementUnitSchema,
)

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for matching: lowercase, stripped, single spaces."""
    return " ".join(name.lower().strip().split())


def find_or_create_ingredient(
    db: Session,
    name: str,
    user_id: str,
    category: Optional[str] = None
) -> Ingredient:
    """
    Find an existing ingredient or create a new one.

    Search order:
    1. System/global ingredients (normalized name match)
    2. User's custom ingredients (normalized name match)
    3. Create new user-specific ingredient if not found

    Returns the Ingredient entity.
    """
    normalized = normalize_ingredient_name(name)

    # Check for system ingredient first
    existing_system = db.query(Ingredient).filter(
        Ingredient.is_system == True,
        Ingredient.normalized_name == normalized
    ).first()

    if existing_system:
        return existing_system

    # Check for user's custom ingredient
    existing_user = db.query(Ingredient).filter(
        Ingredient.user_id == user_id,
        Ingredient.normalized_name == normalized
    ).first()

    if existing_user:
        return existing_user

    # Create new user-specific ingredient
    ingredient = Ingredient(
        name=name.strip(),
        normalized_name=normalized,
        category=category or "other",
        is_system=False,
        user_id=user_id,
    )
    db.add(ingredient)
    db.flush()  # Get the ID without committing

    return ingredient


@router.get("", response_model=List[IngredientSchema])
async def list_ingredients(
    search: Optional[str] = Query(None, description="Search ingredient names"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, le=200, description="Max results to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List available ingredients for autocomplete.
    Returns system ingredients + current user's custom ingredients.
    """
    query = db.query(Ingredient).filter(
        or_(
            Ingredient.is_system == True,
            Ingredient.user_id == current_user.id
        )
    )

    # Search by normalized name if provided
    if search:
        normalized_search = normalize_ingredient_name(search)
        query = query.filter(Ingredient.normalized_name.ilike(f"%{normalized_search}%"))

    # Filter by category if provided
    if category:
        query = query.filter(Ingredient.category == category)

    # Order: exact matches first, then alphabetically
    if search:
        normalized_search = normalize_ingredient_name(search)
        # Prioritize exact starts
        query = query.order_by(
            Ingredient.normalized_name.ilike(f"{normalized_search}%").desc(),
            Ingredient.is_system.desc(),
            Ingredient.name
        )
    else:
        query = query.order_by(Ingredient.is_system.desc(), Ingredient.name)

    ingredients = query.limit(limit).all()
    return ingredients


@router.post("", response_model=IngredientSchema, status_code=201)
async def create_ingredient(
    ingredient_data: IngredientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new custom ingredient (user-specific).
    If a system or user ingredient with the same normalized name exists, return it instead.
    """
    ingredient = find_or_create_ingredient(
        db=db,
        name=ingredient_data.name,
        user_id=current_user.id,
        category=ingredient_data.category
    )
    db.commit()
    db.refresh(ingredient)

    return ingredient


@router.get("/categories", response_model=List[str])
async def list_ingredient_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all ingredient categories."""
    categories = db.query(Ingredient.category).distinct().filter(
        Ingredient.category.isnot(None)
    ).all()
    return sorted([c[0] for c in categories if c[0]])


# Measurement Units endpoint - MUST be before /{ingredient_id} to avoid route conflict
@router.get("/units", response_model=List[MeasurementUnitSchema])
async def list_measurement_units(
    search: Optional[str] = Query(None, description="Search unit names"),
    type: Optional[str] = Query(None, description="Filter by type (volume, weight, count, etc.)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all measurement units."""
    query = db.query(MeasurementUnit)

    if search:
        query = query.filter(
            or_(
                MeasurementUnit.name.ilike(f"%{search}%"),
                MeasurementUnit.abbreviation.ilike(f"%{search}%")
            )
        )

    if type:
        query = query.filter(MeasurementUnit.type == type)

    query = query.order_by(MeasurementUnit.type, MeasurementUnit.name)

    return query.all()


@router.get("/{ingredient_id}", response_model=IngredientSchema)
async def get_ingredient(
    ingredient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single ingredient by ID."""
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == ingredient_id,
        or_(
            Ingredient.is_system == True,
            Ingredient.user_id == current_user.id
        )
    ).first()

    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    return ingredient
