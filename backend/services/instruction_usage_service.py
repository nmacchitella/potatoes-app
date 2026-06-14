"""Validation and rendering helpers for scalable instruction ingredient usages."""

import re
from typing import Iterable, Mapping


USAGE_MARKER_RE = re.compile(r"\{\{usage:([A-Za-z0-9_-]+)\}\}")


def format_quantity(quantity: float) -> str:
    quantity = float(quantity)
    fractions = {
        0.125: "⅛",
        0.25: "¼",
        0.333: "⅓",
        0.5: "½",
        0.667: "⅔",
        0.75: "¾",
    }
    whole = int(quantity)
    decimal = quantity - whole
    for value, symbol in fractions.items():
        if abs(decimal - value) < 0.01:
            return f"{whole}{symbol}" if whole else symbol
    if quantity.is_integer():
        return str(int(quantity))
    return f"{quantity:.2f}".rstrip("0").rstrip(".")


def format_usage_amount(usage, scale: float = 1.0) -> str:
    if scale == 1.0 and getattr(usage, "base_text", None):
        return usage.base_text
    quantity = usage.quantity * scale
    quantity_max = usage.quantity_max * scale if usage.quantity_max else None
    amount = format_quantity(quantity)
    if quantity_max:
        amount = f"{amount}-{format_quantity(quantity_max)}"
    if usage.unit:
        metric_units = {"g", "kg", "mg", "ml", "L"}
        amount = f"{amount}{usage.unit}" if usage.unit in metric_units else f"{amount} {usage.unit}"
    return amount


def render_instruction_template(template: str, usages: Iterable, scale: float = 1.0) -> str:
    usage_map = {usage.usage_key: usage for usage in usages}

    def replace(match: re.Match) -> str:
        usage = usage_map.get(match.group(1))
        return format_usage_amount(usage, scale) if usage else match.group(0)

    return USAGE_MARKER_RE.sub(replace, template)


def validate_instruction_template(template: str | None, usages: Iterable, ingredient_keys: set[str]) -> None:
    usage_list = list(usages)
    if not template:
        if usage_list:
            raise ValueError("Instruction usages require an instruction template")
        return

    marker_keys = USAGE_MARKER_RE.findall(template)
    if "{{usage:" in USAGE_MARKER_RE.sub("", template):
        raise ValueError("Instruction template contains a malformed usage marker")
    usage_keys = [usage.usage_key for usage in usage_list]
    if len(marker_keys) != len(set(marker_keys)):
        raise ValueError("Each instruction usage marker may appear only once")
    if set(marker_keys) != set(usage_keys):
        raise ValueError("Instruction template markers must exactly match ingredient usages")
    if len(usage_keys) != len(set(usage_keys)):
        raise ValueError("Instruction usage keys must be unique")
    invalid_ingredients = [usage.ingredient_key for usage in usage_list if usage.ingredient_key not in ingredient_keys]
    if invalid_ingredients:
        raise ValueError(f"Instruction usages reference unknown ingredients: {invalid_ingredients}")
    for usage in usage_list:
        if not isinstance(usage.quantity, (int, float)) or usage.quantity <= 0:
            raise ValueError(f"Instruction usage {usage.usage_key} must have a positive quantity")
        if usage.quantity_max is not None and usage.quantity_max <= usage.quantity:
            raise ValueError(f"Instruction usage {usage.usage_key} has an invalid quantity range")


def validate_and_render_instruction(template: str | None, usages: Iterable, ingredient_keys: set[str], fallback: str) -> str:
    validate_instruction_template(template, usages, ingredient_keys)
    if not template:
        return fallback
    return render_instruction_template(template, usages)
