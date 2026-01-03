"""
Recipe Service

Business logic for recipe operations including:
- Creating recipe ingredients and instructions
- Recipe cloning
- Recipe CRUD helpers
"""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from models import Recipe, RecipeIngredient, RecipeInstruction, Tag, Collection, Ingredient, recipe_sub_recipes
from schemas import RecipeIngredientCreate, RecipeInstructionCreate, SubRecipeInput
from routers.ingredient_router import find_or_create_ingredient

logger = logging.getLogger("potatoes.recipe_service")


def create_recipe_ingredients(
    db: Session,
    recipe_id: str,
    ingredients_data: List[RecipeIngredientCreate],
    user_id: str,
) -> List[RecipeIngredient]:
    """
    Create recipe ingredients and link them to master Ingredient entities.

    Args:
        db: Database session
        recipe_id: ID of the recipe to add ingredients to
        ingredients_data: List of ingredient data from request
        user_id: ID of the user creating the recipe

    Returns:
        List of created RecipeIngredient objects
    """
    created_ingredients = []

    for idx, ing_data in enumerate(ingredients_data):
        # Find or create the master ingredient entity
        master_ingredient = find_or_create_ingredient(
            db=db,
            name=ing_data.name,
            user_id=user_id
        )

        ingredient = RecipeIngredient(
            recipe_id=recipe_id,
            ingredient_id=master_ingredient.id,
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
        created_ingredients.append(ingredient)

    logger.debug(f"Created {len(created_ingredients)} ingredients for recipe {recipe_id}")
    return created_ingredients


def create_recipe_instructions(
    db: Session,
    recipe_id: str,
    instructions_data: List[RecipeInstructionCreate],
) -> List[RecipeInstruction]:
    """
    Create recipe instructions.

    Args:
        db: Database session
        recipe_id: ID of the recipe to add instructions to
        instructions_data: List of instruction data from request

    Returns:
        List of created RecipeInstruction objects
    """
    created_instructions = []

    for idx, inst_data in enumerate(instructions_data):
        instruction = RecipeInstruction(
            recipe_id=recipe_id,
            step_number=inst_data.step_number if inst_data.step_number else idx + 1,
            instruction_text=inst_data.instruction_text,
            duration_minutes=inst_data.duration_minutes,
            instruction_group=inst_data.instruction_group,
        )
        db.add(instruction)
        created_instructions.append(instruction)

    logger.debug(f"Created {len(created_instructions)} instructions for recipe {recipe_id}")
    return created_instructions


def update_recipe_ingredients(
    db: Session,
    recipe_id: str,
    ingredients_data: List[RecipeIngredientCreate],
    user_id: str,
) -> List[RecipeIngredient]:
    """
    Replace all ingredients for a recipe.

    Deletes existing ingredients and creates new ones.
    """
    # Delete existing ingredients
    db.query(RecipeIngredient).filter(
        RecipeIngredient.recipe_id == recipe_id
    ).delete()

    # Create new ingredients
    return create_recipe_ingredients(db, recipe_id, ingredients_data, user_id)


def update_recipe_instructions(
    db: Session,
    recipe_id: str,
    instructions_data: List[RecipeInstructionCreate],
) -> List[RecipeInstruction]:
    """
    Replace all instructions for a recipe.

    Deletes existing instructions and creates new ones.
    """
    # Delete existing instructions
    db.query(RecipeInstruction).filter(
        RecipeInstruction.recipe_id == recipe_id
    ).delete()

    # Create new instructions
    return create_recipe_instructions(db, recipe_id, instructions_data)


def clone_recipe_content(
    db: Session,
    original: Recipe,
    clone: Recipe,
    user_id: str,
) -> None:
    """
    Clone ingredients and instructions from original recipe to clone.

    Args:
        db: Database session
        original: Source recipe to clone from
        clone: Target recipe to clone to
        user_id: ID of the user creating the clone
    """
    # Clone ingredients
    for ing in original.ingredients:
        master_ingredient = find_or_create_ingredient(
            db=db,
            name=ing.name,
            user_id=user_id
        )

        new_ing = RecipeIngredient(
            recipe_id=clone.id,
            ingredient_id=master_ingredient.id,
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

    # Clone tags
    clone.tags = original.tags.copy() if original.tags else []

    logger.info(f"Cloned recipe {original.id} to {clone.id} for user {user_id}")


# ============================================================================
# SUB-RECIPE MANAGEMENT
# ============================================================================

def validate_no_circular_reference(
    db: Session,
    parent_recipe_id: str,
    sub_recipe_ids: List[str],
) -> None:
    """
    Validate that adding sub-recipes won't create circular references.

    Raises:
        ValueError: If a circular reference would be created.
    """
    # Check if any of the sub-recipes are ancestors of the parent
    for sub_recipe_id in sub_recipe_ids:
        if sub_recipe_id == parent_recipe_id:
            raise ValueError("A recipe cannot be a sub-recipe of itself")

        # Check if parent_recipe is already a sub-recipe of sub_recipe_id
        # (i.e., sub_recipe -> parent would create a cycle)
        result = db.execute(
            recipe_sub_recipes.select().where(
                recipe_sub_recipes.c.parent_recipe_id == sub_recipe_id,
                recipe_sub_recipes.c.sub_recipe_id == parent_recipe_id,
            )
        ).first()

        if result:
            raise ValueError(
                f"Circular reference detected: recipe {sub_recipe_id} already uses this recipe as a sub-recipe"
            )


def update_recipe_sub_recipes(
    db: Session,
    recipe_id: str,
    sub_recipe_inputs: List[SubRecipeInput],
    user_id: str,
) -> None:
    """
    Update sub-recipes for a recipe.

    Validates:
    - No circular references
    - Sub-recipes exist and are accessible (user's own or public)
    - One level only (sub-recipes can't have their own sub-recipes that we link)

    Args:
        db: Database session
        recipe_id: ID of the parent recipe
        sub_recipe_inputs: List of sub-recipe input data
        user_id: ID of the user making the change

    Raises:
        ValueError: If validation fails
    """
    if not sub_recipe_inputs:
        # Clear all sub-recipes
        db.execute(
            recipe_sub_recipes.delete().where(
                recipe_sub_recipes.c.parent_recipe_id == recipe_id
            )
        )
        return

    sub_recipe_ids = [s.sub_recipe_id for s in sub_recipe_inputs]

    # Validate no circular references
    validate_no_circular_reference(db, recipe_id, sub_recipe_ids)

    # Validate all sub-recipes exist and are accessible
    accessible_recipes = db.query(Recipe).filter(
        Recipe.id.in_(sub_recipe_ids),
        Recipe.deleted_at.is_(None),
        # Must be user's own recipe OR public
        (Recipe.author_id == user_id) | (Recipe.privacy_level == "public")
    ).all()

    accessible_ids = {r.id for r in accessible_recipes}
    missing_ids = set(sub_recipe_ids) - accessible_ids

    if missing_ids:
        raise ValueError(f"Sub-recipes not found or not accessible: {missing_ids}")

    # Delete existing sub-recipe links
    db.execute(
        recipe_sub_recipes.delete().where(
            recipe_sub_recipes.c.parent_recipe_id == recipe_id
        )
    )

    # Insert new sub-recipe links
    for sub_input in sub_recipe_inputs:
        db.execute(
            recipe_sub_recipes.insert().values(
                parent_recipe_id=recipe_id,
                sub_recipe_id=sub_input.sub_recipe_id,
                sort_order=sub_input.sort_order,
                scale_factor=sub_input.scale_factor,
                section_title=sub_input.section_title,
            )
        )

    logger.info(f"Updated {len(sub_recipe_inputs)} sub-recipes for recipe {recipe_id}")
