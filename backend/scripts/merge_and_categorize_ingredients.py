"""
One-time migration script: Merge duplicate ingredients and assign proper categories.

This script:
1. Merges semantic duplicates (singular/plural, formatting, same-thing-different-name)
2. Updates all recipe_ingredients to point to the canonical ingredient
3. Deletes the duplicate ingredients
4. Assigns proper grocery categories to all ingredients

Run with --dry-run to preview changes.

Usage:
    python scripts/merge_and_categorize_ingredients.py --dry-run  # Preview
    python scripts/merge_and_categorize_ingredients.py            # Execute
"""

import argparse
import sys
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os


def get_database_url():
    return os.getenv('DATABASE_URL', 'sqlite:///./app.db')


# Each entry: (canonical_id, [duplicate_ids_to_merge])
# The canonical ingredient keeps its name; duplicates get their recipe_ingredients
# reassigned to the canonical, then the duplicates are deleted.
MERGE_GROUPS = [
    # === Clear duplicates (singular/plural, formatting) ===
    # carrot <- carrots
    ("b26685ab-c69e-4a7e-ae45-504b0b936760", ["f850f070-e7d8-4d13-a55f-2e0f6a6de5cd"]),
    # egg yolk <- egg yolks
    ("ef2ecd22-06a8-4e6e-8b35-5afc9f97cbb8", ["d4747340-8c66-4e61-befa-8f73f2c697ca"]),
    # egg <- eggs, large eggs
    ("51b97005-9922-419b-9906-d1da8ffee6c3", ["2b577092-a9bd-4d62-a6c0-2ca83e37f318", "b047ec2b-f1eb-4cc3-9897-c7ed7e152ea1"]),
    # ice cube <- ice cubes
    ("bcf7a298-c0e5-4f73-8928-48a34e9bd14e", ["efae66dd-08b6-4d9b-9a60-629ce2817bbc"]),
    # onion <- onions
    ("476bec90-f563-43ab-a425-35fe74faa917", ["708264ea-8191-4435-b0bc-5dafd52d9f51"]),
    # pepper <- peppers
    ("7d67785a-7273-41a5-a96f-8f7593c67a61", ["2432934d-5250-4ebd-98b1-7d9518352737"]),
    # potato <- potatoes
    ("61aec770-956d-42d3-9ae5-7f4b9d0da779", ["7feb09db-1da4-45c5-addb-c9317a7c68f0"]),
    # garlic clove <- garlic cloves
    ("9c70d9fb-501a-425a-a4e0-8b0b257eb183", ["c2c01e7a-b5ef-4a77-8237-9c321fd2d773"]),
    # all-purpose flour <- all purpose flour
    ("fa5a001a-69d0-4357-b6c6-dcadf8da1f56", ["d027efbb-f596-4954-8f30-a968c72632d6"]),
    # extra virgin olive oil <- extra-virgin olive oil
    ("d24e84eb-09e8-4c8c-95eb-91e6b110dbf3", ["ca7bc8d7-566b-4f48-bbb6-d47e75d0eab5"]),
    # light brown sugar <- light-brown sugar
    ("4bf9cbd4-4787-4152-bbb9-61558561776d", ["7c669997-6511-43aa-a331-acea3f7dba57"]),
    # organic chicken breast <- organic breast chicken
    ("db01ff4f-2aff-4c76-978e-6779e194bc13", ["004face8-3ae1-4e50-9007-3f67dd9a2444"]),
    # bechamel <- bechamel sauce
    ("c73b9d31-6f2a-4571-8624-696d6b6cf524", ["8177b9dd-f397-4efa-aeed-1b63119a0104"]),

    # === Likely duplicates (same ingredient, different wording) ===
    # black pepper <- freshly ground black pepper
    ("53ef2836-f9ba-4e47-9170-dfc70c9c2247", ["48bd163d-26aa-4a35-806a-484446565e9f"]),
    # parsley <- fresh parsley
    ("a9a3b4b6-2335-4965-9c7d-949700a502da", ["95d28ecd-12b6-4b04-8289-45a709e2faf5"]),
    # dill <- fresh dill
    ("e46585c5-3a78-40b5-a647-2d57bf2a9776", ["a61f75bb-0ccc-4877-a436-ab2f5d5f6ddf"]),
    # lemon juice <- fresh lemon juice
    ("d177b28c-0a8b-4b72-93e8-5913d2c0c272", ["672eaf9d-0978-490a-9326-2e3551e54791"]),
    # lemon zest <- freshly grated lemon zest
    ("b958b711-6fc4-46f6-97ed-d3c5f7b92abb", ["301e4a84-74aa-4bda-bb53-ab145a3e5fbf"]),
    # powdered sugar <- confectionary sugar, icing sugar
    ("84decf78-af6d-4896-8287-372055ef75f2", ["0785de24-5fe3-47fe-af47-e0b789a064ba", "ff730d4f-4e4c-4bf5-8dae-2bdc0cd36a6a"]),
    # parmigiano reggiano <- parmesan, parmesan cheese, parmigiano, parmigiano reggiano dop
    ("c5373c99-7ec7-4fbb-b454-aa79ad3aa694", [
        "c1b6d9d6-9b9b-4b40-94ba-006cadfdda98",
        "7aadd69c-9934-41c5-9486-b46b64c1492c",
        "a1e3d1cc-d07c-4ecf-a024-cd7ee9195a8d",
        "e3a40b30-85d7-404e-b0d7-d2b8509c6681",
    ]),
    # pecorino romano <- pecorino, roman pecorino
    ("fbc92a10-64ae-4d16-82a5-46b2710f4aeb", ["e3674b71-60c9-4a8c-bb54-111c1048b469", "f951eb87-9d58-4db7-8572-e1d49670bd25"]),
    # baking soda <- bicarbonate of soda
    ("b8f79356-1f5a-47a0-a581-3671e9439e28", ["52dc575b-a573-4736-a1f9-289f3a24df5b"]),
    # chili pepper <- chili, chilli
    ("49308235-8acb-4e80-8392-2929cee59078", ["88bbd8f7-2938-4616-b097-9293b2d9bb77", "74313009-c1a3-448a-8e07-95bf2918e1bc"]),
    # ragu sauce <- ragout
    ("5862d751-d50e-49be-b5d7-d14b0ed5f44a", ["46b63a04-91c9-42ca-bf8a-53b80763e5c4"]),
]


# Category assignments for ALL ingredients (by normalized_name after merges).
# Categories: produce, meat, seafood, dairy, pantry, spices, baking, condiments, beverages, other
CATEGORY_MAP = {
    # === produce (fresh fruits, vegetables, fresh herbs) ===
    "aglione": "produce",
    "apple": "produce",
    "asparagus": "produce",
    "avocado": "produce",
    "basil": "produce",
    "blackberry": "produce",
    "blueberry": "produce",
    "carrot": "produce",
    "celery": "produce",
    "celery stem": "produce",
    "chard leaves": "produce",
    "cherry tomatoes": "produce",
    "chili pepper": "produce",
    "chives": "produce",
    "cilantro": "produce",
    "cucumber": "produce",
    "dandelion": "produce",
    "dill": "produce",
    "eggplants": "produce",
    "elephant garlic": "produce",
    "fennel": "produce",
    "fresh basil leaves": "produce",
    "fresh chili peppers": "produce",
    "fresh chili peppers (red, yellow, green)": "produce",
    "fresh spring onion": "produce",
    "frozen basil leaves": "produce",
    "frozen blueberries": "produce",
    "frozen peaches": "produce",
    "frozen raspberries": "produce",
    "garlic": "produce",
    "garlic clove": "produce",
    "ginger": "produce",
    "green tomatoes": "produce",
    "herbs": "produce",
    "leek": "produce",
    "lemon": "produce",
    "lemon skin": "produce",
    "lemon wedges": "produce",
    "lime": "produce",
    "nasturtium": "produce",
    "onion": "produce",
    "peach": "produce",
    "pepper": "produce",
    "pimpinella": "produce",
    "potato": "produce",
    "baby red potatoes": "produce",
    "medium potatoes": "produce",
    "red potatoes": "produce",
    "pumpkin": "produce",
    "raspberry": "produce",
    "red cabbage": "produce",
    "red onion": "produce",
    "red pepper": "produce",
    "roma tomatoes": "produce",
    "rosemary": "produce",
    "rue": "produce",
    "sage": "produce",
    "scallions": "produce",
    "shallot": "produce",
    "sweet onion": "produce",
    "sweet potato": "produce",
    "thyme": "produce",
    "tomatoes": "produce",
    "white onion": "produce",
    "yellow onion": "produce",
    "yellow pepper": "produce",
    "wild pea flowers": "produce",
    "parsley": "produce",

    # === meat ===
    "beef": "meat",
    "cured meat (bacon)": "meat",
    "guanciale": "meat",
    "guanciale rind": "meat",
    "ham": "meat",
    "organic chicken breast": "meat",
    "sausage": "meat",
    "wild boar loin": "meat",

    # === seafood ===
    "anchovy sauce": "seafood",
    "caviar": "seafood",
    "prawns": "seafood",
    "salmon eggs": "seafood",
    "skinless salmon fillet": "seafood",
    "tuna": "seafood",

    # === dairy ===
    "butter": "dairy",
    "buttermilk": "dairy",
    "cheese": "dairy",
    "clarified butter": "dairy",
    "curd cheese": "dairy",
    "double cream": "dairy",
    "egg": "dairy",
    "egg white": "dairy",
    "egg yolk": "dairy",
    "feta": "dairy",
    "grana padano cheese": "dairy",
    "heavy cream": "dairy",
    "heavy whipping cream": "dairy",
    "milk": "dairy",
    "mozzarella": "dairy",
    "parmigiano reggiano": "dairy",
    "parmesan crust": "dairy",
    "pecorino crust": "dairy",
    "pecorino romano": "dairy",
    "sour cream": "dairy",
    "unsalted butter": "dairy",
    "whole milk": "dairy",

    # === pantry (oils, pasta, grains, canned, staples) ===
    "all-purpose flour": "pantry",
    "almond flour": "pantry",
    "apple cider vinegar": "pantry",
    "avocado oil": "pantry",
    "black beans": "pantry",
    "breadcrumbs": "pantry",
    "broken durum wheat pasta": "pantry",
    "burger buns": "pantry",
    "carnaroli rice": "pantry",
    "cocoa": "pantry",
    "cooking oil": "pantry",
    "cornstarch": "pantry",
    "cranberry beans": "pantry",
    "crushed tomatoes": "pantry",
    "dark chocolate": "pantry",
    "ditali pasta": "pantry",
    "ditalini shaped spelt pasta": "pantry",
    "dry chickpeas": "pantry",
    "extra virgin olive oil": "pantry",
    "farro": "pantry",
    "flour": "pantry",
    "kidney beans": "pantry",
    "lasagna sheets": "pantry",
    "lentils": "pantry",
    "oat milk": "pantry",
    "oil": "pantry",
    "olive oil": "pantry",
    "paccheri pasta": "pantry",
    "pasta": "pantry",
    "pastry flour": "pantry",
    "penne pasta": "pantry",
    "plain flour": "pantry",
    "re-milled semolina": "pantry",
    "red beans": "pantry",
    "rigatoni": "pantry",
    "risotto rice": "pantry",
    "rolled oats": "pantry",
    "seed oil": "pantry",
    "self-raising flour": "pantry",
    "semolina": "pantry",
    "semisweet chocolate chips": "pantry",
    "spaghetti": "pantry",
    "strong bread flour": "pantry",
    "strong white bread flour": "pantry",
    "tomato paste": "pantry",
    "tomato sauce": "pantry",
    "tortilla chips": "pantry",
    "tortillas": "pantry",
    "triple concentrated tomato paste": "pantry",
    "vegetable stock": "pantry",
    "whole peeled tomatoes": "pantry",

    # === spices (dried spices, seasonings, extracts) ===
    "allspice": "spices",
    "black pepper": "spices",
    "chili powder": "spices",
    "chopped rosemary": "spices",
    "coarse salt": "spices",
    "fine salt": "spices",
    "fried sage": "spices",
    "ground almonds": "spices",
    "ground cinnamon": "spices",
    "ground ginger": "spices",
    "ground nutmeg": "spices",
    "kosher salt": "spices",
    "nutmeg": "spices",
    "paprika": "spices",
    "saffron": "spices",
    "sage powder": "spices",
    "salt": "spices",
    "vanilla": "spices",
    "vanilla extract": "spices",
    "pure vanilla extract": "spices",

    # === baking ===
    "baking powder": "baking",
    "baking soda": "baking",
    "caster sugar": "baking",
    "fresh yeast": "baking",
    "golden caster sugar": "baking",
    "granulated sugar": "baking",
    "light brown sugar": "baking",
    "light muscovado sugar": "baking",
    "powdered sugar": "baking",
    "sugar": "baking",

    # === condiments ===
    "agave": "condiments",
    "agave syrup": "condiments",
    "bechamel": "condiments",
    "fig leaves powder": "condiments",
    "green cypress pine cones": "condiments",
    "hummus": "condiments",
    "instant espresso coffee": "condiments",
    "juniper needles extract": "condiments",
    "lemon juice": "condiments",
    "lemon zest": "condiments",
    "marmalade/jam": "condiments",
    "mastic tree extract": "condiments",
    "moutarde à l'ancienne": "condiments",
    "orange zest": "condiments",
    "pumpkin purée": "condiments",
    "ragu sauce": "condiments",
    "raspberry jam": "condiments",
    "valtellina apple vinegar": "condiments",
    "vinegar": "condiments",
    "white wine vinegar": "condiments",
    "freeze-dried raspberry": "condiments",

    # === beverages ===
    "blond beer": "beverages",
    "cold water": "beverages",
    "dry white wine": "beverages",
    "water": "beverages",
    "white wine": "beverages",
    "white wine or red wine": "beverages",
    "soraya beer": "beverages",
    "vanilla siggi": "beverages",

    # === other ===
    "apple tree chips": "other",
    "beans cooking water": "other",
    "cooked chestnuts": "other",
    "fish broth": "other",
    "ice cube": "other",
    "lard": "other",
    "meat broth": "other",
    "nuts": "other",
    "pistachio": "other",
    "pickled chard ribs": "other",
    "pickled onion": "other",
    "straw": "other",
    "walnuts": "other",
    "walnuts or pine nuts": "other",
}


def main():
    parser = argparse.ArgumentParser(description='Merge duplicate ingredients and assign categories')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    args = parser.parse_args()

    database_url = get_database_url()
    print(f"Connecting to database...")
    print(f"Dry run: {args.dry_run}\n")

    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # ==========================================
        # STEP 1: Merge duplicate ingredients
        # ==========================================
        print("=" * 60)
        print("STEP 1: Merging duplicate ingredients")
        print("=" * 60)

        total_reassigned = 0
        total_deleted = 0

        for canonical_id, duplicate_ids in MERGE_GROUPS:
            # Get canonical ingredient name
            row = session.execute(
                text("SELECT name FROM ingredients WHERE id = :id"),
                {"id": canonical_id}
            ).fetchone()

            if not row:
                print(f"  WARNING: Canonical ingredient {canonical_id[:8]}... not found, skipping")
                continue

            canonical_name = row[0]
            print(f"\n  {canonical_name} (keeping {canonical_id[:8]}...)")

            for dup_id in duplicate_ids:
                dup_row = session.execute(
                    text("SELECT name FROM ingredients WHERE id = :id"),
                    {"id": dup_id}
                ).fetchone()

                if not dup_row:
                    print(f"    WARNING: Duplicate {dup_id[:8]}... not found, skipping")
                    continue

                dup_name = dup_row[0]

                # Count affected recipe_ingredients
                count = session.execute(
                    text("SELECT COUNT(*) FROM recipe_ingredients WHERE ingredient_id = :id"),
                    {"id": dup_id}
                ).scalar()

                print(f"    <- {dup_name} ({count} recipe refs)")

                if not args.dry_run:
                    # Reassign recipe_ingredients to canonical
                    session.execute(
                        text("UPDATE recipe_ingredients SET ingredient_id = :canonical WHERE ingredient_id = :dup"),
                        {"canonical": canonical_id, "dup": dup_id}
                    )
                    # Delete the duplicate ingredient
                    session.execute(
                        text("DELETE FROM ingredients WHERE id = :id"),
                        {"id": dup_id}
                    )

                total_reassigned += count
                total_deleted += 1

        print(f"\n  Summary: {'Would reassign' if args.dry_run else 'Reassigned'} {total_reassigned} recipe refs, "
              f"{'would delete' if args.dry_run else 'deleted'} {total_deleted} duplicate ingredients")

        # ==========================================
        # STEP 2: Assign categories
        # ==========================================
        print("\n" + "=" * 60)
        print("STEP 2: Assigning ingredient categories")
        print("=" * 60)

        # Get all remaining ingredients
        ingredients = session.execute(
            text("SELECT id, name, normalized_name, category FROM ingredients ORDER BY normalized_name")
        ).fetchall()

        updated = 0
        uncategorized = []

        for ing in ingredients:
            ing_id, name, normalized_name, current_category = ing
            new_category = CATEGORY_MAP.get(normalized_name)

            if new_category is None:
                uncategorized.append(f"{name} ({normalized_name})")
                continue

            if current_category != new_category:
                print(f"  {name}: {current_category} -> {new_category}")
                if not args.dry_run:
                    session.execute(
                        text("UPDATE ingredients SET category = :cat WHERE id = :id"),
                        {"cat": new_category, "id": ing_id}
                    )
                updated += 1

        print(f"\n  Summary: {'Would update' if args.dry_run else 'Updated'} {updated} ingredient categories")

        if uncategorized:
            print(f"\n  WARNING: {len(uncategorized)} ingredients not in category map:")
            for name in uncategorized:
                print(f"    - {name}")

        # Commit
        if not args.dry_run:
            session.commit()
            print("\n=== Changes committed successfully ===")
        else:
            session.rollback()
            print("\n=== Dry run complete - no changes made ===")
            print("Run without --dry-run to apply changes")

    except Exception as e:
        session.rollback()
        print(f"\nError: {e}")
        raise
    finally:
        session.close()


if __name__ == '__main__':
    main()
