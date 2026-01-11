"""
Recipe Router

CRUD operations for recipes, including:
- List, create, read, update, delete recipes
- Ingredient parsing
- Recipe cloning
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime
import math

from database import get_db
from auth import get_current_user, get_current_user_optional
from models import User, Recipe, Tag, Collection, recipe_sub_recipes
from routers.library_router import get_library_partners
from schemas import (
    RecipeCreate, RecipeUpdate, Recipe as RecipeSchema,
    RecipeSummary, RecipeListResponse, RecipeWithScale, ForkedFromInfo, ClonedByMeInfo,
    IngredientParseRequest, IngredientParseResponse, ParsedIngredient,
    RecipeImportRequest, RecipeImportResponse, RecipeImportMultiResponse,
    RecipeParseTextRequest,
    Collection as CollectionSchema,
    SubRecipeInfo,
)
from services.ingredient_parser import parse_ingredients_block, to_dict
from services.recipe_import import import_recipe_from_url, recipe_to_dict, is_youtube_url, parse_with_gemini
from services.recipe_service import (
    create_recipe_ingredients,
    create_recipe_instructions,
    update_recipe_ingredients,
    update_recipe_instructions,
    clone_recipe_content,
    update_recipe_sub_recipes,
)
from services.image_service import upload_image, is_cloudinary_configured

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
    """List current user's recipes and library partners' recipes with optional filters."""
    # Get library partners (users who share their library with us)
    partner_ids = get_library_partners(db, current_user.id)
    all_user_ids = [current_user.id] + partner_ids

    query = db.query(Recipe).filter(
        Recipe.author_id.in_(all_user_ids),
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
    query = query.options(joinedload(Recipe.author), joinedload(Recipe.tags))
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
    # Determine privacy level: use provided value or default based on user's public status
    privacy_level = recipe_data.privacy_level
    if privacy_level is None:
        privacy_level = "public" if current_user.is_public else "private"

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
        privacy_level=privacy_level,
        source_url=recipe_data.source_url,
        source_name=recipe_data.source_name,
        cover_image_url=recipe_data.cover_image_url,
        video_start_seconds=recipe_data.video_start_seconds,
        status=recipe_data.status,
    )
    db.add(recipe)
    db.flush()  # Get recipe ID

    # Add ingredients and instructions using service
    create_recipe_ingredients(db, recipe.id, recipe_data.ingredients, current_user.id)
    create_recipe_instructions(db, recipe.id, recipe_data.instructions)

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

    # Add sub-recipes (composite recipes)
    if recipe_data.sub_recipe_inputs:
        try:
            update_recipe_sub_recipes(db, recipe.id, recipe_data.sub_recipe_inputs, current_user.id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

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
        joinedload(Recipe.forked_from_user),
        joinedload(Recipe.sub_recipes).joinedload(Recipe.ingredients),
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
    scaled_yield = recipe.yield_quantity * scale_factor if recipe.yield_quantity else None

    # Build response with scaled data
    response = RecipeWithScale.model_validate(recipe)
    response.scale_factor = scale_factor
    response.scaled_yield_quantity = scaled_yield

    # Load sub-recipes with junction table metadata
    if recipe.sub_recipes:
        sub_recipe_infos = []
        # Get junction table data for sort_order, scale_factor, section_title
        junction_rows = db.execute(
            recipe_sub_recipes.select().where(
                recipe_sub_recipes.c.parent_recipe_id == recipe_id
            ).order_by(recipe_sub_recipes.c.sort_order)
        ).fetchall()

        junction_map = {row.sub_recipe_id: row for row in junction_rows}

        for sub_recipe in recipe.sub_recipes:
            junction_data = junction_map.get(sub_recipe.id)
            sub_scale = junction_data.scale_factor if junction_data else 1.0

            sub_recipe_infos.append(SubRecipeInfo(
                id=sub_recipe.id,
                title=sub_recipe.title,
                description=sub_recipe.description,
                cover_image_url=sub_recipe.cover_image_url,
                prep_time_minutes=sub_recipe.prep_time_minutes,
                cook_time_minutes=sub_recipe.cook_time_minutes,
                yield_quantity=sub_recipe.yield_quantity,
                yield_unit=sub_recipe.yield_unit,
                sort_order=junction_data.sort_order if junction_data else 0,
                scale_factor=sub_scale,
                section_title=junction_data.section_title if junction_data else None,
                ingredients=sub_recipe.ingredients,
            ))

        # Sort by sort_order
        sub_recipe_infos.sort(key=lambda x: x.sort_order)
        response.sub_recipes = sub_recipe_infos

    # Add forked_from info if this is a cloned recipe
    if recipe.forked_from_recipe_id and recipe.forked_from_user:
        response.forked_from = ForkedFromInfo(
            recipe_id=recipe.forked_from_recipe_id,
            user_id=recipe.forked_from_user_id,
            user_name=recipe.forked_from_user.name,
        )

    # Check if current user has cloned this recipe (for viewing other's recipes)
    if current_user and recipe.author_id != current_user.id:
        cloned_recipe = db.query(Recipe).filter(
            Recipe.author_id == current_user.id,
            Recipe.forked_from_recipe_id == recipe_id,
            Recipe.deleted_at.is_(None)
        ).first()
        if cloned_recipe:
            response.cloned_by_me = ClonedByMeInfo(
                cloned_recipe_id=cloned_recipe.id,
                cloned_at=cloned_recipe.created_at,
            )

    # Scale ingredient quantities in the response
    if scale_factor != 1.0:
        for ing in response.ingredients:
            if ing.quantity:
                ing.quantity = round(ing.quantity * scale_factor, 3)
            if ing.quantity_max:
                ing.quantity_max = round(ing.quantity_max * scale_factor, 3)

    return response


@router.get("/{recipe_id}/collections", response_model=List[CollectionSchema])
async def get_recipe_collections(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get collections that contain this recipe.

    For other users' recipes, only returns public collections.
    For your own recipes, returns all your collections containing this recipe.
    """
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.deleted_at.is_(None)
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Check permissions for private recipes
    if recipe.privacy_level == "private":
        if not current_user or recipe.author_id != current_user.id:
            raise HTTPException(status_code=404, detail="Recipe not found")

    # Get collections containing this recipe
    collections_query = db.query(Collection).filter(
        Collection.recipes.contains(recipe)
    )

    # If viewing someone else's recipe, only show public collections
    if not current_user or recipe.author_id != current_user.id:
        collections_query = collections_query.filter(Collection.privacy_level == 'public')
    else:
        # If viewing own recipe, show own collections
        collections_query = collections_query.filter(Collection.user_id == current_user.id)

    collections = collections_query.all()

    return [CollectionSchema.model_validate(c) for c in collections]


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
        update_recipe_ingredients(db, recipe.id, recipe_data.ingredients, current_user.id)
        del update_data["ingredients"]

    # Handle instructions separately
    if "instructions" in update_data:
        update_recipe_instructions(db, recipe.id, recipe_data.instructions)
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

    # Handle sub-recipes separately
    if "sub_recipe_inputs" in update_data:
        try:
            update_recipe_sub_recipes(
                db, recipe.id, recipe_data.sub_recipe_inputs or [], current_user.id
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        del update_data["sub_recipe_inputs"]

    # Update remaining fields
    for field, value in update_data.items():
        setattr(recipe, field, value)

    db.commit()
    db.refresh(recipe)

    return recipe


@router.post("/{recipe_id}/upload-image")
async def upload_recipe_image(
    recipe_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload an image for a recipe.

    Uploads the image to Cloudinary and updates the recipe's cover_image_url.
    Returns the new image URL.
    """
    # Check if Cloudinary is configured
    if not is_cloudinary_configured():
        raise HTTPException(
            status_code=503,
            detail="Image upload is not configured. Please use an image URL instead.",
        )

    # Get and verify recipe ownership
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.author_id == current_user.id,
        Recipe.deleted_at.is_(None)
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Upload image to R2
    image_url = await upload_image(file, prefix="recipes")

    # Update recipe with new image URL
    recipe.cover_image_url = image_url
    db.commit()

    return {"url": image_url}


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
        title=original.title,
        description=original.description,
        yield_quantity=original.yield_quantity,
        yield_unit=original.yield_unit,
        prep_time_minutes=original.prep_time_minutes,
        cook_time_minutes=original.cook_time_minutes,
        difficulty=original.difficulty,
        privacy_level="private",  # Clone is always private initially
        source_url=original.source_url,
        source_name=original.source_name,
        cover_image_url=original.cover_image_url,
        status="published",
        forked_from_recipe_id=original.id,
        forked_from_user_id=original.author_id,
    )
    db.add(clone)
    db.flush()

    # Clone ingredients, instructions, and tags using service
    clone_recipe_content(db, original, clone, current_user.id)

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


@router.post("/parse-text", response_model=RecipeImportMultiResponse)
async def parse_recipe_text(
    request: RecipeParseTextRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Parse recipe text into structured format using AI.

    Takes raw recipe text (e.g., copied from a website, book, or note)
    and uses Gemini to extract structured recipe data.

    Returns a list of parsed recipes that can be reviewed and saved.
    """
    if len(request.text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Please provide more recipe text (at least 50 characters)"
        )

    try:
        recipes = await parse_with_gemini(request.text, "", allow_multiple=True)
        return RecipeImportMultiResponse(
            recipes=[RecipeImportResponse(**recipe_to_dict(r)) for r in recipes],
            source_type="text"
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse recipe: {str(e)}"
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

    query = query.options(joinedload(Recipe.author), joinedload(Recipe.tags))
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
