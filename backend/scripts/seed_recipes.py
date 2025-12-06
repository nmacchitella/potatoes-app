"""
Seed Script for Recipes, Ingredients, and Measurement Units

Populates the database with:
- Common measurement units
- Ingredients extracted from CSV dataset
- 10 sample recipes from CSV dataset

Run from backend directory:
    python scripts/seed_recipes.py
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import csv
import ast
import re
import random
from database import SessionLocal, engine, Base
from models import Ingredient, MeasurementUnit, Recipe, RecipeIngredient, RecipeInstruction, User, Tag


def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for matching: lowercase, stripped, single spaces."""
    return " ".join(name.lower().strip().split())


def find_or_create_system_ingredient(db, name: str, category: str = "other") -> Ingredient:
    """
    Find an existing system ingredient or create a new one.
    Used for seeding - creates system ingredients (not user-specific).
    """
    normalized = normalize_ingredient_name(name)

    # Check for existing system ingredient
    existing = db.query(Ingredient).filter(
        Ingredient.is_system == True,
        Ingredient.normalized_name == normalized
    ).first()

    if existing:
        return existing

    # Create new system ingredient
    ingredient = Ingredient(
        name=name.strip(),
        normalized_name=normalized,
        category=category,
        is_system=True,
        user_id=None,
    )
    db.add(ingredient)
    db.flush()

    return ingredient


# Path relative to backend directory
CSV_PATH = Path(__file__).parent.parent / "seed_data" / "Food Ingredients and Recipe Dataset with Image Name Mapping.csv"

# Common measurement units
MEASUREMENT_UNITS = [
    # Volume
    {"name": "teaspoon", "abbreviation": "tsp", "type": "volume"},
    {"name": "tablespoon", "abbreviation": "Tbsp", "type": "volume"},
    {"name": "cup", "abbreviation": "c", "type": "volume"},
    {"name": "fluid ounce", "abbreviation": "fl oz", "type": "volume"},
    {"name": "pint", "abbreviation": "pt", "type": "volume"},
    {"name": "quart", "abbreviation": "qt", "type": "volume"},
    {"name": "gallon", "abbreviation": "gal", "type": "volume"},
    {"name": "milliliter", "abbreviation": "ml", "type": "volume"},
    {"name": "liter", "abbreviation": "L", "type": "volume"},
    # Weight
    {"name": "ounce", "abbreviation": "oz", "type": "weight"},
    {"name": "pound", "abbreviation": "lb", "type": "weight"},
    {"name": "gram", "abbreviation": "g", "type": "weight"},
    {"name": "kilogram", "abbreviation": "kg", "type": "weight"},
    # Count/Other
    {"name": "piece", "abbreviation": "pc", "type": "count"},
    {"name": "slice", "abbreviation": None, "type": "count"},
    {"name": "clove", "abbreviation": None, "type": "count"},
    {"name": "sprig", "abbreviation": None, "type": "count"},
    {"name": "bunch", "abbreviation": None, "type": "count"},
    {"name": "head", "abbreviation": None, "type": "count"},
    {"name": "stalk", "abbreviation": None, "type": "count"},
    {"name": "can", "abbreviation": None, "type": "container"},
    {"name": "jar", "abbreviation": None, "type": "container"},
    {"name": "package", "abbreviation": "pkg", "type": "container"},
    {"name": "pinch", "abbreviation": None, "type": "volume"},
    {"name": "dash", "abbreviation": None, "type": "volume"},
]

# Common ingredients by category (will be expanded from CSV)
COMMON_INGREDIENTS = {
    "produce": [
        "onion", "garlic", "tomato", "potato", "carrot", "celery", "bell pepper",
        "lettuce", "spinach", "broccoli", "mushroom", "lemon", "lime", "apple",
        "banana", "avocado", "cucumber", "zucchini", "squash", "ginger", "cilantro",
        "parsley", "basil", "rosemary", "thyme", "sage", "mint", "scallion",
    ],
    "meat": [
        "chicken breast", "chicken thigh", "ground beef", "beef steak", "pork chop",
        "bacon", "sausage", "ham", "turkey", "lamb", "ground turkey", "ground pork",
    ],
    "seafood": [
        "salmon", "shrimp", "tuna", "cod", "tilapia", "scallops", "crab", "lobster",
    ],
    "dairy": [
        "milk", "butter", "cheese", "cream", "sour cream", "yogurt", "cream cheese",
        "parmesan", "mozzarella", "cheddar", "feta", "heavy cream", "egg",
    ],
    "pantry": [
        "flour", "sugar", "brown sugar", "salt", "pepper", "olive oil", "vegetable oil",
        "rice", "pasta", "bread", "bread crumbs", "chicken broth", "beef broth",
        "tomato sauce", "tomato paste", "soy sauce", "vinegar", "honey", "maple syrup",
        "baking powder", "baking soda", "vanilla extract", "cocoa powder",
    ],
    "spices": [
        "paprika", "cumin", "oregano", "cinnamon", "nutmeg", "cayenne pepper",
        "chili powder", "garlic powder", "onion powder", "Italian seasoning",
        "bay leaf", "red pepper flakes", "turmeric", "coriander", "allspice",
    ],
}


def parse_ingredient_string(ingredient_str: str) -> dict:
    """Parse an ingredient string like '2 cups flour, sifted' into components."""
    # Common patterns for quantities
    qty_pattern = r'^([\d\s½¼¾⅓⅔⅛⅜⅝⅞/.-]+)?'

    # Try to extract quantity
    match = re.match(qty_pattern, ingredient_str.strip())
    quantity = None
    rest = ingredient_str.strip()

    if match and match.group(1):
        qty_str = match.group(1).strip()
        rest = ingredient_str[match.end():].strip()
        # Convert fractions
        qty_str = qty_str.replace('½', '.5').replace('¼', '.25').replace('¾', '.75')
        qty_str = qty_str.replace('⅓', '.33').replace('⅔', '.67')
        qty_str = qty_str.replace('⅛', '.125').replace('⅜', '.375')
        qty_str = qty_str.replace('⅝', '.625').replace('⅞', '.875')
        try:
            # Handle ranges like "1-2"
            if '-' in qty_str:
                parts = qty_str.split('-')
                quantity = float(parts[0])
            elif '/' in qty_str:
                parts = qty_str.split('/')
                quantity = float(parts[0]) / float(parts[1])
            else:
                quantity = float(qty_str)
        except:
            quantity = None

    # Common units to look for
    units = ['cups?', 'tbsp', 'tsp', 'tablespoons?', 'teaspoons?', 'oz', 'ounces?',
             'lbs?', 'pounds?', 'g', 'grams?', 'kg', 'ml', 'liters?', 'cloves?',
             'pieces?', 'slices?', 'stalks?', 'bunche?s?', 'heads?', 'cans?', 'jars?']

    unit = None
    unit_pattern = r'^(' + '|'.join(units) + r')\.?\s+'
    unit_match = re.match(unit_pattern, rest, re.IGNORECASE)
    if unit_match:
        unit = unit_match.group(1).rstrip('s').lower()  # Normalize
        rest = rest[unit_match.end():].strip()

    # Clean up the name
    name = rest.strip(' ,')
    # Remove preparation instructions after comma
    if ',' in name:
        name = name.split(',')[0].strip()

    return {
        "quantity": quantity,
        "unit": unit,
        "name": name[:200] if name else "unknown",
    }


def seed_measurement_units(db):
    """Seed measurement units."""
    print("Seeding measurement units...")
    created = 0

    for unit_data in MEASUREMENT_UNITS:
        existing = db.query(MeasurementUnit).filter(
            MeasurementUnit.name == unit_data["name"]
        ).first()

        if not existing:
            unit = MeasurementUnit(
                name=unit_data["name"],
                abbreviation=unit_data.get("abbreviation"),
                type=unit_data.get("type"),
                is_system=True,
            )
            db.add(unit)
            created += 1

    db.commit()
    print(f"  Created {created} measurement units")


def seed_ingredients(db):
    """Seed common ingredients."""
    print("Seeding common ingredients...")
    created = 0

    for category, ingredients in COMMON_INGREDIENTS.items():
        for ing_name in ingredients:
            normalized = normalize_ingredient_name(ing_name)
            existing = db.query(Ingredient).filter(
                Ingredient.normalized_name == normalized
            ).first()

            if not existing:
                ingredient = Ingredient(
                    name=ing_name,
                    normalized_name=normalized,
                    category=category,
                    is_system=True,
                )
                db.add(ingredient)
                created += 1

    db.commit()
    print(f"  Created {created} ingredients")


def get_or_create_demo_user(db) -> User:
    """Get or create a demo user for sample recipes."""
    demo_email = "demo@potatoes.app"
    user = db.query(User).filter(User.email == demo_email).first()

    if not user:
        from auth import get_password_hash

        user = User(
            email=demo_email,
            name="Demo Chef",
            hashed_password=get_password_hash("demo123"),
            is_verified=True,
            is_public=True,
            username="demochef",
            bio="Sample recipes for demonstration purposes.",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"  Created demo user: {demo_email}")

    return user


def seed_sample_recipes(db, count: int = 10):
    """Seed sample recipes from CSV."""
    print(f"Seeding {count} sample recipes from CSV...")

    # Get or create demo user
    demo_user = get_or_create_demo_user(db)

    # Get some tags for random assignment
    tags = db.query(Tag).filter(Tag.is_system == True).limit(20).all()

    try:
        with open(CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            recipes_created = 0

            for row in reader:
                if recipes_created >= count:
                    break

                title = row.get('Title', '').strip()
                if not title:
                    continue

                # Check if recipe already exists
                existing = db.query(Recipe).filter(
                    Recipe.title == title,
                    Recipe.author_id == demo_user.id
                ).first()

                if existing:
                    continue

                # Parse ingredients
                ingredients_raw = row.get('Ingredients', '[]')
                try:
                    ingredients_list = ast.literal_eval(ingredients_raw)
                except:
                    ingredients_list = []

                # Parse instructions
                instructions_raw = row.get('Instructions', '')
                # Split by newlines or periods followed by newline
                instruction_steps = [s.strip() for s in instructions_raw.split('\n') if s.strip()]

                # Create recipe
                recipe = Recipe(
                    author_id=demo_user.id,
                    title=title[:200],
                    description=f"A delicious {title.lower()} recipe.",
                    yield_quantity=4,
                    yield_unit="servings",
                    prep_time_minutes=random.choice([15, 20, 30, 45]),
                    cook_time_minutes=random.choice([20, 30, 45, 60, 90]),
                    difficulty=random.choice(["easy", "medium", "hard"]),
                    privacy_level="public",
                    status="published",
                )
                db.add(recipe)
                db.flush()  # Get the ID

                # Add ingredients
                for idx, ing_str in enumerate(ingredients_list[:20]):  # Limit to 20 ingredients
                    parsed = parse_ingredient_string(ing_str)
                    # Find or create master ingredient entity
                    master_ingredient = find_or_create_system_ingredient(
                        db=db,
                        name=parsed["name"],
                        category="other"
                    )
                    recipe_ing = RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=master_ingredient.id,
                        sort_order=idx,
                        quantity=parsed["quantity"],
                        unit=parsed["unit"],
                        name=parsed["name"],
                    )
                    db.add(recipe_ing)

                # Add instructions
                for idx, step_text in enumerate(instruction_steps[:15]):  # Limit to 15 steps
                    if len(step_text) > 10:  # Skip very short steps
                        instruction = RecipeInstruction(
                            recipe_id=recipe.id,
                            step_number=idx + 1,
                            instruction_text=step_text[:2000],
                        )
                        db.add(instruction)

                # Add random tags
                if tags:
                    recipe.tags = random.sample(tags, min(3, len(tags)))

                recipes_created += 1
                print(f"    Created: {title[:50]}...")

            db.commit()
            print(f"  Created {recipes_created} recipes")

    except FileNotFoundError:
        print(f"  ERROR: CSV file not found at {CSV_PATH}")
        print("  Please add the CSV file to the seed_data folder.")


def run_seed():
    """Run all seed operations."""
    print("Starting recipe seed...")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_measurement_units(db)
        seed_ingredients(db)
        seed_sample_recipes(db, count=10)
        print("Recipe seed completed successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
