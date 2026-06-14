"""Conservative normalization and auditing for recipe ingredient fields."""

from dataclasses import asdict, dataclass
import re
from typing import Optional

from services.ingredient_parser import UNIT_LOOKUP, UNIT_MAPPINGS


INVALID_UNIT_VALUES = {
    "amount needed",
    "amount not specified",
    "as needed",
    "none",
    "not specified",
    "null",
    "optional",
    "to taste",
    "unit",
}

INFORMAL_UNITS = {
    "batch",
    "bulb",
    "cube",
    "drizzle",
    "glass",
    "handful",
    "leaf",
    "spoon",
    "spoonful",
    "sprinkle",
    "stem",
}

SIZE_DESCRIPTORS = {
    "extra-large",
    "extra large",
    "large",
    "medium",
    "small",
    "whole",
}

LEADING_SIZE_DESCRIPTORS = {
    "extra-large",
    "extra large",
    "large",
    "medium",
    "small",
}

PORTION_UNITS = {
    "bottle",
    "box",
    "bunch",
    "can",
    "clove",
    "head",
    "jar",
    "package",
    "piece",
    "slice",
    "sprig",
    "stalk",
    "stick",
}

CANONICAL_UNITS = sorted(set(UNIT_MAPPINGS) | INFORMAL_UNITS)

IRREGULAR_SINGULARS = {
    "cloves": "clove",
    "feet": "foot",
    "leaves": "leaf",
    "loaves": "loaf",
    "mice": "mouse",
    "potatoes": "potato",
    "tomatoes": "tomato",
}


@dataclass
class NormalizedIngredientFields:
    name: str
    unit: Optional[str]
    preparation: Optional[str]
    notes: Optional[str]
    changes: list[str]
    issues: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def _clean_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(value.strip().split())
    if not cleaned or cleaned.lower() == "null":
        return None
    return cleaned


def _append_text(existing: Optional[str], value: str) -> str:
    if not existing:
        return value
    existing_parts = [part.strip() for part in existing.split(",")]
    if value.lower() in {part.lower() for part in existing_parts}:
        return existing
    return f"{existing}, {value}"


def singularize_last_word(value: str) -> str:
    """Return a conservative singular form for matching, not display."""
    words = value.split()
    if not words:
        return value
    word = words[-1]
    lower = word.lower()
    if lower in IRREGULAR_SINGULARS:
        words[-1] = IRREGULAR_SINGULARS[lower]
    elif lower.endswith("ies") and len(lower) > 4:
        words[-1] = lower[:-3] + "y"
    elif lower.endswith(("ches", "shes", "xes", "zes")) and len(lower) > 4:
        words[-1] = lower[:-2]
    elif lower.endswith("s") and not lower.endswith(("ss", "us", "is")) and len(lower) > 3:
        words[-1] = lower[:-1]
    return " ".join(words)


def ingredient_match_key(name: str) -> str:
    cleaned = re.sub(r"[-_]+", " ", name.lower().strip())
    cleaned = " ".join(cleaned.split())
    return singularize_last_word(cleaned)


def canonicalize_unit(unit: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Return canonical unit and an issue label for unknown values."""
    cleaned = _clean_optional_text(unit)
    if not cleaned:
        return None, None
    lower = cleaned.lower().rstrip(".")
    if lower in INVALID_UNIT_VALUES:
        return None, "placeholder_unit"
    if lower in UNIT_LOOKUP:
        return UNIT_LOOKUP[lower], None
    if lower in INFORMAL_UNITS:
        return lower, None
    if lower in SIZE_DESCRIPTORS:
        return None, "size_as_unit"
    return lower, "unknown_unit"


def normalize_recipe_ingredient_fields(
    name: str,
    unit: Optional[str],
    preparation: Optional[str] = None,
    notes: Optional[str] = None,
) -> NormalizedIngredientFields:
    original_name = name
    original_unit = unit
    original_preparation = preparation
    original_notes = notes
    name = " ".join(name.strip().split())
    preparation = _clean_optional_text(preparation)
    notes = _clean_optional_text(notes)
    canonical_unit, unit_issue = canonicalize_unit(unit)
    changes: list[str] = []
    issues: list[str] = []

    raw_unit = _clean_optional_text(unit)
    raw_unit_lower = raw_unit.lower().rstrip(".") if raw_unit else None
    if unit_issue == "placeholder_unit":
        if raw_unit_lower == "to taste":
            notes = _append_text(notes, "to taste")
        changes.append(f"unit:{original_unit!r}->None")
    elif unit_issue == "size_as_unit" and raw_unit_lower:
        preparation = _append_text(preparation, raw_unit_lower)
        changes.append(f"unit:{original_unit!r}->None")
        changes.append(f"preparation:{original_preparation!r}->{preparation!r}")
    elif unit_issue == "unknown_unit":
        issues.append(f"unknown_unit:{canonical_unit}")
    elif canonical_unit != original_unit:
        changes.append(f"unit:{original_unit!r}->{canonical_unit!r}")

    for descriptor in sorted(LEADING_SIZE_DESCRIPTORS, key=len, reverse=True):
        prefix = f"{descriptor} "
        if name.lower().startswith(prefix):
            name = name[len(prefix):].strip()
            preparation = _append_text(preparation, descriptor)
            changes.append(f"name:{original_name!r}->{name!r} (size prefix)")
            changes.append(f"preparation:{original_preparation!r}->{preparation!r}")
            break

    if canonical_unit and ingredient_match_key(canonical_unit) == ingredient_match_key(name):
        canonical_unit = None
        issues = [issue for issue in issues if not issue.startswith("unknown_unit:")]
        changes.append(f"unit:{original_unit!r}->None (duplicates ingredient)")
    elif canonical_unit in PORTION_UNITS:
        suffix = re.compile(rf"\s+{re.escape(canonical_unit)}s?$", re.IGNORECASE)
        stripped = suffix.sub("", name).strip()
        if stripped and stripped != name:
            name = stripped
            changes.append(f"name:{original_name!r}->{name!r} (unit suffix)")

    if not name:
        name = original_name.strip()
        issues.append("empty_name_after_normalization")

    if name != original_name and not any(change.startswith("name:") for change in changes):
        changes.append(f"name:{original_name!r}->{name!r}")
    if preparation != original_preparation and not any(change.startswith("preparation:") for change in changes):
        changes.append(f"preparation:{original_preparation!r}->{preparation!r}")
    if notes != original_notes:
        changes.append(f"notes:{original_notes!r}->{notes!r}")

    return NormalizedIngredientFields(
        name=name,
        unit=canonical_unit,
        preparation=preparation,
        notes=notes,
        changes=changes,
        issues=issues,
    )
