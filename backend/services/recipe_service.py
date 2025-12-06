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

from models import Recipe, RecipeIngredient, RecipeInstruction, Tag, Collection, Ingredient
from schemas import RecipeIngredientCreate, RecipeInstructionCreate
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
