"""
Ingredient Parser Service

Parses ingredient text into structured data.
Handles common formats like:
- "1 cup flour"
- "2 tablespoons olive oil"
- "1/2 tsp salt"
- "3 large eggs"
- "Salt to taste"
- "1-2 cups milk"
- "One 14oz can tomatoes"
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


# Unit mappings - normalize to canonical form
UNIT_MAPPINGS = {
    # Volume
    'cup': ['cup', 'cups', 'c', 'c.'],
    'tablespoon': ['tablespoon', 'tablespoons', 'tbsp', 'tbsps', 'tbs', 'tb', 'T'],
    'teaspoon': ['teaspoon', 'teaspoons', 'tsp', 'tsps', 'ts', 't'],
    'fluid ounce': ['fluid ounce', 'fluid ounces', 'fl oz', 'fl. oz', 'fl. oz.'],
    'pint': ['pint', 'pints', 'pt', 'pt.'],
    'quart': ['quart', 'quarts', 'qt', 'qt.'],
    'gallon': ['gallon', 'gallons', 'gal', 'gal.'],
    'milliliter': ['milliliter', 'milliliters', 'ml', 'mL'],
    'liter': ['liter', 'liters', 'litre', 'litres', 'l', 'L'],

    # Weight
    'ounce': ['ounce', 'ounces', 'oz', 'oz.'],
    'pound': ['pound', 'pounds', 'lb', 'lbs', 'lb.', 'lbs.'],
    'gram': ['gram', 'grams', 'g', 'g.'],
    'kilogram': ['kilogram', 'kilograms', 'kg', 'kg.'],

    # Count/Other
    'pinch': ['pinch', 'pinches'],
    'dash': ['dash', 'dashes'],
    'clove': ['clove', 'cloves'],
    'slice': ['slice', 'slices'],
    'piece': ['piece', 'pieces', 'pc', 'pcs'],
    'can': ['can', 'cans'],
    'package': ['package', 'packages', 'pkg', 'pkgs'],
    'bunch': ['bunch', 'bunches'],
    'head': ['head', 'heads'],
    'stalk': ['stalk', 'stalks'],
    'sprig': ['sprig', 'sprigs'],
    'stick': ['stick', 'sticks'],
    'jar': ['jar', 'jars'],
    'bottle': ['bottle', 'bottles'],
    'box': ['box', 'boxes'],
    'bag': ['bag', 'bags'],
}

# Build reverse lookup
UNIT_LOOKUP = {}
for canonical, variants in UNIT_MAPPINGS.items():
    for variant in variants:
        UNIT_LOOKUP[variant.lower()] = canonical

# Unicode and text fractions
FRACTIONS = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3,
    '¼': 0.25, '¾': 0.75, '⅛': 0.125,
    '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
    '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
    '⅙': 1/6, '⅚': 5/6,
}

# Word to number mapping
WORD_NUMBERS = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'a': 1, 'an': 1,
}

# Common preparation words
PREP_WORDS = [
    'chopped', 'diced', 'minced', 'sliced', 'cubed', 'crushed',
    'grated', 'shredded', 'julienned', 'peeled', 'seeded',
    'halved', 'quartered', 'trimmed', 'cored', 'pitted',
    'melted', 'softened', 'room temperature', 'cold', 'frozen',
    'thawed', 'drained', 'rinsed', 'packed', 'sifted',
    'divided', 'beaten', 'whisked', 'optional',
]


@dataclass
class ParsedIngredient:
    quantity: Optional[float]
    quantity_max: Optional[float]
    unit: Optional[str]
    name: str
    preparation: Optional[str]
    notes: Optional[str]
    original_text: str


def parse_fraction(text: str) -> Optional[float]:
    """Parse a fraction string to float."""
    text = text.strip()

    # Check unicode fractions
    if text in FRACTIONS:
        return FRACTIONS[text]

    # Check "1/2" style fractions
    if '/' in text:
        try:
            parts = text.split('/')
            if len(parts) == 2:
                return float(parts[0]) / float(parts[1])
        except (ValueError, ZeroDivisionError):
            pass

    return None


def parse_quantity(text: str) -> Tuple[Optional[float], Optional[float], str]:
    """
    Parse quantity from start of text.
    Returns (quantity, quantity_max, remaining_text)
    """
    text = text.strip()
    quantity = None
    quantity_max = None

    # Pattern for numbers with optional fractions
    # Matches: "1", "1.5", "1 1/2", "1½", "1-2", "1 to 2"

    # First, check for word numbers at start
    words = text.split()
    if words and words[0].lower() in WORD_NUMBERS:
        quantity = WORD_NUMBERS[words[0].lower()]
        text = ' '.join(words[1:])
        return quantity, None, text.strip()

    # Pattern for mixed numbers like "1 1/2" or "1½"
    mixed_pattern = r'^(\d+)\s*([½⅓⅔¼¾⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|\d+/\d+)'
    mixed_match = re.match(mixed_pattern, text)
    if mixed_match:
        whole = float(mixed_match.group(1))
        frac = parse_fraction(mixed_match.group(2))
        if frac is not None:
            quantity = whole + frac
            text = text[mixed_match.end():].strip()

            # Check for range
            range_match = re.match(r'^[-–—]\s*(\d+(?:\.\d+)?)', text)
            if range_match:
                quantity_max = float(range_match.group(1))
                text = text[range_match.end():].strip()

            return quantity, quantity_max, text

    # Pattern for simple fractions or decimals
    simple_pattern = r'^(\d+(?:\.\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|\d+/\d+)'
    simple_match = re.match(simple_pattern, text)
    if simple_match:
        qty_str = simple_match.group(1)
        if qty_str in FRACTIONS:
            quantity = FRACTIONS[qty_str]
        elif '/' in qty_str:
            quantity = parse_fraction(qty_str)
        else:
            try:
                quantity = float(qty_str)
            except ValueError:
                pass

        text = text[simple_match.end():].strip()

        # Check for range like "1-2" or "1 to 2"
        range_pattern = r'^(?:[-–—]|to)\s*(\d+(?:\.\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+/\d+)'
        range_match = re.match(range_pattern, text, re.IGNORECASE)
        if range_match:
            max_str = range_match.group(1)
            if max_str in FRACTIONS:
                quantity_max = FRACTIONS[max_str]
            elif '/' in max_str:
                quantity_max = parse_fraction(max_str)
            else:
                try:
                    quantity_max = float(max_str)
                except ValueError:
                    pass
            text = text[range_match.end():].strip()

    return quantity, quantity_max, text


def parse_unit(text: str) -> Tuple[Optional[str], str]:
    """
    Parse unit from start of text.
    Returns (unit, remaining_text)
    """
    text = text.strip()

    # Sort units by length (longest first) to match "tablespoon" before "table"
    all_units = sorted(UNIT_LOOKUP.keys(), key=len, reverse=True)

    for unit_variant in all_units:
        # Create pattern that matches unit at start, followed by space or end
        pattern = rf'^{re.escape(unit_variant)}(?:\s+|$)'
        match = re.match(pattern, text, re.IGNORECASE)
        if match:
            canonical_unit = UNIT_LOOKUP[unit_variant.lower()]
            return canonical_unit, text[match.end():].strip()

    return None, text


def extract_preparation(text: str) -> Tuple[str, Optional[str]]:
    """
    Extract preparation notes from ingredient name.
    Returns (name, preparation)
    """
    # Check for comma-separated preparation
    if ',' in text:
        parts = text.split(',', 1)
        name = parts[0].strip()
        prep = parts[1].strip()

        # Verify prep contains preparation words
        prep_lower = prep.lower()
        for prep_word in PREP_WORDS:
            if prep_word in prep_lower:
                return name, prep

        # If no prep words found, it might be part of the name
        # e.g., "cheese, cheddar" - return as is
        return text, None

    # Check for parenthetical notes
    paren_match = re.search(r'\(([^)]+)\)\s*$', text)
    if paren_match:
        note = paren_match.group(1)
        name = text[:paren_match.start()].strip()
        return name, note

    return text, None


def extract_notes(text: str) -> Tuple[str, Optional[str]]:
    """
    Extract special notes like "to taste", "optional", etc.
    Returns (cleaned_text, notes)
    """
    notes = []

    # Check for common note patterns
    note_patterns = [
        r',?\s*to\s+taste\s*$',
        r',?\s*or\s+to\s+taste\s*$',
        r',?\s*optional\s*$',
        r',?\s*for\s+garnish\s*$',
        r',?\s*for\s+serving\s*$',
        r',?\s*as\s+needed\s*$',
        r',?\s*divided\s*$',
    ]

    for pattern in note_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            notes.append(match.group(0).strip(' ,'))
            text = text[:match.start()].strip()

    return text, ', '.join(notes) if notes else None


def parse_ingredient_line(line: str) -> ParsedIngredient:
    """Parse a single ingredient line into structured data."""
    original = line.strip()
    text = original

    # Handle empty or whitespace-only lines
    if not text:
        return ParsedIngredient(
            quantity=None,
            quantity_max=None,
            unit=None,
            name="",
            preparation=None,
            notes=None,
            original_text=original
        )

    # Extract quantity
    quantity, quantity_max, text = parse_quantity(text)

    # Handle cases like "One 14oz can" - look for size indicator
    size_match = re.match(r'^(\d+)\s*(oz|ounce|g|gram|ml|lb)\.?\s+', text, re.IGNORECASE)
    if size_match and quantity is not None:
        # The quantity might be a count, and this is the size
        # e.g., "2 14oz cans" -> quantity=2, but we need to handle "14oz" as part of name
        size_str = size_match.group(0).strip()
        text = text[size_match.end():]
        # Prepend size to remaining text
        text = f"{size_str} {text}"

    # Extract unit
    unit, text = parse_unit(text)

    # Extract notes like "to taste"
    text, notes = extract_notes(text)

    # Extract preparation
    name, preparation = extract_preparation(text)

    # Clean up name
    name = name.strip()
    name = re.sub(r'\s+', ' ', name)  # Normalize whitespace

    return ParsedIngredient(
        quantity=quantity,
        quantity_max=quantity_max,
        unit=unit,
        name=name,
        preparation=preparation,
        notes=notes,
        original_text=original
    )


def parse_ingredients_block(text: str) -> List[ParsedIngredient]:
    """Parse multiple lines of ingredients."""
    lines = text.strip().split('\n')
    results = []

    for line in lines:
        line = line.strip()
        # Skip empty lines and section headers (lines that look like headers)
        if not line:
            continue
        # Skip lines that look like headers (all caps, end with colon, etc.)
        if line.endswith(':') and len(line) < 50:
            continue
        if line.isupper() and len(line) < 30:
            continue

        parsed = parse_ingredient_line(line)
        if parsed.name:  # Only add if we got a name
            results.append(parsed)

    return results


def to_dict(parsed: ParsedIngredient) -> Dict:
    """Convert ParsedIngredient to dictionary."""
    return {
        'quantity': parsed.quantity,
        'quantity_max': parsed.quantity_max,
        'unit': parsed.unit,
        'name': parsed.name,
        'preparation': parsed.preparation,
        'notes': parsed.notes,
        'original_text': parsed.original_text,
    }
