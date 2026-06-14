import unittest
from types import SimpleNamespace

from services.instruction_usage_service import (
    render_instruction_template,
    validate_instruction_template,
)


class InstructionUsageServiceTests(unittest.TestCase):
    def test_scales_only_usage_markers(self):
        usage = SimpleNamespace(
            usage_key="milk_step_1",
            ingredient_key="milk",
            quantity=0.5,
            quantity_max=None,
            unit="cup",
            base_text=None,
        )
        rendered = render_instruction_template(
            "Add {{usage:milk_step_1}} milk and simmer for 20 minutes at 180C.",
            [usage],
            scale=2,
        )
        self.assertEqual(rendered, "Add 1 cup milk and simmer for 20 minutes at 180C.")

    def test_validates_marker_and_ingredient_links(self):
        usage = SimpleNamespace(
            usage_key="milk_step_1",
            ingredient_key="milk",
            quantity=1,
            quantity_max=None,
            unit="cup",
            base_text=None,
        )
        validate_instruction_template("Add {{usage:milk_step_1}} milk.", [usage], {"milk"})

        with self.assertRaises(ValueError):
            validate_instruction_template("Add milk.", [usage], {"milk"})

        with self.assertRaises(ValueError):
            validate_instruction_template("Add {{usage:milk_step_1}} milk.", [usage], {"flour"})

        with self.assertRaises(ValueError):
            validate_instruction_template(
                "Add {{usage:milk_step_1}} milk and {{usage:not valid}} cream.",
                [usage],
                {"milk"},
            )

    def test_rejects_invalid_usage_quantities(self):
        usage = SimpleNamespace(
            usage_key="milk_step_1",
            ingredient_key="milk",
            quantity=None,
            quantity_max=None,
            unit="cup",
            base_text="1 cup",
        )
        with self.assertRaises(ValueError):
            validate_instruction_template("Add {{usage:milk_step_1}} milk.", [usage], {"milk"})

    def test_preserves_original_amount_text_at_base_scale(self):
        usage = SimpleNamespace(
            usage_key="milk_step_1",
            ingredient_key="milk",
            quantity=0.5,
            quantity_max=None,
            unit="cup",
            base_text="1/2 cup",
        )
        self.assertEqual(
            render_instruction_template("Add {{usage:milk_step_1}} milk.", [usage]),
            "Add 1/2 cup milk.",
        )


if __name__ == "__main__":
    unittest.main()
