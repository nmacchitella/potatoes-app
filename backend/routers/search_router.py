"""
Search Router

Unified search endpoint for autocomplete and full search across:
- User's recipes
- Public recipes (discover)
- Tags
- Collections
- Users
- Ingredients
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from typing import Optional, List
from pydantic import BaseModel

from database import get_db
from auth import get_current_user
from models import User, Recipe, Tag, Collection, Ingredient, RecipeIngredient, collection_recipes, recipe_tags


router = APIRouter(prefix="/search", tags=["search"])


# ============================================================================
# SCHEMAS
# ============================================================================

class SearchRecipeResult(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    author_name: str
    is_own: bool

    class Config:
        from_attributes = True


class SearchTagResult(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    recipe_count: int = 0

    class Config:
        from_attributes = True


class SearchCollectionResult(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    recipe_count: int = 0

    class Config:
        from_attributes = True


class SearchUserResult(BaseModel):
    id: str
    name: str
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class SearchIngredientResult(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    recipe_count: int = 0

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    my_recipes: List[SearchRecipeResult] = []
    discover_recipes: List[SearchRecipeResult] = []
    tags: List[SearchTagResult] = []
    collections: List[SearchCollectionResult] = []
    users: List[SearchUserResult] = []
    ingredients: List[SearchIngredientResult] = []
    query: str


class FullSearchResponse(BaseModel):
    """Extended response for full search results page"""
    recipes: List[SearchRecipeResult] = []
    recipes_total: int = 0
    tags: List[SearchTagResult] = []
    tags_total: int = 0
    collections: List[SearchCollectionResult] = []
    collections_total: int = 0
    users: List[SearchUserResult] = []
    users_total: int = 0
    ingredients: List[SearchIngredientResult] = []
    ingredients_total: int = 0
    query: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("", response_model=SearchResponse)
async def search_autocomplete(
    q: str = Query("", description="Search query (empty returns user's recent recipes)"),
    limit: int = Query(5, ge=1, le=10, description="Max results per category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Quick search for autocomplete suggestions.
    Returns limited results from each category.
    When query is empty, returns user's most recent recipes as suggestions.
    """
    # If empty query, return user's recent recipes as suggestions
    if not q.strip():
        recent_recipes = db.query(Recipe).filter(
            Recipe.author_id == current_user.id,
            Recipe.deleted_at.is_(None)
        ).options(joinedload(Recipe.author)).order_by(
            Recipe.updated_at.desc()
        ).limit(limit).all()

        my_recipes = [
            SearchRecipeResult(
                id=r.id,
                title=r.title,
                description=r.description,
                cover_image_url=r.cover_image_url,
                author_name=r.author.name,
                is_own=True
            )
            for r in recent_recipes
        ]

        return SearchResponse(
            my_recipes=my_recipes,
            discover_recipes=[],
            tags=[],
            collections=[],
            users=[],
            ingredients=[],
            query=q
        )

    search_term = f"%{q.lower()}%"

    # Search user's own recipes (title, description, and ingredient names)
    my_recipes_query = db.query(Recipe).filter(
        Recipe.author_id == current_user.id,
        Recipe.deleted_at.is_(None),
        or_(
            func.lower(Recipe.title).like(search_term),
            func.lower(Recipe.description).like(search_term),
            Recipe.ingredients.any(func.lower(RecipeIngredient.name).like(search_term))
        )
    ).options(joinedload(Recipe.author)).limit(limit).all()

    my_recipes = [
        SearchRecipeResult(
            id=r.id,
            title=r.title,
            description=r.description,
            cover_image_url=r.cover_image_url,
            author_name=r.author.name,
            is_own=True
        )
        for r in my_recipes_query
    ]

    # Search public recipes (discover) - exclude own
    discover_query = db.query(Recipe).filter(
        Recipe.author_id != current_user.id,
        Recipe.privacy_level == "public",
        Recipe.status == "published",
        Recipe.deleted_at.is_(None),
        or_(
            func.lower(Recipe.title).like(search_term),
            func.lower(Recipe.description).like(search_term),
            Recipe.ingredients.any(func.lower(RecipeIngredient.name).like(search_term))
        )
    ).options(joinedload(Recipe.author)).limit(limit).all()

    discover_recipes = [
        SearchRecipeResult(
            id=r.id,
            title=r.title,
            description=r.description,
            cover_image_url=r.cover_image_url,
            author_name=r.author.name,
            is_own=False
        )
        for r in discover_query
    ]

    # Search tags
    tags_query = db.query(Tag).filter(
        func.lower(Tag.name).like(search_term)
    ).limit(limit).all()

    # Get recipe counts for tags
    tags = []
    for tag in tags_query:
        recipe_count = db.query(Recipe).filter(
            Recipe.tags.any(Tag.id == tag.id),
            Recipe.deleted_at.is_(None),
            or_(
                Recipe.author_id == current_user.id,
                and_(Recipe.privacy_level == "public", Recipe.status == "published")
            )
        ).count()
        tags.append(SearchTagResult(
            id=tag.id,
            name=tag.name,
            category=tag.category,
            recipe_count=recipe_count
        ))

    # Search user's collections
    collections_query = db.query(Collection).filter(
        Collection.user_id == current_user.id,
        func.lower(Collection.name).like(search_term)
    ).limit(limit).all()

    # Use SQL count instead of loading all recipes into memory
    collection_ids = [c.id for c in collections_query]
    collection_counts = {}
    if collection_ids:
        count_rows = db.query(
            collection_recipes.c.collection_id,
            func.count(collection_recipes.c.recipe_id)
        ).filter(
            collection_recipes.c.collection_id.in_(collection_ids)
        ).group_by(collection_recipes.c.collection_id).all()
        collection_counts = {row[0]: row[1] for row in count_rows}

    collections = [
        SearchCollectionResult(
            id=c.id,
            name=c.name,
            description=c.description,
            recipe_count=collection_counts.get(c.id, 0)
        )
        for c in collections_query
    ]

    # Search users (public profiles only)
    users_query = db.query(User).filter(
        User.id != current_user.id,
        User.is_public == True,
        func.lower(User.name).like(search_term)
    ).limit(limit).all()

    users = [
        SearchUserResult(
            id=u.id,
            name=u.name,
            profile_image_url=u.profile_image_url
        )
        for u in users_query
    ]

    # Search ingredients (from master list)
    ingredients_query = db.query(Ingredient).filter(
        func.lower(Ingredient.name).like(search_term),
        or_(
            Ingredient.is_system == True,
            Ingredient.user_id == current_user.id
        )
    ).limit(limit).all()

    # Get recipe counts for ingredients
    ingredients = []
    for ing in ingredients_query:
        recipe_count = db.query(Recipe).join(RecipeIngredient).filter(
            func.lower(RecipeIngredient.name).like(f"%{ing.name.lower()}%"),
            Recipe.deleted_at.is_(None),
            or_(
                Recipe.author_id == current_user.id,
                and_(Recipe.privacy_level == "public", Recipe.status == "published")
            )
        ).distinct().count()
        ingredients.append(SearchIngredientResult(
            id=ing.id,
            name=ing.name,
            category=ing.category,
            recipe_count=recipe_count
        ))

    return SearchResponse(
        my_recipes=my_recipes,
        discover_recipes=discover_recipes,
        tags=tags,
        collections=collections,
        users=users,
        ingredients=ingredients,
        query=q
    )


@router.get("/full", response_model=FullSearchResponse)
async def search_full(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None, description="Filter by category: recipes, tags, collections, users, ingredients"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Full search for search results page.
    Returns paginated results with totals.
    """
    search_term = f"%{q.lower()}%"
    offset = (page - 1) * page_size

    # Default limits for mixed results
    cat_limit = page_size if category else 10

    # Search recipes (both own and public — title, description, and ingredient names)
    recipes = []
    recipes_total = 0
    if not category or category == "recipes":
        recipes_query = db.query(Recipe).filter(
            Recipe.deleted_at.is_(None),
            or_(
                Recipe.author_id == current_user.id,
                and_(
                    Recipe.privacy_level == "public",
                    Recipe.status == "published"
                )
            ),
            or_(
                func.lower(Recipe.title).like(search_term),
                func.lower(Recipe.description).like(search_term),
                Recipe.ingredients.any(func.lower(RecipeIngredient.name).like(search_term))
            )
        ).options(joinedload(Recipe.author))

        recipes_total = recipes_query.count()
        recipes_data = recipes_query.order_by(Recipe.updated_at.desc()).offset(offset if category else 0).limit(cat_limit).all()

        recipes = [
            SearchRecipeResult(
                id=r.id,
                title=r.title,
                description=r.description,
                cover_image_url=r.cover_image_url,
                author_name=r.author.name,
                is_own=r.author_id == current_user.id
            )
            for r in recipes_data
        ]

    # Search tags
    tags = []
    tags_total = 0
    if not category or category == "tags":
        tags_query = db.query(Tag).filter(
            func.lower(Tag.name).like(search_term)
        )
        tags_total = tags_query.count()
        tags_data = tags_query.offset(offset if category else 0).limit(cat_limit).all()

        for tag in tags_data:
            recipe_count = db.query(Recipe).filter(
                Recipe.tags.any(Tag.id == tag.id),
                Recipe.deleted_at.is_(None),
                or_(
                    Recipe.author_id == current_user.id,
                    and_(Recipe.privacy_level == "public", Recipe.status == "published")
                )
            ).count()
            tags.append(SearchTagResult(
                id=tag.id,
                name=tag.name,
                category=tag.category,
                recipe_count=recipe_count
            ))

    # Search collections
    collections = []
    collections_total = 0
    if not category or category == "collections":
        collections_query = db.query(Collection).filter(
            Collection.user_id == current_user.id,
            func.lower(Collection.name).like(search_term)
        )
        collections_total = collections_query.count()
        collections_data = collections_query.offset(offset if category else 0).limit(cat_limit).all()

        # Use SQL count instead of loading all recipes into memory
        coll_ids = [c.id for c in collections_data]
        coll_counts = {}
        if coll_ids:
            coll_count_rows = db.query(
                collection_recipes.c.collection_id,
                func.count(collection_recipes.c.recipe_id)
            ).filter(
                collection_recipes.c.collection_id.in_(coll_ids)
            ).group_by(collection_recipes.c.collection_id).all()
            coll_counts = {row[0]: row[1] for row in coll_count_rows}

        collections = [
            SearchCollectionResult(
                id=c.id,
                name=c.name,
                description=c.description,
                recipe_count=coll_counts.get(c.id, 0)
            )
            for c in collections_data
        ]

    # Search users
    users = []
    users_total = 0
    if not category or category == "users":
        users_query = db.query(User).filter(
            User.id != current_user.id,
            User.is_public == True,
            func.lower(User.name).like(search_term)
        )
        users_total = users_query.count()
        users_data = users_query.offset(offset if category else 0).limit(cat_limit).all()

        users = [
            SearchUserResult(
                id=u.id,
                name=u.name,
                profile_image_url=u.profile_image_url
            )
            for u in users_data
        ]

    # Search ingredients
    ingredients = []
    ingredients_total = 0
    if not category or category == "ingredients":
        ingredients_query = db.query(Ingredient).filter(
            func.lower(Ingredient.name).like(search_term),
            or_(
                Ingredient.is_system == True,
                Ingredient.user_id == current_user.id
            )
        )
        ingredients_total = ingredients_query.count()
        ingredients_data = ingredients_query.offset(offset if category else 0).limit(cat_limit).all()

        for ing in ingredients_data:
            recipe_count = db.query(Recipe).join(RecipeIngredient).filter(
                func.lower(RecipeIngredient.name).like(f"%{ing.name.lower()}%"),
                Recipe.deleted_at.is_(None),
                or_(
                    Recipe.author_id == current_user.id,
                    and_(Recipe.privacy_level == "public", Recipe.status == "published")
                )
            ).distinct().count()
            ingredients.append(SearchIngredientResult(
                id=ing.id,
                name=ing.name,
                category=ing.category,
                recipe_count=recipe_count
            ))

    return FullSearchResponse(
        recipes=recipes,
        recipes_total=recipes_total,
        tags=tags,
        tags_total=tags_total,
        collections=collections,
        collections_total=collections_total,
        users=users,
        users_total=users_total,
        ingredients=ingredients,
        ingredients_total=ingredients_total,
        query=q
    )


@router.get("/ingredients/{ingredient_id}/recipes")
async def get_recipes_by_ingredient(
    ingredient_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get recipes containing a specific ingredient."""
    # Get the ingredient
    ingredient = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not ingredient:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Ingredient not found")

    # Find recipes with this ingredient
    query = db.query(Recipe).join(RecipeIngredient).filter(
        func.lower(RecipeIngredient.name).like(f"%{ingredient.name.lower()}%"),
        Recipe.deleted_at.is_(None),
        or_(
            Recipe.author_id == current_user.id,
            and_(Recipe.privacy_level == "public", Recipe.status == "published")
        )
    ).distinct().options(joinedload(Recipe.author), joinedload(Recipe.tags))

    total = query.count()
    recipes = query.order_by(Recipe.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    from schemas import RecipeSummary, RecipeListResponse
    import math

    return RecipeListResponse(
        items=[RecipeSummary.model_validate(r) for r in recipes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1
    )
