"""Resumable AI backfill for scalable recipe instruction amounts."""

import argparse
import asyncio
import json
from pathlib import Path
import sys

from sqlalchemy.orm import joinedload

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from models import Recipe, InstructionIngredientUsage
from services.recipe_import import annotate_instruction_usages_with_gemini


def parse_args():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Persist valid annotations")
    mode.add_argument("--dry-run", action="store_true", help="Validate without persisting (default)")
    mode.add_argument("--clear", action="store_true", help="Remove templates/usages while preserving fallback prose")
    parser.add_argument("--recipe-id", action="append", dest="recipe_ids")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true", help="Reprocess recipes that already have templates")
    parser.add_argument("--resume-file", default=".instruction-usage-backfill-progress.json")
    parser.add_argument("--report", default="instruction-usage-backfill-report.json")
    return parser.parse_args()


def load_processed(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return set(json.loads(path.read_text()).get("processed_recipe_ids", []))


def save_progress(path: Path, processed: set[str]) -> None:
    path.write_text(json.dumps({"processed_recipe_ids": sorted(processed)}, indent=2))


async def run():
    args = parse_args()
    apply = args.apply or args.clear
    resume_path = Path(args.resume_file)
    processed = load_processed(resume_path) if apply else set()
    report = {
        "mode": "clear" if args.clear else "apply" if apply else "dry-run",
        "processed": [],
        "skipped": [],
        "failures": [],
    }

    db = SessionLocal()
    try:
        query = db.query(Recipe).options(
            joinedload(Recipe.ingredients),
            joinedload(Recipe.instructions),
        ).filter(Recipe.deleted_at.is_(None)).order_by(Recipe.created_at, Recipe.id)
        if args.recipe_ids:
            query = query.filter(Recipe.id.in_(args.recipe_ids))
        recipes = query.limit(args.limit).all() if args.limit else query.all()

        for recipe in recipes:
            if args.clear:
                for instruction in recipe.instructions:
                    db.query(InstructionIngredientUsage).filter(
                        InstructionIngredientUsage.instruction_id == instruction.id
                    ).delete(synchronize_session=False)
                    instruction.instruction_template = None
                db.commit()
                processed.discard(recipe.id)
                save_progress(resume_path, processed)
                report["processed"].append({"recipe_id": recipe.id, "title": recipe.title, "cleared": True})
                continue

            if recipe.id in processed:
                report["skipped"].append({"recipe_id": recipe.id, "reason": "already processed"})
                continue
            if not args.force and any(instruction.instruction_template for instruction in recipe.instructions):
                report["skipped"].append({"recipe_id": recipe.id, "reason": "already annotated"})
                if apply:
                    processed.add(recipe.id)
                    save_progress(resume_path, processed)
                continue

            try:
                annotated = await annotate_instruction_usages_with_gemini(recipe)
                usage_count = sum(len(instruction.ingredient_usages) for instruction in annotated)
                if apply:
                    instruction_by_key = {instruction.key: instruction for instruction in recipe.instructions}
                    ingredient_by_key = {ingredient.key: ingredient for ingredient in recipe.ingredients}
                    for annotation in annotated:
                        instruction = instruction_by_key[annotation.key]
                        db.query(InstructionIngredientUsage).filter(
                            InstructionIngredientUsage.instruction_id == instruction.id
                        ).delete(synchronize_session=False)
                        instruction.instruction_template = annotation.instruction_template
                        db.flush()
                        for usage in annotation.ingredient_usages:
                            db.add(InstructionIngredientUsage(
                                instruction_id=instruction.id,
                                ingredient_id=ingredient_by_key[usage.ingredient_key].id,
                                usage_key=usage.usage_key,
                                quantity=usage.quantity,
                                quantity_max=usage.quantity_max,
                                unit=usage.unit,
                                base_text=usage.base_text,
                                sort_order=usage.sort_order,
                            ))
                    db.commit()
                    processed.add(recipe.id)
                    save_progress(resume_path, processed)
                report["processed"].append({"recipe_id": recipe.id, "title": recipe.title, "usage_count": usage_count})
            except Exception as exc:
                db.rollback()
                report["failures"].append({"recipe_id": recipe.id, "title": recipe.title, "error": str(exc)})

    finally:
        db.close()

    Path(args.report).write_text(json.dumps(report, indent=2))
    print(json.dumps({
        "mode": report["mode"],
        "processed": len(report["processed"]),
        "skipped": len(report["skipped"]),
        "failures": len(report["failures"]),
        "report": args.report,
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
