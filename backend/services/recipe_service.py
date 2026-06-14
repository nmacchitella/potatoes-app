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

from models import (
    Recipe, RecipeIngredient, RecipeInstruction, InstructionIngredientUsage,
    Tag, Collection, Ingredient, recipe_sub_recipes, generate_uuid,
)
from schemas import RecipeIngredientCreate, RecipeInstructionCreate, SubRecipeInput
from routers.ingredient_router import find_or_create_ingredient
from services.instruction_usage_service import (
    format_usage_amount,
    validate_and_render_instruction,
)
from services.ingredient_normalization import ingredient_match_key, normalize_recipe_ingredient_fields

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
    provided_keys = [ingredient.key for ingredient in ingredients_data if ingredient.key]
    if len(provided_keys) != len(set(provided_keys)):
        raise ValueError("Recipe ingredient keys must be unique")

    for idx, ing_data in enumerate(ingredients_data):
        normalized = normalize_recipe_ingredient_fields(
            ing_data.name,
            ing_data.unit,
            ing_data.preparation,
            ing_data.notes,
        )
        # Find or create the master ingredient entity
        master_ingredient = find_or_create_ingredient(
            db=db,
            name=normalized.name,
            user_id=user_id
        )

        ingredient = RecipeIngredient(
            recipe_id=recipe_id,
            key=ing_data.key or generate_uuid(),
            ingredient_id=master_ingredient.id,
            sort_order=ing_data.sort_order if ing_data.sort_order else idx,
            quantity=ing_data.quantity,
            quantity_max=ing_data.quantity_max,
            unit=normalized.unit,
            name=normalized.name,
            preparation=normalized.preparation,
            is_optional=ing_data.is_optional,
            is_staple=ing_data.is_staple,
            ingredient_group=ing_data.ingredient_group,
            notes=normalized.notes,
        )
        db.add(ingredient)
        created_ingredients.append(ingredient)

    db.flush()
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
    provided_keys = [instruction.key for instruction in instructions_data if instruction.key]
    if len(provided_keys) != len(set(provided_keys)):
        raise ValueError("Recipe instruction keys must be unique")
    ingredient_by_key = {
        ingredient.key: ingredient
        for ingredient in db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).all()
    }
    ingredient_keys = set(ingredient_by_key)

    for idx, inst_data in enumerate(instructions_data):
        template = inst_data.instruction_template if inst_data.ingredient_usages else None
        instruction = RecipeInstruction(
            recipe_id=recipe_id,
            key=inst_data.key or generate_uuid(),
            step_number=inst_data.step_number if inst_data.step_number else idx + 1,
            instruction_text=validate_and_render_instruction(
                template,
                inst_data.ingredient_usages,
                ingredient_keys,
                inst_data.instruction_text,
            ),
            instruction_template=template,
            duration_minutes=inst_data.duration_minutes,
            instruction_group=inst_data.instruction_group,
        )
        db.add(instruction)
        db.flush()
        for usage_idx, usage_data in enumerate(inst_data.ingredient_usages):
            db.add(InstructionIngredientUsage(
                instruction_id=instruction.id,
                ingredient_id=ingredient_by_key[usage_data.ingredient_key].id,
                usage_key=usage_data.usage_key,
                quantity=usage_data.quantity,
                quantity_max=usage_data.quantity_max,
                unit=usage_data.unit,
                base_text=usage_data.base_text,
                sort_order=usage_data.sort_order if usage_data.sort_order else usage_idx,
            ))
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
    Upsert ingredients by stable recipe-local key.
    """
    provided_keys = [ingredient.key for ingredient in ingredients_data if ingredient.key]
    if len(provided_keys) != len(set(provided_keys)):
        raise ValueError("Recipe ingredient keys must be unique")

    existing = {
        ingredient.key: ingredient
        for ingredient in db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).all()
    }
    kept_keys = set()
    result = []
    unused_existing = set(existing) - set(provided_keys)

    for idx, ing_data in enumerate(ingredients_data):
        normalized = normalize_recipe_ingredient_fields(
            ing_data.name,
            ing_data.unit,
            ing_data.preparation,
            ing_data.notes,
        )
        key = ing_data.key
        if not key:
            match = next((
                existing_key for existing_key in unused_existing
                if existing[existing_key].sort_order == idx
                and ingredient_match_key(existing[existing_key].name) == ingredient_match_key(normalized.name)
            ), None)
            key = match or generate_uuid()
        unused_existing.discard(key)
        kept_keys.add(key)
        master_ingredient = find_or_create_ingredient(db=db, name=normalized.name, user_id=user_id)
        ingredient = existing.get(key)
        if not ingredient:
            ingredient = RecipeIngredient(recipe_id=recipe_id, key=key)
            db.add(ingredient)
        ingredient.ingredient_id = master_ingredient.id
        ingredient.sort_order = ing_data.sort_order if ing_data.sort_order else idx
        ingredient.quantity = ing_data.quantity
        ingredient.quantity_max = ing_data.quantity_max
        ingredient.unit = normalized.unit
        ingredient.name = normalized.name
        ingredient.preparation = normalized.preparation
        ingredient.is_optional = ing_data.is_optional
        ingredient.is_staple = ing_data.is_staple
        ingredient.ingredient_group = ing_data.ingredient_group
        ingredient.notes = normalized.notes
        result.append(ingredient)

    for key, ingredient in existing.items():
        if key in kept_keys:
            continue
        for usage in list(ingredient.instruction_usages):
            instruction = usage.instruction
            if instruction.instruction_template:
                marker = f"{{{{usage:{usage.usage_key}}}}}"
                instruction.instruction_template = instruction.instruction_template.replace(
                    marker, format_usage_amount(usage)
                )
        db.delete(ingredient)

    db.flush()
    for instruction in db.query(RecipeInstruction).filter(RecipeInstruction.recipe_id == recipe_id).all():
        if instruction.instruction_template and not instruction.ingredient_usages:
            instruction.instruction_template = None
    return result


def update_recipe_instructions(
    db: Session,
    recipe_id: str,
    instructions_data: List[RecipeInstructionCreate],
) -> List[RecipeInstruction]:
    """
    Upsert instructions and their usages by stable recipe-local key.
    """
    provided_keys = [instruction.key for instruction in instructions_data if instruction.key]
    if len(provided_keys) != len(set(provided_keys)):
        raise ValueError("Recipe instruction keys must be unique")

    existing = {
        instruction.key: instruction
        for instruction in db.query(RecipeInstruction).filter(RecipeInstruction.recipe_id == recipe_id).all()
    }
    ingredient_by_key = {
        ingredient.key: ingredient
        for ingredient in db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).all()
    }
    ingredient_keys = set(ingredient_by_key)
    kept_keys = set()
    result = []
    unused_existing = set(existing) - set(provided_keys)

    for idx, inst_data in enumerate(instructions_data):
        key = inst_data.key
        if not key:
            match = next((
                existing_key for existing_key in unused_existing
                if existing[existing_key].step_number == inst_data.step_number
            ), None)
            key = match or generate_uuid()
        unused_existing.discard(key)
        kept_keys.add(key)
        instruction = existing.get(key)
        if not instruction:
            instruction = RecipeInstruction(recipe_id=recipe_id, key=key)
            db.add(instruction)

        template = inst_data.instruction_template
        usages = []
        for usage_data in inst_data.ingredient_usages:
            if usage_data.ingredient_key in ingredient_keys:
                usages.append(usage_data)
            elif template:
                template = template.replace(
                    f"{{{{usage:{usage_data.usage_key}}}}}",
                    format_usage_amount(usage_data),
                )

        instruction.step_number = inst_data.step_number if inst_data.step_number else idx + 1
        instruction.instruction_text = validate_and_render_instruction(
            template,
            usages,
            ingredient_keys,
            inst_data.instruction_text,
        )
        instruction.instruction_template = template if usages else None
        instruction.duration_minutes = inst_data.duration_minutes
        instruction.instruction_group = inst_data.instruction_group
        db.flush()

        instruction.ingredient_usages.clear()
        db.flush()
        for usage_idx, usage_data in enumerate(usages):
            instruction.ingredient_usages.append(InstructionIngredientUsage(
                ingredient_id=ingredient_by_key[usage_data.ingredient_key].id,
                usage_key=usage_data.usage_key,
                quantity=usage_data.quantity,
                quantity_max=usage_data.quantity_max,
                unit=usage_data.unit,
                base_text=usage_data.base_text,
                sort_order=usage_data.sort_order if usage_data.sort_order else usage_idx,
            ))
        result.append(instruction)

    for key, instruction in existing.items():
        if key not in kept_keys:
            db.delete(instruction)

    db.flush()
    return result


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
    ingredient_id_map = {}
    for ing in original.ingredients:
        normalized = normalize_recipe_ingredient_fields(
            ing.name,
            ing.unit,
            ing.preparation,
            ing.notes,
        )
        master_ingredient = find_or_create_ingredient(
            db=db,
            name=normalized.name,
            user_id=user_id
        )

        new_ing = RecipeIngredient(
            recipe_id=clone.id,
            key=ing.key,
            ingredient_id=master_ingredient.id,
            sort_order=ing.sort_order,
            quantity=ing.quantity,
            quantity_max=ing.quantity_max,
            unit=normalized.unit,
            name=normalized.name,
            preparation=normalized.preparation,
            is_optional=ing.is_optional,
            is_staple=ing.is_staple,
            ingredient_group=ing.ingredient_group,
            notes=normalized.notes,
        )
        db.add(new_ing)
        db.flush()
        ingredient_id_map[ing.id] = new_ing.id

    # Clone instructions
    for inst in original.instructions:
        new_inst = RecipeInstruction(
            recipe_id=clone.id,
            key=inst.key,
            step_number=inst.step_number,
            instruction_text=inst.instruction_text,
            instruction_template=inst.instruction_template,
            duration_minutes=inst.duration_minutes,
            instruction_group=inst.instruction_group,
        )
        db.add(new_inst)
        db.flush()
        for usage in inst.ingredient_usages:
            db.add(InstructionIngredientUsage(
                instruction_id=new_inst.id,
                ingredient_id=ingredient_id_map[usage.ingredient_id],
                usage_key=usage.usage_key,
                quantity=usage.quantity,
                quantity_max=usage.quantity_max,
                unit=usage.unit,
                base_text=usage.base_text,
                sort_order=usage.sort_order,
            ))

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
