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

    # Search by name if provided
    if search:
        query = query.filter(Ingredient.name.ilike(f"%{search}%"))

    # Filter by category if provided
    if category:
        query = query.filter(Ingredient.category == category)

    # Order: exact matches first, then alphabetically
    if search:
        # Prioritize exact starts
        query = query.order_by(
            Ingredient.name.ilike(f"{search}%").desc(),
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
    If a system ingredient with the same name exists, return it instead.
    """
    # Check if system ingredient exists (case-insensitive)
    existing_system = db.query(Ingredient).filter(
        Ingredient.is_system == True,
        Ingredient.name.ilike(ingredient_data.name)
    ).first()

    if existing_system:
        return existing_system

    # Check if user already has this ingredient
    existing_user = db.query(Ingredient).filter(
        Ingredient.user_id == current_user.id,
        Ingredient.name.ilike(ingredient_data.name)
    ).first()

    if existing_user:
        return existing_user

    # Create user-specific ingredient
    ingredient = Ingredient(
        name=ingredient_data.name.strip(),
        category=ingredient_data.category or "other",
        is_system=False,
        user_id=current_user.id,
    )
    db.add(ingredient)
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


# Measurement Units endpoints
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
