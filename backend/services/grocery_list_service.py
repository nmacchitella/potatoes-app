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
    GroceryList, GroceryListItem, MealPlan, MealPlanCalendar, MealPlanShare,
    Recipe, RecipeIngredient, Ingredient, User
)


# Category order for store-aisle-friendly sorting
CATEGORY_ORDER = [
    'produce',
    'dairy',
    'meat',
    'deli',
    'bakery',
    'frozen',
    'pantry',
    'grains',
    'canned',
    'oils',
    'spices',
    'condiments',
    'baking',
    'beverages',
    'snacks',
    'nuts',
    'international',
    'health',
    'staples',  # "Check pantry" section - shown last
    'other',
]

# Default category for items without one
DEFAULT_CATEGORY = 'pantry'


def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for matching/deduplication."""
    return " ".join(name.lower().strip().split())


def get_user_grocery_lists(db: Session, user: User) -> list:
    """Get all grocery lists for a user."""
    return db.query(GroceryList).filter(
        GroceryList.user_id == user.id
    ).order_by(GroceryList.created_at.desc()).all()


def create_grocery_list(db: Session, user: User, name: str = "My Grocery List") -> GroceryList:
    """Create a new grocery list for a user."""
    grocery_list = GroceryList(user_id=user.id, name=name)
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

    Now combines same ingredients with different units into a single item,
    showing combined quantities like "2 oz + 1 tbsp" when units don't match.
    """
    # Group by normalized name only (not unit) to combine same ingredients
    aggregated: Dict[str, Dict] = {}

    for ingredient, scale_factor, recipe_id in ingredients:
        # Create key for grouping - only by normalized name
        normalized_name = normalize_ingredient_name(ingredient.name)
        key = normalized_name

        if key not in aggregated:
            # Get category from linked master ingredient if available
            category = DEFAULT_CATEGORY
            if ingredient.ingredient and ingredient.ingredient.category:
                category = ingredient.ingredient.category.lower()

            aggregated[key] = {
                'name': ingredient.name,  # Keep original casing
                'normalized_name': normalized_name,
                'quantities': {},  # Dict of unit -> quantity
                'category': category,
                'is_staple': ingredient.is_staple,
                'source_recipe_ids': set(),
            }

        # Aggregate quantity by unit
        if ingredient.quantity:
            unit = (ingredient.unit or '').lower().strip()
            scaled_qty = ingredient.quantity * scale_factor
            if unit not in aggregated[key]['quantities']:
                aggregated[key]['quantities'][unit] = 0.0
            aggregated[key]['quantities'][unit] += scaled_qty

        # Track source recipes
        aggregated[key]['source_recipe_ids'].add(recipe_id)

        # If any instance is staple, mark as staple
        if ingredient.is_staple:
            aggregated[key]['is_staple'] = True

    # Convert to final format
    result = []
    for item in aggregated.values():
        item['source_recipe_ids'] = list(item['source_recipe_ids'])

        # Process quantities - combine if multiple units
        quantities = item.pop('quantities')
        if not quantities:
            item['quantity'] = None
            item['unit'] = None
        elif len(quantities) == 1:
            # Single unit - simple case
            unit, qty = list(quantities.items())[0]
            item['quantity'] = round(qty, 2) if qty else None
            item['unit'] = unit if unit else None
        else:
            # Multiple units - combine into display string
            # Sort by quantity descending to show largest first
            sorted_qtys = sorted(quantities.items(), key=lambda x: x[1], reverse=True)
            parts = []
            total_qty = 0.0
            for unit, qty in sorted_qtys:
                rounded_qty = round(qty, 2)
                total_qty += rounded_qty
                if unit:
                    parts.append(f"{rounded_qty} {unit}")
                else:
                    parts.append(str(rounded_qty))
            # Store total as quantity, combined string as unit
            item['quantity'] = round(total_qty, 2)
            item['unit'] = ' + '.join(parts)

        result.append(item)

    return result


def generate_from_meal_plan(
    db: Session,
    grocery_list: GroceryList,
    user: User,
    start_date: date,
    end_date: date,
    merge: bool = False,
    calendar_ids: Optional[List[str]] = None
) -> GroceryList:
    """
    Generate grocery list from meal plan for date range.

    Args:
        db: Database session
        grocery_list: The grocery list to populate
        user: Current user
        start_date: Start of date range
        end_date: End of date range
        merge: If True, merge with existing items. If False, replace.
        calendar_ids: Optional list of calendar IDs to include. If None, uses all accessible calendars.

    Returns:
        Updated GroceryList
    """

    # Clear existing items if not merging
    if not merge:
        clear_grocery_list(db, grocery_list, checked_only=False)

    # Get accessible calendar IDs (owned + shared)
    if calendar_ids is None:
        # Get owned calendars
        owned = db.query(MealPlanCalendar.id).filter(
            MealPlanCalendar.user_id == user.id
        ).all()
        # Get shared calendars
        shared = db.query(MealPlanShare.calendar_id).filter(
            MealPlanShare.user_id == user.id
        ).all()
        accessible_calendar_ids = [c[0] for c in owned] + [c[0] for c in shared]
    else:
        # Verify user has access to requested calendars
        owned = db.query(MealPlanCalendar.id).filter(
            MealPlanCalendar.user_id == user.id,
            MealPlanCalendar.id.in_(calendar_ids)
        ).all()
        shared = db.query(MealPlanShare.calendar_id).filter(
            MealPlanShare.user_id == user.id,
            MealPlanShare.calendar_id.in_(calendar_ids)
        ).all()
        accessible_calendar_ids = [c[0] for c in owned] + [c[0] for c in shared]

    if not accessible_calendar_ids:
        # No accessible calendars, return empty list
        return grocery_list

    # Fetch meal plans with recipes and ingredients
    meal_plans = db.query(MealPlan).options(
        joinedload(MealPlan.recipe).joinedload(Recipe.ingredients).joinedload(RecipeIngredient.ingredient)
    ).filter(
        and_(
            MealPlan.calendar_id.in_(accessible_calendar_ids),
            MealPlan.planned_date >= start_date,
            MealPlan.planned_date <= end_date
        )
    ).all()

    # Collect all ingredients with scale factors
    ingredients_to_aggregate: List[Tuple[RecipeIngredient, float, str]] = []
    # Collect grocery items from custom meals
    custom_grocery_items: List[Dict] = []

    for meal_plan in meal_plans:
        recipe = meal_plan.recipe
        if recipe:
            # Recipe-based meal: collect structured ingredients
            scale_factor = 1.0
            if recipe.yield_quantity and recipe.yield_quantity > 0:
                scale_factor = meal_plan.servings / recipe.yield_quantity

            for ingredient in recipe.ingredients:
                if not ingredient.is_optional:
                    ingredients_to_aggregate.append((ingredient, scale_factor, recipe.id))
        elif meal_plan.custom_title:
            # Custom meal: use grocery_items if provided, otherwise fall back to title
            if meal_plan.grocery_items:
                for gi in meal_plan.grocery_items:
                    custom_grocery_items.append({
                        'name': gi.get('name', ''),
                        'quantity': gi.get('quantity'),
                        'unit': gi.get('unit'),
                        'category': (gi.get('category') or 'other').lower(),
                    })
            else:
                custom_grocery_items.append({
                    'name': meal_plan.custom_title,
                    'quantity': None,
                    'unit': None,
                    'category': 'other',
                })

    # Aggregate recipe ingredients
    aggregated = aggregate_ingredients(ingredients_to_aggregate)

    # Deduplicate custom grocery items by normalized name
    custom_aggregated: Dict[str, Dict] = {}
    for ci in custom_grocery_items:
        key = normalize_ingredient_name(ci['name'])
        if key not in custom_aggregated:
            custom_aggregated[key] = {
                'name': ci['name'],
                'quantity': ci['quantity'],
                'unit': ci['unit'],
                'category': ci['category'],
                'is_staple': False,
                'source_recipe_ids': [],
            }
        elif ci['quantity'] and custom_aggregated[key]['quantity']:
            if (ci['unit'] or '') == (custom_aggregated[key]['unit'] or ''):
                custom_aggregated[key]['quantity'] += ci['quantity']
    aggregated.extend(custom_aggregated.values())

    # If merging, we need to combine with existing items
    if merge:
        existing_items = {
            normalize_ingredient_name(item.name): item
            for item in grocery_list.items
            if not item.is_checked  # Only merge with unchecked items
        }

        for agg_item in aggregated:
            key = agg_item['normalized_name']

            if key in existing_items:
                # Update existing item
                existing = existing_items[key]

                # Handle quantity merging
                if agg_item['quantity'] and existing.quantity:
                    # If units are different, combine them in unit string
                    existing_unit = (existing.unit or '').strip()
                    new_unit = (agg_item['unit'] or '').strip()
                    if existing_unit == new_unit or not new_unit:
                        existing.quantity += agg_item['quantity']
                    else:
                        # Combine different units
                        existing.quantity += agg_item['quantity']
                        if existing_unit and new_unit:
                            # Both have units - combine them
                            if ' + ' in existing_unit:
                                existing.unit = f"{existing_unit} + {agg_item['quantity']} {new_unit}"
                            else:
                                existing.unit = f"{existing.quantity - agg_item['quantity']} {existing_unit} + {agg_item['quantity']} {new_unit}"
                        elif new_unit:
                            existing.unit = new_unit
                elif agg_item['quantity']:
                    existing.quantity = agg_item['quantity']
                    existing.unit = agg_item['unit']

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
