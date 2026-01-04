"""
Grocery List Service

Handles grocery list operations including:
- Getting/creating user's grocery list
- Generating grocery list from meal plans
- Aggregating and combining ingredients
"""

from datetime import date
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from models import (
    GroceryList, GroceryListItem, MealPlan, Recipe,
    RecipeIngredient, Ingredient, User
)


# Category order for store-aisle-friendly sorting
CATEGORY_ORDER = [
    'produce',
    'dairy',
    'meat',
    'bakery',
    'frozen',
    'pantry',
    'beverages',
    'staples',  # "Check pantry" section - shown last
]

# Default category for items without one
DEFAULT_CATEGORY = 'pantry'


def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for matching/deduplication."""
    return " ".join(name.lower().strip().split())


def get_or_create_grocery_list(db: Session, user: User) -> GroceryList:
    """Get user's grocery list, creating one if it doesn't exist."""
    grocery_list = db.query(GroceryList).filter(
        GroceryList.user_id == user.id
    ).first()

    if not grocery_list:
        grocery_list = GroceryList(user_id=user.id)
        db.add(grocery_list)
        db.commit()
        db.refresh(grocery_list)

    return grocery_list


def get_grocery_list_with_items(db: Session, grocery_list_id: str) -> Optional[GroceryList]:
    """Get grocery list with all items eagerly loaded."""
    return db.query(GroceryList).options(
        joinedload(GroceryList.items),
        joinedload(GroceryList.shares)
    ).filter(GroceryList.id == grocery_list_id).first()


def clear_grocery_list(
    db: Session,
    grocery_list: GroceryList,
    checked_only: bool = False
) -> int:
    """
    Clear items from grocery list.
    Returns count of deleted items.
    """
    query = db.query(GroceryListItem).filter(
        GroceryListItem.grocery_list_id == grocery_list.id
    )

    if checked_only:
        query = query.filter(GroceryListItem.is_checked == True)

    count = query.count()
    query.delete(synchronize_session=False)
    db.commit()

    return count


def aggregate_ingredients(
    ingredients: List[Tuple[RecipeIngredient, float, str]]
) -> List[Dict]:
    """
    Aggregate ingredients from multiple recipes.

    Args:
        ingredients: List of (RecipeIngredient, scale_factor, recipe_id) tuples

    Returns:
        List of aggregated ingredient dicts
    """
    # Group by normalized name + unit
    aggregated: Dict[str, Dict] = {}

    for ingredient, scale_factor, recipe_id in ingredients:
        # Create key for grouping (normalized name + unit)
        normalized_name = normalize_ingredient_name(ingredient.name)
        unit = (ingredient.unit or '').lower().strip()
        key = f"{normalized_name}|{unit}"

        if key not in aggregated:
            # Get category from linked master ingredient if available
            category = DEFAULT_CATEGORY
            if ingredient.ingredient and ingredient.ingredient.category:
                category = ingredient.ingredient.category.lower()

            aggregated[key] = {
                'name': ingredient.name,  # Keep original casing
                'normalized_name': normalized_name,
                'quantity': 0.0,
                'unit': ingredient.unit,
                'category': category,
                'is_staple': ingredient.is_staple,
                'source_recipe_ids': set(),
            }

        # Aggregate quantity
        if ingredient.quantity:
            scaled_qty = ingredient.quantity * scale_factor
            aggregated[key]['quantity'] += scaled_qty

        # Track source recipes
        aggregated[key]['source_recipe_ids'].add(recipe_id)

        # If any instance is staple, mark as staple
        if ingredient.is_staple:
            aggregated[key]['is_staple'] = True

    # Convert sets to lists for JSON serialization
    result = []
    for item in aggregated.values():
        item['source_recipe_ids'] = list(item['source_recipe_ids'])
        # Round quantity to reasonable precision
        if item['quantity']:
            item['quantity'] = round(item['quantity'], 2)
        else:
            item['quantity'] = None
        result.append(item)

    return result


def generate_from_meal_plan(
    db: Session,
    user: User,
    start_date: date,
    end_date: date,
    merge: bool = False
) -> GroceryList:
    """
    Generate grocery list from meal plan for date range.

    Args:
        db: Database session
        user: Current user
        start_date: Start of date range
        end_date: End of date range
        merge: If True, merge with existing items. If False, replace.

    Returns:
        Updated GroceryList
    """
    # Get or create grocery list
    grocery_list = get_or_create_grocery_list(db, user)

    # Clear existing items if not merging
    if not merge:
        clear_grocery_list(db, grocery_list, checked_only=False)

    # Fetch meal plans with recipes and ingredients
    meal_plans = db.query(MealPlan).options(
        joinedload(MealPlan.recipe).joinedload(Recipe.ingredients).joinedload(RecipeIngredient.ingredient)
    ).filter(
        and_(
            MealPlan.user_id == user.id,
            MealPlan.planned_date >= start_date,
            MealPlan.planned_date <= end_date
        )
    ).all()

    # Collect all ingredients with scale factors
    ingredients_to_aggregate: List[Tuple[RecipeIngredient, float, str]] = []

    for meal_plan in meal_plans:
        recipe = meal_plan.recipe
        if not recipe:
            continue

        # Calculate scale factor based on servings
        scale_factor = 1.0
        if recipe.yield_quantity and recipe.yield_quantity > 0:
            scale_factor = meal_plan.servings / recipe.yield_quantity

        # Collect ingredients with scale factor
        for ingredient in recipe.ingredients:
            if not ingredient.is_optional:  # Skip optional ingredients
                ingredients_to_aggregate.append((ingredient, scale_factor, recipe.id))

    # Aggregate ingredients
    aggregated = aggregate_ingredients(ingredients_to_aggregate)

    # If merging, we need to combine with existing items
    if merge:
        existing_items = {
            f"{normalize_ingredient_name(item.name)}|{(item.unit or '').lower().strip()}": item
            for item in grocery_list.items
            if not item.is_checked  # Only merge with unchecked items
        }

        for agg_item in aggregated:
            key = f"{agg_item['normalized_name']}|{(agg_item['unit'] or '').lower().strip()}"

            if key in existing_items:
                # Update existing item
                existing = existing_items[key]
                if agg_item['quantity'] and existing.quantity:
                    existing.quantity += agg_item['quantity']
                elif agg_item['quantity']:
                    existing.quantity = agg_item['quantity']

                # Merge source recipe IDs
                existing_sources = existing.source_recipe_ids or []
                new_sources = set(existing_sources) | set(agg_item['source_recipe_ids'])
                existing.source_recipe_ids = list(new_sources)
            else:
                # Add new item
                _create_grocery_item(db, grocery_list, agg_item)
    else:
        # Create all new items
        for sort_order, agg_item in enumerate(aggregated):
            _create_grocery_item(db, grocery_list, agg_item, sort_order)

    db.commit()
    db.refresh(grocery_list)

    return grocery_list


def _create_grocery_item(
    db: Session,
    grocery_list: GroceryList,
    item_data: Dict,
    sort_order: int = 0
) -> GroceryListItem:
    """Create a grocery list item from aggregated data."""
    # Put staples in their own category
    category = item_data['category']
    if item_data['is_staple']:
        category = 'staples'

    item = GroceryListItem(
        grocery_list_id=grocery_list.id,
        name=item_data['name'],
        quantity=item_data['quantity'],
        unit=item_data['unit'],
        category=category,
        is_staple=item_data['is_staple'],
        is_manual=False,
        source_recipe_ids=item_data['source_recipe_ids'],
        sort_order=sort_order
    )
    db.add(item)
    return item


def group_items_by_category(items: List[GroceryListItem]) -> Dict[str, List[GroceryListItem]]:
    """
    Group grocery list items by category in store-aisle order.
    Staples go last in a "Check pantry" section.
    """
    grouped: Dict[str, List[GroceryListItem]] = {}

    for item in items:
        category = item.category or DEFAULT_CATEGORY
        if category not in grouped:
            grouped[category] = []
        grouped[category].append(item)

    # Sort categories by CATEGORY_ORDER
    sorted_grouped = {}
    for cat in CATEGORY_ORDER:
        if cat in grouped:
            # Sort items within category alphabetically
            sorted_grouped[cat] = sorted(grouped[cat], key=lambda x: x.name.lower())

    # Add any categories not in our order list
    for cat in grouped:
        if cat not in sorted_grouped:
            sorted_grouped[cat] = sorted(grouped[cat], key=lambda x: x.name.lower())

    return sorted_grouped
