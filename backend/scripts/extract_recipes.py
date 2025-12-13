#!/usr/bin/env python3
"""
Recipe Extraction Script

Extracts recipes from a list of URLs and saves them as JSON files.

Usage:
    python scripts/extract_recipes.py --account mycookbook

This will:
1. Read URLs from seed_data/mycookbook/links.txt
2. Extract each recipe using the existing import service
3. Save recipes to seed_data/mycookbook/recipes/
4. Track progress in seed_data/mycookbook/metadata.json
"""

import argparse
import asyncio
import json
import hashlib
import re
import sys
import time
from pathlib import Path
from datetime import datetime
from dataclasses import asdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.recipe_import import import_recipe_from_url, ImportedRecipe


def slugify(text: str, max_length: int = 50) -> str:
    """Convert text to a URL-friendly slug."""
    # Lowercase and replace spaces with hyphens
    slug = text.lower().strip()
    # Remove special characters
    slug = re.sub(r'[^\w\s-]', '', slug)
    # Replace whitespace with hyphens
    slug = re.sub(r'[-\s]+', '-', slug)
    # Truncate
    return slug[:max_length].rstrip('-')


def get_recipe_filename(recipe: ImportedRecipe) -> str:
    """Generate a unique filename for a recipe."""
    slug = slugify(recipe.title)
    # Add short hash of source_url for uniqueness
    url_hash = hashlib.md5((recipe.source_url or '').encode()).hexdigest()[:8]
    return f"{slug}-{url_hash}.json"


def recipe_to_dict(recipe: ImportedRecipe) -> dict:
    """Convert ImportedRecipe to a serializable dictionary."""
    return {
        'title': recipe.title,
        'description': recipe.description,
        'ingredients': [asdict(ing) for ing in recipe.ingredients],
        'instructions': [asdict(inst) for inst in recipe.instructions],
        'yield_quantity': recipe.yield_quantity,
        'yield_unit': recipe.yield_unit,
        'prep_time_minutes': recipe.prep_time_minutes,
        'cook_time_minutes': recipe.cook_time_minutes,
        'difficulty': recipe.difficulty,
        'source_url': recipe.source_url,
        'source_name': recipe.source_name,
        'cover_image_url': recipe.cover_image_url,
        'tags': recipe.tags,
    }


def load_metadata(metadata_path: Path) -> dict:
    """Load or create metadata file."""
    if metadata_path.exists():
        with open(metadata_path, 'r') as f:
            return json.load(f)
    return {
        'account': '',
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        'stats': {
            'total_urls': 0,
            'successful': 0,
            'failed': 0,
            'skipped': 0,
        },
        'failed_urls': [],
        'extracted_urls': [],
    }


def save_metadata(metadata_path: Path, metadata: dict):
    """Save metadata file."""
    metadata['updated_at'] = datetime.now().isoformat()
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)


def get_existing_urls(recipes_dir: Path) -> set:
    """Get set of already-extracted source URLs."""
    urls = set()
    if not recipes_dir.exists():
        return urls

    for recipe_file in recipes_dir.glob('*.json'):
        try:
            with open(recipe_file, 'r') as f:
                data = json.load(f)
                if data.get('source_url'):
                    urls.add(data['source_url'])
        except (json.JSONDecodeError, KeyError):
            continue
    return urls


async def extract_single_recipe(url: str) -> tuple[list[ImportedRecipe], str | None]:
    """
    Extract recipe(s) from a URL.
    Returns (recipes, error_message).
    """
    try:
        recipes = await import_recipe_from_url(url)
        return recipes, None
    except Exception as e:
        return [], str(e)


async def main():
    parser = argparse.ArgumentParser(description='Extract recipes from URLs')
    parser.add_argument(
        '--account',
        required=True,
        help='Account name (folder under seed_data/)'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=1.5,
        help='Delay between requests in seconds (default: 1.5)'
    )
    parser.add_argument(
        '--retry-failed',
        action='store_true',
        help='Retry previously failed URLs'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit number of URLs to process (useful for testing)'
    )
    args = parser.parse_args()

    # Setup paths
    base_dir = Path(__file__).parent.parent / 'seed_data' / args.account
    links_file = base_dir / 'links.txt'
    recipes_dir = base_dir / 'recipes'
    metadata_path = base_dir / 'metadata.json'

    # Validate setup
    if not base_dir.exists():
        print(f"Creating directory: {base_dir}")
        base_dir.mkdir(parents=True)

    if not links_file.exists():
        print(f"Error: {links_file} not found")
        print(f"Create this file with one URL per line")
        sys.exit(1)

    recipes_dir.mkdir(exist_ok=True)

    # Load URLs
    with open(links_file, 'r') as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    # Load metadata
    metadata = load_metadata(metadata_path)
    metadata['account'] = args.account

    # Get already extracted URLs
    existing_urls = get_existing_urls(recipes_dir)

    # Also check metadata for extracted URLs (in case files were deleted)
    existing_urls.update(metadata.get('extracted_urls', []))

    # Determine which URLs to process
    if args.retry_failed:
        urls_to_process = metadata.get('failed_urls', [])
        print(f"Retrying {len(urls_to_process)} failed URLs...")
    else:
        urls_to_process = [url for url in urls if url not in existing_urls]

    # Apply limit if specified
    if args.limit and args.limit < len(urls_to_process):
        urls_to_process = urls_to_process[:args.limit]
        print(f"Limiting to first {args.limit} URLs")

    total = len(urls_to_process)
    if total == 0:
        print("All URLs have already been extracted!")
        print(f"Total recipes: {len(list(recipes_dir.glob('*.json')))}")
        return

    print(f"Processing {total} URLs (skipping {len(urls) - total} already extracted)")
    print("-" * 60)

    successful = 0
    failed = 0
    failed_urls = []

    for i, url in enumerate(urls_to_process, 1):
        print(f"[{i}/{total}] {url[:70]}...")

        recipes, error = await extract_single_recipe(url)

        if error:
            print(f"  FAILED: {error[:60]}")
            failed += 1
            failed_urls.append(url)
        else:
            for recipe in recipes:
                filename = get_recipe_filename(recipe)
                filepath = recipes_dir / filename

                with open(filepath, 'w') as f:
                    json.dump(recipe_to_dict(recipe), f, indent=2)

                print(f"  OK: {recipe.title[:50]}")

            successful += 1
            metadata['extracted_urls'].append(url)

        # Update metadata periodically
        if i % 10 == 0:
            metadata['stats']['successful'] = successful
            metadata['stats']['failed'] = failed
            metadata['failed_urls'] = failed_urls
            save_metadata(metadata_path, metadata)

        # Delay between requests
        if i < total:
            time.sleep(args.delay)

    # Final metadata update
    metadata['stats']['total_urls'] = len(urls)
    metadata['stats']['successful'] += successful
    metadata['stats']['failed'] = len(failed_urls)
    metadata['stats']['skipped'] = len(urls) - total
    metadata['failed_urls'] = failed_urls
    save_metadata(metadata_path, metadata)

    # Summary
    print("-" * 60)
    print(f"Done! Extracted {successful} recipes, {failed} failed")
    print(f"Recipes saved to: {recipes_dir}")

    if failed_urls:
        print(f"\nFailed URLs ({len(failed_urls)}):")
        for url in failed_urls[:5]:
            print(f"  - {url}")
        if len(failed_urls) > 5:
            print(f"  ... and {len(failed_urls) - 5} more (see metadata.json)")
        print("\nRun with --retry-failed to retry these URLs")


if __name__ == '__main__':
    asyncio.run(main())
