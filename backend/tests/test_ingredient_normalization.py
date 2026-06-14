import unittest

from services.ingredient_normalization import (
    canonicalize_unit,
    ingredient_match_key,
    normalize_recipe_ingredient_fields,
)


class IngredientNormalizationTests(unittest.TestCase):
    def test_canonicalizes_unit_aliases(self):
        self.assertEqual(canonicalize_unit("tbsp"), ("tablespoon", None))
        self.assertEqual(canonicalize_unit("g"), ("gram", None))

    def test_removes_ingredient_used_as_its_own_unit(self):
        normalized = normalize_recipe_ingredient_fields("Potatoes", "potato")
        self.assertEqual(normalized.name, "Potatoes")
        self.assertIsNone(normalized.unit)
        self.assertEqual(normalized.issues, [])

    def test_strips_portion_unit_from_ingredient_name(self):
        normalized = normalize_recipe_ingredient_fields("Garlic clove", "clove")
        self.assertEqual(normalized.name, "Garlic")
        self.assertEqual(normalized.unit, "clove")

    def test_moves_size_and_to_taste_out_of_unit(self):
        size = normalize_recipe_ingredient_fields("Eggs", "large")
        self.assertIsNone(size.unit)
        self.assertEqual(size.preparation, "large")

        taste = normalize_recipe_ingredient_fields("Salt", "to taste")
        self.assertIsNone(taste.unit)
        self.assertEqual(taste.notes, "to taste")

        leading_size = normalize_recipe_ingredient_fields("Large eggs", None)
        self.assertEqual(leading_size.name, "eggs")
        self.assertEqual(leading_size.preparation, "large")

    def test_conservative_singular_match_key(self):
        self.assertEqual(ingredient_match_key("Potatoes"), "potato")
        self.assertEqual(ingredient_match_key("egg yolks"), "egg yolk")
        self.assertEqual(ingredient_match_key("glass"), "glass")

    def test_unknown_units_are_preserved_and_reported(self):
        normalized = normalize_recipe_ingredient_fields("Stock", "ladle")
        self.assertEqual(normalized.unit, "ladle")
        self.assertEqual(normalized.issues, ["unknown_unit:ladle"])


if __name__ == "__main__":
    unittest.main()
