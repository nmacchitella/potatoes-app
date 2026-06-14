"""Audit and conservatively clean recipe ingredients and master ingredient links."""

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func

from database import SessionLocal
from models import Ingredient, Recipe, RecipeIngredient
from routers.ingredient_router import find_or_create_ingredient
from services.ingredient_normalization import (
    ingredient_match_key,
    normalize_recipe_ingredient_fields,
)


def parse_args():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Apply conservative fixes")
    mode.add_argument("--dry-run", action="store_true", help="Report without changing data (default)")
    parser.add_argument("--recipe-id", action="append", dest="recipe_ids")
    parser.add_argument("--active-only", action="store_true", help="Exclude soft-deleted recipes")
    parser.add_argument("--report", default="recipe-ingredient-audit.json")
    return parser.parse_args()


def choose_canonical(group: list[Ingredient], usage_counts: dict[str, int]) -> Ingredient:
    match_key = ingredient_match_key(group[0].name)
    return sorted(
        group,
        key=lambda ingredient: (
            not ingredient.is_system,
            ingredient.normalized_name != match_key,
            -usage_counts.get(ingredient.id, 0),
            ingredient.created_at is None,
            ingredient.created_at or datetime.max.replace(tzinfo=timezone.utc),
            ingredient.id,
        ),
    )[0]


def run():
    args = parse_args()
    report = {
        "mode": "apply" if args.apply else "dry-run",
        "summary": {},
        "recipe_ingredient_changes": [],
        "master_link_changes": [],
        "unresolved_issues": [],
        "master_merge_groups": [],
    }
    db = SessionLocal()
    try:
        query = db.query(RecipeIngredient).join(Recipe)
        if args.active_only:
            query = query.filter(Recipe.deleted_at.is_(None))
        if args.recipe_ids:
            query = query.filter(Recipe.id.in_(args.recipe_ids))
        rows = query.order_by(Recipe.title, RecipeIngredient.sort_order).all()

        for row in rows:
            normalized = normalize_recipe_ingredient_fields(
                row.name,
                row.unit,
                row.preparation,
                row.notes,
            )
            if normalized.changes:
                report["recipe_ingredient_changes"].append({
                    "recipe_id": row.recipe_id,
                    "recipe_title": row.recipe.title,
                    "recipe_ingredient_id": row.id,
                    "before": {
                        "name": row.name,
                        "unit": row.unit,
                        "preparation": row.preparation,
                        "notes": row.notes,
                        "master_ingredient_id": row.ingredient_id,
                    },
                    "after": {
                        "name": normalized.name,
                        "unit": normalized.unit,
                        "preparation": normalized.preparation,
                        "notes": normalized.notes,
                    },
                    "changes": normalized.changes,
                })
            if normalized.issues:
                report["unresolved_issues"].append({
                    "recipe_id": row.recipe_id,
                    "recipe_title": row.recipe.title,
                    "recipe_ingredient_id": row.id,
                    "name": row.name,
                    "unit": row.unit,
                    "issues": normalized.issues,
                })
            preferred_ingredient = find_or_create_ingredient(
                db,
                normalized.name,
                row.recipe.author_id,
            )
            if preferred_ingredient.id != row.ingredient_id:
                report["master_link_changes"].append({
                    "recipe_id": row.recipe_id,
                    "recipe_title": row.recipe.title,
                    "recipe_ingredient_id": row.id,
                    "name": normalized.name,
                    "before_master_ingredient_id": row.ingredient_id,
                    "after_master_ingredient_id": preferred_ingredient.id,
                    "after_master_ingredient_name": preferred_ingredient.name,
                })
            if args.apply:
                row.name = normalized.name
                row.unit = normalized.unit
                row.preparation = normalized.preparation
                row.notes = normalized.notes
                row.ingredient = preferred_ingredient

        db.flush()
        usage_counts = {
            ingredient_id: count
            for ingredient_id, count in db.query(
                RecipeIngredient.ingredient_id,
                func.count(RecipeIngredient.id),
            ).group_by(RecipeIngredient.ingredient_id).all()
        }
        groups: dict[tuple[str | None, str], list[Ingredient]] = defaultdict(list)
        ingredient_query = db.query(Ingredient)
        if args.recipe_ids:
            ingredient_query = ingredient_query.join(RecipeIngredient).filter(
                RecipeIngredient.recipe_id.in_(args.recipe_ids)
            )
        for ingredient in ingredient_query.all():
            owner = None if ingredient.is_system else ingredient.user_id
            groups[(owner, ingredient_match_key(ingredient.name))].append(ingredient)

        for (owner, match_key), group in groups.items():
            if len(group) < 2:
                continue
            canonical = choose_canonical(group, usage_counts)
            duplicates = [ingredient for ingredient in group if ingredient.id != canonical.id]
            report["master_merge_groups"].append({
                "owner": owner,
                "match_key": match_key,
                "canonical": {"id": canonical.id, "name": canonical.name},
                "duplicates": [
                    {"id": ingredient.id, "name": ingredient.name, "references": usage_counts.get(ingredient.id, 0)}
                    for ingredient in duplicates
                ],
            })
            if args.apply:
                for duplicate in duplicates:
                    for recipe_ingredient in list(duplicate.recipe_ingredients):
                        recipe_ingredient.ingredient = canonical
                    db.delete(duplicate)

        report["summary"] = {
            "recipe_ingredients_scanned": len(rows),
            "recipe_ingredients_with_changes": len(report["recipe_ingredient_changes"]),
            "master_link_changes": len(report["master_link_changes"]),
            "unresolved_issues": len(report["unresolved_issues"]),
            "master_merge_groups": len(report["master_merge_groups"]),
        }
        if args.apply:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    Path(args.report).write_text(json.dumps(report, indent=2))
    print(json.dumps(report["summary"], indent=2))
    print(f"Report: {args.report}")


if __name__ == "__main__":
    run()
