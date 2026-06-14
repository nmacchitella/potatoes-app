import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from models import Base, Recipe, RecipeIngredient, RecipeInstruction, User
from schemas.recipe import (
    InstructionIngredientUsageCreate,
    Recipe as RecipeResponse,
    RecipeIngredientCreate,
    RecipeInstructionCreate,
)
from services.recipe_service import (
    clone_recipe_content,
    create_recipe_ingredients,
    create_recipe_instructions,
    update_recipe_ingredients,
    update_recipe_instructions,
)


class RecipeInstructionUsagePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(email="cook@example.com", name="Cook")
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_create_update_and_clone_preserve_stable_links(self):
        ingredients = [
            RecipeIngredientCreate(
                key="rice",
                name="rice",
                quantity=1,
                unit="cup",
                sort_order=0,
            )
        ]
        instructions = [
            RecipeInstructionCreate(
                key="cook",
                step_number=1,
                instruction_text="Add 1 cup rice.",
                instruction_template="Add {{usage:rice_step_1}} rice.",
                ingredient_usages=[
                    InstructionIngredientUsageCreate(
                        usage_key="rice_step_1",
                        ingredient_key="rice",
                        quantity=1,
                        unit="cup",
                        base_text="1 cup",
                    )
                ],
            )
        ]
        recipe = Recipe(author_id=self.user.id, title="Rice")
        self.db.add(recipe)
        self.db.flush()
        create_recipe_ingredients(self.db, recipe.id, ingredients, self.user.id)
        create_recipe_instructions(self.db, recipe.id, instructions)
        self.db.commit()
        self.db.refresh(recipe)
        ingredient_id = recipe.ingredients[0].id
        instruction_id = recipe.instructions[0].id
        response = RecipeResponse.model_validate(recipe)
        self.assertEqual(response.instructions[0].ingredient_usages[0].ingredient_key, "rice")
        self.assertEqual(response.instructions[0].ingredient_usages[0].ingredient_name, "rice")

        update_recipe_ingredients(
            self.db,
            recipe.id,
            [ingredients[0].model_copy(update={"name": "brown rice"})],
            self.user.id,
        )
        update_recipe_instructions(
            self.db,
            recipe.id,
            [instructions[0].model_copy(update={
                "instruction_text": "Add 1 cup brown rice.",
                "instruction_template": "Add {{usage:rice_step_1}} brown rice.",
            })],
        )
        self.db.commit()
        self.db.refresh(recipe)

        self.assertEqual(recipe.ingredients[0].id, ingredient_id)
        self.assertEqual(recipe.instructions[0].id, instruction_id)
        self.assertEqual(recipe.instructions[0].ingredient_usages[0].ingredient_id, ingredient_id)

        cloned = Recipe(author_id=self.user.id, title="Rice copy")
        self.db.add(cloned)
        self.db.flush()
        clone_recipe_content(self.db, recipe, cloned, self.user.id)
        self.db.commit()
        cloned_ingredient = self.db.query(RecipeIngredient).filter_by(recipe_id=cloned.id).one()
        cloned_instruction = self.db.query(RecipeInstruction).filter_by(recipe_id=cloned.id).one()
        self.assertNotEqual(cloned_ingredient.id, ingredient_id)
        self.assertEqual(cloned_instruction.instruction_template, "Add {{usage:rice_step_1}} brown rice.")
        self.assertEqual(cloned_instruction.ingredient_usages[0].ingredient_id, cloned_ingredient.id)
        self.assertEqual(cloned_instruction.ingredient_usages[0].base_text, "1 cup")

        self.assertEqual(self.db.query(Recipe).count(), 2)

    def test_removing_linked_ingredient_keeps_literal_instruction_amount(self):
        recipe = Recipe(author_id=self.user.id, title="Tea")
        self.db.add(recipe)
        self.db.flush()
        ingredient = RecipeIngredientCreate(key="honey", name="honey", quantity=1, unit="tablespoon")
        instruction = RecipeInstructionCreate(
            key="sweeten",
            step_number=1,
            instruction_text="Stir in 1 tablespoon honey.",
            instruction_template="Stir in {{usage:honey_step_1}} honey.",
            ingredient_usages=[
                InstructionIngredientUsageCreate(
                    usage_key="honey_step_1",
                    ingredient_key="honey",
                    quantity=1,
                    unit="tablespoon",
                    base_text="1 tablespoon",
                )
            ],
        )
        create_recipe_ingredients(self.db, recipe.id, [ingredient], self.user.id)
        create_recipe_instructions(self.db, recipe.id, [instruction])
        self.db.commit()

        update_recipe_ingredients(self.db, recipe.id, [], self.user.id)
        self.db.commit()
        self.db.refresh(recipe)
        self.assertEqual(recipe.instructions[0].instruction_text, "Stir in 1 tablespoon honey.")
        self.assertIsNone(recipe.instructions[0].instruction_template)
        self.assertEqual(recipe.instructions[0].ingredient_usages, [])

        update_recipe_instructions(self.db, recipe.id, [instruction])
        self.db.commit()
        self.db.refresh(recipe)

        self.assertEqual(recipe.instructions[0].instruction_text, "Stir in 1 tablespoon honey.")
        self.assertIsNone(recipe.instructions[0].instruction_template)
        self.assertEqual(recipe.instructions[0].ingredient_usages, [])


if __name__ == "__main__":
    unittest.main()
