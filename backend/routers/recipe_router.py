"""
Recipe Router

CRUD operations for recipes, including:
- List, create, read, update, delete recipes
- Ingredient parsing
- Recipe cloning
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime
import math

from database import get_db
from auth import get_current_user, get_current_user_optional
from models import User, Recipe, RecipeIngredient, RecipeInstruction, Tag, Collection, recipe_tags
from schemas import (
    RecipeCreate, RecipeUpdate, Recipe as RecipeSchema,
    RecipeSummary, RecipeListResponse, RecipeWithScale,
    IngredientParseRequest, IngredientParseResponse, ParsedIngredient,
    RecipeIngredientCreate, RecipeInstructionCreate,
    RecipeImportRequest, RecipeImportResponse, RecipeImportMultiResponse,
)
from services.ingredient_parser import parse_ingredients_block, to_dict
from services.recipe_import import import_recipe_from_url, recipe_to_dict, is_youtube_url

router = APIRouter(prefix="/recipes", tags=["recipes"])


# ============================================================================
# RECIPE CRUD
# ============================================================================

@router.get("", response_model=RecipeListResponse)
async def list_recipes(
    search: Optional[str] = Query(None, description="Search in title and description"),
    tag_ids: Optional[str] = Query(None, description="Comma-separated tag IDs"),
    collection_id: Optional[str] = Query(None, description="Filter by collection"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    status: Optional[str] = Query(None, description="Filter by status (draft/published)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List current user's recipes with optional filters."""
    query = db.query(Recipe).filter(
        Recipe.author_id == current_user.id,
        Recipe.deleted_at.is_(None)
    )

    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Recipe.title.ilike(search_term),
                Recipe.description.ilike(search_term)
            )
        )

    # Apply tag filter
    if tag_ids:
        tag_id_list = [t.strip() for t in tag_ids.split(",")]
        query = query.filter(Recipe.tags.any(Tag.id.in_(tag_id_list)))

    # Apply collection filter
    if collection_id:
        query = query.filter(Recipe.collections.any(Collection.id == collection_id))

    # Apply difficulty filter
    if difficulty:
        query = query.filter(Recipe.difficulty == difficulty)

    # Apply status filter
    if status:
        query = query.filter(Recipe.status == status)

    # Get total count
    total = query.count()

    # Apply pagination and ordering
    query = query.options(joinedload(Recipe.author))
    query = query.order_by(Recipe.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    recipes = query.all()

    return RecipeListResponse(
        items=[RecipeSummary.model_validate(r) for r in recipes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.post("", response_model=RecipeSchema, status_code=201)
async def create_recipe(
    recipe_data: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new recipe."""
    # Create recipe
    recipe = Recipe(
        author_id=current_user.id,
        title=recipe_data.title,
        description=recipe_data.description,
        yield_quantity=recipe_data.yield_quantity,
        yield_unit=recipe_data.yield_unit,
        prep_time_minutes=recipe_data.prep_time_minutes,
        cook_time_minutes=recipe_data.cook_time_minutes,
        difficulty=recipe_data.difficulty,
        privacy_level=recipe_data.privacy_level,
        source_url=recipe_data.source_url,
        source_name=recipe_data.source_name,
        cover_image_url=recipe_data.cover_image_url,
        status=recipe_data.status,
    )
    db.add(recipe)
    db.flush()  # Get recipe ID

    # Add ingredients
    for idx, ing_data in enumerate(recipe_data.ingredients):
        ingredient = RecipeIngredient(
            recipe_id=recipe.id,
            sort_order=ing_data.sort_order if ing_data.sort_order else idx,
            quantity=ing_data.quantity,
            quantity_max=ing_data.quantity_max,
            unit=ing_data.unit,
            name=ing_data.name,
            preparation=ing_data.preparation,
            is_optional=ing_data.is_optional,
            is_staple=ing_data.is_staple,
            ingredient_group=ing_data.ingredient_group,
            notes=ing_data.notes,
        )
        db.add(ingredient)

    # Add instructions
    for idx, inst_data in enumerate(recipe_data.instructions):
        instruction = RecipeInstruction(
            recipe_id=recipe.id,
            step_number=inst_data.step_number if inst_data.step_number else idx + 1,
            instruction_text=inst_data.instruction_text,
            duration_minutes=inst_data.duration_minutes,
            instruction_group=inst_data.instruction_group,
        )
        db.add(instruction)

    # Add tags
    if recipe_data.tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(recipe_data.tag_ids)).all()
        recipe.tags = tags

    # Add to collections
    if recipe_data.collection_ids:
        collections = db.query(Collection).filter(
            Collection.id.in_(recipe_data.collection_ids),
            Collection.user_id == current_user.id
        ).all()
        recipe.collections = collections

    db.commit()
    db.refresh(recipe)

    return recipe


@router.get("/{recipe_id}", response_model=RecipeWithScale)
async def get_recipe(
    recipe_id: str,
    scale: Optional[float] = Query(None, description="Scale factor for ingredients"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a single recipe by ID with optional scaling."""
    recipe = db.query(Recipe).options(
        joinedload(Recipe.author),
        joinedload(Recipe.ingredients),
        joinedload(Recipe.instructions),
        joinedload(Recipe.tags),
    ).filter(
        Recipe.id == recipe_id,
        Recipe.deleted_at.is_(None)
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Check permissions
    if recipe.privacy_level == "private":
        if not current_user or recipe.author_id != current_user.id:
            raise HTTPException(status_code=404, detail="Recipe not found")

    # Calculate scale factor
    scale_factor = scale if scale else 1.0
    scaled_yield = recipe.yield_quantity * scale_factor

    # Build response with scaled data
    response = RecipeWithScale.model_validate(recipe)
    response.scale_factor = scale_factor
    response.scaled_yield_quantity = scaled_yield

    # Scale ingredient quantities in the response
    if scale_factor != 1.0:
        for ing in response.ingredients:
            if ing.quantity:
                ing.quantity = round(ing.quantity * scale_factor, 3)
            if ing.quantity_max:
                ing.quantity_max = round(ing.quantity_max * scale_factor, 3)

    return response


@router.put("/{recipe_id}", response_model=RecipeSchema)
async def update_recipe(
    recipe_id: str,
    recipe_data: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing recipe."""
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.author_id == current_user.id,
        Recipe.deleted_at.is_(None)
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Update basic fields
    update_data = recipe_data.model_dump(exclude_unset=True)

    # Handle ingredients separately
    if "ingredients" in update_data:
        # Delete existing ingredients
        db.query(RecipeIngredient).filter(
            RecipeIngredient.recipe_id == recipe_id
        ).delete()

        # Add new ingredients
        for idx, ing_data in enumerate(recipe_data.ingredients):
            ingredient = RecipeIngredient(
                recipe_id=recipe.id,
                sort_order=ing_data.sort_order if ing_data.sort_order else idx,
                quantity=ing_data.quantity,
                quantity_max=ing_data.quantity_max,
                unit=ing_data.unit,
                name=ing_data.name,
                preparation=ing_data.preparation,
                is_optional=ing_data.is_optional,
                is_staple=ing_data.is_staple,
                ingredient_group=ing_data.ingredient_group,
                notes=ing_data.notes,
            )
            db.add(ingredient)
        del update_data["ingredients"]

    # Handle instructions separately
    if "instructions" in update_data:
        # Delete existing instructions
        db.query(RecipeInstruction).filter(
            RecipeInstruction.recipe_id == recipe_id
        ).delete()

        # Add new instructions
        for idx, inst_data in enumerate(recipe_data.instructions):
            instruction = RecipeInstruction(
                recipe_id=recipe.id,
                step_number=inst_data.step_number if inst_data.step_number else idx + 1,
                instruction_text=inst_data.instruction_text,
                duration_minutes=inst_data.duration_minutes,
                instruction_group=inst_data.instruction_group,
            )
            db.add(instruction)
        del update_data["instructions"]

    # Handle tags separately
    if "tag_ids" in update_data:
        tags = db.query(Tag).filter(Tag.id.in_(recipe_data.tag_ids)).all()
        recipe.tags = tags
        del update_data["tag_ids"]

    # Handle collections separately
    if "collection_ids" in update_data:
        collections = db.query(Collection).filter(
            Collection.id.in_(recipe_data.collection_ids),
            Collection.user_id == current_user.id
        ).all()
        recipe.collections = collections
        del update_data["collection_ids"]

    # Update remaining fields
    for field, value in update_data.items():
        setattr(recipe, field, value)

    db.commit()
    db.refresh(recipe)

    return recipe


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete a recipe."""
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.author_id == current_user.id,
        Recipe.deleted_at.is_(None)
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe.deleted_at = datetime.utcnow()
    db.commit()

    return None


@router.post("/{recipe_id}/clone", response_model=RecipeSchema, status_code=201)
async def clone_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clone a public recipe to user's collection."""
    # Get original recipe
    original = db.query(Recipe).options(
        joinedload(Recipe.ingredients),
        joinedload(Recipe.instructions),
        joinedload(Recipe.tags),
    ).filter(
        Recipe.id == recipe_id,
        Recipe.deleted_at.is_(None)
    ).first()

    if not original:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Check if user can clone (public or own recipe)
    if original.privacy_level == "private" and original.author_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Don't clone own recipe
    if original.author_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot clone your own recipe")

    # Create clone
    clone = Recipe(
        author_id=current_user.id,
        title=f"{original.title} (Copy)",
        description=original.description,
        yield_quantity=original.yield_quantity,
        yield_unit=original.yield_unit,
        prep_time_minutes=original.prep_time_minutes,
        cook_time_minutes=original.cook_time_minutes,
        difficulty=original.difficulty,
        privacy_level="private",  # Clone is always private initially
        source_url=original.source_url,
        source_name=original.source_name or original.author.name,
        cover_image_url=original.cover_image_url,
        status="published",
    )
    db.add(clone)
    db.flush()

    # Clone ingredients
    for ing in original.ingredients:
        new_ing = RecipeIngredient(
            recipe_id=clone.id,
            sort_order=ing.sort_order,
            quantity=ing.quantity,
            quantity_max=ing.quantity_max,
            unit=ing.unit,
            name=ing.name,
            preparation=ing.preparation,
            is_optional=ing.is_optional,
            is_staple=ing.is_staple,
            ingredient_group=ing.ingredient_group,
            notes=ing.notes,
        )
        db.add(new_ing)

    # Clone instructions
    for inst in original.instructions:
        new_inst = RecipeInstruction(
            recipe_id=clone.id,
            step_number=inst.step_number,
            instruction_text=inst.instruction_text,
            duration_minutes=inst.duration_minutes,
            instruction_group=inst.instruction_group,
        )
        db.add(new_inst)

    # Copy tags
    clone.tags = list(original.tags)

    db.commit()
    db.refresh(clone)

    return clone


# ============================================================================
# INGREDIENT PARSER
# ============================================================================

@router.post("/parse-ingredients", response_model=IngredientParseResponse)
async def parse_ingredients(
    request: IngredientParseRequest,
    current_user: User = Depends(get_current_user)
):
    """Parse ingredient text into structured data."""
    parsed = parse_ingredients_block(request.text)

    return IngredientParseResponse(
        ingredients=[
            ParsedIngredient(
                quantity=p.quantity,
                quantity_max=p.quantity_max,
                unit=p.unit,
                name=p.name,
                preparation=p.preparation,
                notes=p.notes,
                original_text=p.original_text,
            )
            for p in parsed
        ]
    )


# ============================================================================
# RECIPE IMPORT
# ============================================================================

@router.post("/import", response_model=RecipeImportMultiResponse)
async def import_recipe(
    request: RecipeImportRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Import recipe(s) from a URL.

    Supports:
    - Regular recipe websites (extracts JSON-LD or uses LLM parsing)
    - YouTube videos (extracts transcript and parses with LLM)

    For YouTube videos, may return multiple recipes if the video
    contains more than one recipe.

    Returns a list of parsed recipes that can be reviewed and saved.
    """
    try:
        recipes = await import_recipe_from_url(request.url)
        source_type = "youtube" if is_youtube_url(request.url) else "webpage"
        return RecipeImportMultiResponse(
            recipes=[RecipeImportResponse(**recipe_to_dict(r)) for r in recipes],
            source_type=source_type
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to import recipe: {str(e)}"
        )


# ============================================================================
# PUBLIC RECIPES (Feed/Discover)
# ============================================================================

@router.get("/public/feed", response_model=RecipeListResponse)
async def get_public_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get public recipes for discovery feed."""
    query = db.query(Recipe).filter(
        Recipe.privacy_level == "public",
        Recipe.status == "published",
        Recipe.deleted_at.is_(None)
    )

    # Exclude own recipes if logged in
    if current_user:
        query = query.filter(Recipe.author_id != current_user.id)

    total = query.count()

    query = query.options(joinedload(Recipe.author))
    query = query.order_by(Recipe.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    recipes = query.all()

    return RecipeListResponse(
        items=[RecipeSummary.model_validate(r) for r in recipes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1
    )
