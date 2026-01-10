"""
Ingredient Cleanup Script

This script cleans up duplicate ingredients in the database by:
1. Finding ingredients with the same normalized_name
2. Keeping one canonical version (preferring system ingredients)
3. Updating all recipe_ingredients to point to the canonical version
4. Deleting the duplicates

Run with --dry-run to see what would be changed without making changes.
Run without flags to execute the cleanup.

Usage:
    python scripts/cleanup_ingredients.py --dry-run  # Preview changes
    python scripts/cleanup_ingredients.py            # Execute cleanup
"""

import argparse
import sys
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os


def normalize_name(name: str) -> str:
    """Normalize ingredient name for matching."""
    return " ".join(name.lower().strip().split())


def get_database_url():
    """Get database URL from environment."""
    return os.getenv('DATABASE_URL', 'sqlite:///./app.db')


def find_duplicate_ingredients(session):
    """Find all ingredients that have duplicates based on normalized name."""
    # Get all ingredients
    result = session.execute(text("""
        SELECT id, name, normalized_name, category, is_system, user_id
        FROM ingredients
        ORDER BY normalized_name, is_system DESC, created_at ASC
    """))

    ingredients = list(result.fetchall())

    # Group by normalized_name
    grouped = defaultdict(list)
    for ing in ingredients:
        # Re-normalize to catch any inconsistencies
        normalized = normalize_name(ing.name)
        grouped[normalized].append({
            'id': ing.id,
            'name': ing.name,
            'normalized_name': ing.normalized_name,
            'category': ing.category,
            'is_system': ing.is_system,
            'user_id': ing.user_id
        })

    # Filter to only groups with duplicates
    duplicates = {k: v for k, v in grouped.items() if len(v) > 1}

    return duplicates


def find_case_mismatches(session):
    """Find ingredients where the stored normalized_name doesn't match re-normalized name."""
    result = session.execute(text("""
        SELECT id, name, normalized_name
        FROM ingredients
    """))

    mismatches = []
    for row in result.fetchall():
        correct_normalized = normalize_name(row.name)
        if row.normalized_name != correct_normalized:
            mismatches.append({
                'id': row.id,
                'name': row.name,
                'current_normalized': row.normalized_name,
                'correct_normalized': correct_normalized
            })

    return mismatches


def get_recipe_ingredient_counts(session, ingredient_ids):
    """Get count of recipe_ingredients using each ingredient."""
    if not ingredient_ids:
        return {}

    placeholders = ','.join([f"'{id}'" for id in ingredient_ids])
    result = session.execute(text(f"""
        SELECT ingredient_id, COUNT(*) as count
        FROM recipe_ingredients
        WHERE ingredient_id IN ({placeholders})
        GROUP BY ingredient_id
    """))

    return {row.ingredient_id: row.count for row in result.fetchall()}


def cleanup_duplicates(session, duplicates, dry_run=True):
    """
    Clean up duplicate ingredients.

    For each group of duplicates:
    1. Pick the canonical version (prefer system, then oldest)
    2. Update recipe_ingredients to point to canonical
    3. Delete the duplicates
    """
    total_merged = 0
    total_deleted = 0

    for normalized_name, ingredients in duplicates.items():
        # Sort: system first, then by created_at (oldest first based on ID)
        sorted_ings = sorted(ingredients, key=lambda x: (not x['is_system'], x['id']))

        # Keep the first one (system or oldest)
        canonical = sorted_ings[0]
        duplicates_to_delete = sorted_ings[1:]

        print(f"\n=== {normalized_name} ===")
        print(f"  Keeping: {canonical['name']} (id={canonical['id'][:8]}..., system={canonical['is_system']})")

        for dup in duplicates_to_delete:
            print(f"  Merging: {dup['name']} (id={dup['id'][:8]}..., system={dup['is_system']})")

            # Count recipe_ingredients that will be updated
            count_result = session.execute(text(f"""
                SELECT COUNT(*) as count FROM recipe_ingredients
                WHERE ingredient_id = '{dup['id']}'
            """))
            count = count_result.fetchone().count

            if count > 0:
                print(f"    - Updating {count} recipe ingredient(s)")

                if not dry_run:
                    # Update recipe_ingredients to point to canonical
                    session.execute(text(f"""
                        UPDATE recipe_ingredients
                        SET ingredient_id = '{canonical['id']}'
                        WHERE ingredient_id = '{dup['id']}'
                    """))

            # Delete the duplicate
            print(f"    - Deleting duplicate")
            if not dry_run:
                session.execute(text(f"""
                    DELETE FROM ingredients WHERE id = '{dup['id']}'
                """))

            total_deleted += 1

        total_merged += 1

    return total_merged, total_deleted


def fix_normalized_names(session, mismatches, dry_run=True):
    """Fix ingredients where normalized_name doesn't match."""
    print("\n=== Fixing Normalized Names ===")

    for m in mismatches:
        print(f"  {m['name']}: '{m['current_normalized']}' -> '{m['correct_normalized']}'")

        if not dry_run:
            session.execute(text(f"""
                UPDATE ingredients
                SET normalized_name = :normalized
                WHERE id = :id
            """), {'normalized': m['correct_normalized'], 'id': m['id']})

    return len(mismatches)


def main():
    parser = argparse.ArgumentParser(description='Clean up duplicate ingredients')
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without making them')
    args = parser.parse_args()

    # Connect to database
    database_url = get_database_url()
    print(f"Connecting to database...")
    print(f"Dry run: {args.dry_run}")

    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Find and fix normalized name mismatches
        print("\n" + "=" * 50)
        print("STEP 1: Checking normalized names")
        print("=" * 50)

        mismatches = find_case_mismatches(session)
        if mismatches:
            print(f"Found {len(mismatches)} ingredients with incorrect normalized names")
            fixed = fix_normalized_names(session, mismatches, args.dry_run)
            print(f"Fixed: {fixed}")
        else:
            print("All normalized names are correct!")

        # Find and merge duplicates
        print("\n" + "=" * 50)
        print("STEP 2: Finding duplicate ingredients")
        print("=" * 50)

        duplicates = find_duplicate_ingredients(session)

        if not duplicates:
            print("No duplicate ingredients found!")
        else:
            print(f"Found {len(duplicates)} groups of duplicate ingredients")

            # Get usage counts
            all_ids = []
            for ings in duplicates.values():
                all_ids.extend([i['id'] for i in ings])
            usage_counts = get_recipe_ingredient_counts(session, all_ids)

            print("\n" + "=" * 50)
            print("STEP 3: Merging duplicates")
            print("=" * 50)

            merged, deleted = cleanup_duplicates(session, duplicates, args.dry_run)

            print(f"\n{'Would merge' if args.dry_run else 'Merged'} {merged} groups")
            print(f"{'Would delete' if args.dry_run else 'Deleted'} {deleted} duplicate ingredients")

        # Commit if not dry run
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
