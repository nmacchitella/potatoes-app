"""Potatoes MCP Server — Kitchen assistant tools for Claude."""

import json
import os
from mcp.server.fastmcp import FastMCP
from api_client import api

mcp = FastMCP(
    "Potatoes Kitchen",
    instructions=(
        "You are a kitchen assistant for the Potatoes family app. "
        "Use these tools to manage recipes, meal plans, and grocery lists."
    ),
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt_recipe_summary(r: dict) -> str:
    parts = [f"**{r['title']}** (ID: {r['id']})"]
    if r.get("description"):
        parts.append(f"  {r['description'][:120]}")
    meta = []
    if r.get("prep_time_minutes"):
        meta.append(f"prep {r['prep_time_minutes']}min")
    if r.get("cook_time_minutes"):
        meta.append(f"cook {r['cook_time_minutes']}min")
    if r.get("difficulty"):
        meta.append(r["difficulty"])
    if r.get("privacy_level"):
        meta.append(r["privacy_level"])
    if meta:
        parts.append(f"  {' | '.join(meta)}")
    return "\n".join(parts)


def _fmt_recipe_full(r: dict) -> str:
    lines = [f"# {r['title']}", ""]
    if r.get("description"):
        lines += [r["description"], ""]

    meta = []
    if r.get("yield_quantity"):
        unit = r.get("yield_unit") or "servings"
        meta.append(f"Yield: {r['yield_quantity']} {unit}")
    if r.get("prep_time_minutes"):
        meta.append(f"Prep: {r['prep_time_minutes']} min")
    if r.get("cook_time_minutes"):
        meta.append(f"Cook: {r['cook_time_minutes']} min")
    if r.get("difficulty"):
        meta.append(f"Difficulty: {r['difficulty']}")
    if meta:
        lines += [" | ".join(meta), ""]

    if r.get("tags"):
        tag_names = [t["name"] for t in r["tags"]]
        lines += [f"Tags: {', '.join(tag_names)}", ""]

    if r.get("ingredients"):
        lines.append("## Ingredients")
        current_group = None
        for ing in r["ingredients"]:
            group = ing.get("ingredient_group")
            if group and group != current_group:
                lines.append(f"\n### {group}")
                current_group = group
            qty = ""
            if ing.get("quantity"):
                qty = str(ing["quantity"])
                if ing.get("quantity_max"):
                    qty += f"-{ing['quantity_max']}"
            unit = ing.get("unit") or ""
            prep = f", {ing['preparation']}" if ing.get("preparation") else ""
            optional = " (optional)" if ing.get("is_optional") else ""
            lines.append(f"- {qty} {unit} {ing['name']}{prep}{optional}".strip())
        lines.append("")

    if r.get("instructions"):
        lines.append("## Instructions")
        current_group = None
        for inst in r["instructions"]:
            group = inst.get("instruction_group")
            if group and group != current_group:
                lines.append(f"\n### {group}")
                current_group = group
            lines.append(f"{inst['step_number']}. {inst['instruction_text']}")
        lines.append("")

    if r.get("source_url"):
        lines.append(f"Source: {r['source_url']}")

    lines.append(f"\nID: {r['id']}")
    return "\n".join(lines)


def _fmt_meal(m: dict) -> str:
    title = m.get("custom_title") or (m.get("recipe") or {}).get("title") or "Untitled"
    recipe_id = m.get("recipe_id") or ""
    parts = [f"- [{m['meal_type']}] {title} ({m['servings']} servings)"]
    if recipe_id:
        parts[0] += f"  [recipe:{recipe_id}]"
    if m.get("notes"):
        parts.append(f"  Note: {m['notes']}")
    return "\n".join(parts)


def _fmt_grocery_item(item: dict) -> str:
    qty = ""
    if item.get("quantity"):
        qty = f"{item['quantity']}"
        if item.get("unit"):
            qty += f" {item['unit']}"
        qty += " "
    checked = "[x]" if item.get("is_checked") else "[ ]"
    return f"{checked} {qty}{item['name']}"


# ---------------------------------------------------------------------------
# Recipe tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def search_recipes(
    query: str = "",
    tag_ids: str = "",
    difficulty: str = "",
    collection_id: str = "",
    page: int = 1,
    page_size: int = 20,
) -> str:
    """Search the user's recipes. Returns a paginated list.

    Args:
        query: Text to search in title/description
        tag_ids: Comma-separated tag IDs to filter by
        difficulty: Filter by difficulty (easy, medium, hard)
        collection_id: Filter by collection ID
        page: Page number (starts at 1)
        page_size: Results per page (max 100)
    """
    params = {"page": page, "page_size": page_size}
    if query:
        params["search"] = query
    if tag_ids:
        params["tag_ids"] = tag_ids
    if difficulty:
        params["difficulty"] = difficulty
    if collection_id:
        params["collection_id"] = collection_id

    data = await api.get("/recipes", params=params)
    items = data.get("items", [])
    total = data.get("total", 0)
    total_pages = data.get("total_pages", 1)

    if not items:
        return "No recipes found."

    lines = [f"Found {total} recipes (page {page}/{total_pages}):", ""]
    lines += [_fmt_recipe_summary(r) for r in items]
    return "\n".join(lines)


@mcp.tool()
async def get_recipe(recipe_id: str, scale: float = 1.0) -> str:
    """Get full recipe details including ingredients and instructions.

    Args:
        recipe_id: The recipe ID
        scale: Scale factor for ingredients (e.g., 2.0 for double)
    """
    params = {}
    if scale != 1.0:
        params["scale"] = scale
    data = await api.get(f"/recipes/{recipe_id}", params=params)
    return _fmt_recipe_full(data)


@mcp.tool()
async def create_recipe(
    title: str,
    description: str = "",
    ingredients: str = "[]",
    instructions: str = "[]",
    prep_time_minutes: int | None = None,
    cook_time_minutes: int | None = None,
    yield_quantity: float | None = None,
    yield_unit: str = "servings",
    difficulty: str = "",
    privacy_level: str = "private",
    tag_ids: str = "",
    status: str = "published",
) -> str:
    """Create a new recipe.

    Args:
        title: Recipe title
        description: Short description
        ingredients: JSON array of ingredients, each with: name (required), quantity, unit, preparation, is_optional, ingredient_group
        instructions: JSON array of instructions, each with: step_number (required), instruction_text (required), instruction_group
        prep_time_minutes: Preparation time in minutes
        cook_time_minutes: Cooking time in minutes
        yield_quantity: Number of servings/portions
        yield_unit: Unit for yield (e.g., "servings", "pieces")
        difficulty: easy, medium, or hard
        privacy_level: public or private
        tag_ids: Comma-separated tag IDs
        status: draft or published
    """
    body: dict = {
        "title": title,
        "status": status,
        "privacy_level": privacy_level,
        "ingredients": json.loads(ingredients),
        "instructions": json.loads(instructions),
    }
    if description:
        body["description"] = description
    if prep_time_minutes is not None:
        body["prep_time_minutes"] = prep_time_minutes
    if cook_time_minutes is not None:
        body["cook_time_minutes"] = cook_time_minutes
    if yield_quantity is not None:
        body["yield_quantity"] = yield_quantity
        body["yield_unit"] = yield_unit
    if difficulty:
        body["difficulty"] = difficulty
    if tag_ids:
        body["tag_ids"] = [t.strip() for t in tag_ids.split(",")]

    data = await api.post("/recipes", json=body)
    return f"Recipe created: **{data['title']}** (ID: {data['id']})"


@mcp.tool()
async def update_recipe(
    recipe_id: str,
    title: str = "",
    description: str = "",
    ingredients: str = "",
    instructions: str = "",
    prep_time_minutes: int | None = None,
    cook_time_minutes: int | None = None,
    yield_quantity: float | None = None,
    yield_unit: str = "",
    difficulty: str = "",
    privacy_level: str = "",
    tag_ids: str = "",
    status: str = "",
) -> str:
    """Update an existing recipe. Only provide fields you want to change.

    Args:
        recipe_id: The recipe ID to update
        title: New title
        description: New description
        ingredients: JSON array of ingredients (replaces all)
        instructions: JSON array of instructions (replaces all)
        prep_time_minutes: Preparation time in minutes
        cook_time_minutes: Cooking time in minutes
        yield_quantity: Number of servings/portions
        yield_unit: Unit for yield
        difficulty: easy, medium, or hard
        privacy_level: public or private
        tag_ids: Comma-separated tag IDs
        status: draft or published
    """
    body: dict = {}
    if title:
        body["title"] = title
    if description:
        body["description"] = description
    if ingredients:
        body["ingredients"] = json.loads(ingredients)
    if instructions:
        body["instructions"] = json.loads(instructions)
    if prep_time_minutes is not None:
        body["prep_time_minutes"] = prep_time_minutes
    if cook_time_minutes is not None:
        body["cook_time_minutes"] = cook_time_minutes
    if yield_quantity is not None:
        body["yield_quantity"] = yield_quantity
    if yield_unit:
        body["yield_unit"] = yield_unit
    if difficulty:
        body["difficulty"] = difficulty
    if privacy_level:
        body["privacy_level"] = privacy_level
    if tag_ids:
        body["tag_ids"] = [t.strip() for t in tag_ids.split(",")]
    if status:
        body["status"] = status

    data = await api.put(f"/recipes/{recipe_id}", json=body)
    return f"Recipe updated: **{data['title']}** (ID: {data['id']})"


@mcp.tool()
async def delete_recipe(recipe_id: str) -> str:
    """Delete a recipe (soft delete).

    Args:
        recipe_id: The recipe ID to delete
    """
    await api.delete(f"/recipes/{recipe_id}")
    return f"Recipe {recipe_id} deleted."


@mcp.tool()
async def import_recipe(url: str) -> str:
    """Import a recipe from a URL (website or YouTube video).

    Args:
        url: The URL to import from
    """
    data = await api.post("/recipes/import", json={"url": url})
    recipes = data.get("recipes", [])
    source = data.get("source_type", "unknown")

    if not recipes:
        return "Could not parse any recipes from that URL."

    lines = [f"Imported {len(recipes)} recipe(s) from {source}:", ""]
    for r in recipes:
        lines.append(f"**{r['title']}**")
        if r.get("description"):
            lines.append(f"  {r['description'][:120]}")
        ing_count = len(r.get("ingredients", []))
        step_count = len(r.get("instructions", []))
        lines.append(f"  {ing_count} ingredients, {step_count} steps")
        lines.append(f"  (This is a preview — use create_recipe to save it)")
        lines.append("")

    return "\n".join(lines)


@mcp.tool()
async def discover_recipes(page: int = 1, page_size: int = 20) -> str:
    """Browse public recipes from other users.

    Args:
        page: Page number
        page_size: Results per page
    """
    data = await api.get("/recipes/public/feed", params={"page": page, "page_size": page_size})
    items = data.get("items", [])
    total = data.get("total", 0)

    if not items:
        return "No public recipes found."

    lines = [f"Public recipes ({total} total, page {page}):", ""]
    for r in items:
        author = r.get("author", {}).get("name", "Unknown")
        lines.append(f"{_fmt_recipe_summary(r)}")
        lines.append(f"  by {author}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Meal plan tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def get_meal_plan(start_date: str, end_date: str, calendar_ids: str = "") -> str:
    """Get meal plan entries for a date range.

    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        calendar_ids: Comma-separated calendar IDs (optional, defaults to all)
    """
    params = {"start": start_date, "end": end_date}
    if calendar_ids:
        params["calendar_ids"] = calendar_ids

    data = await api.get("/meal-plan", params=params)
    items = data.get("items", [])

    if not items:
        return f"No meals planned from {start_date} to {end_date}."

    # Group by date
    by_date: dict[str, list] = {}
    for m in items:
        d = m.get("planned_date", "unknown")
        by_date.setdefault(d, []).append(m)

    lines = [f"Meal plan: {start_date} to {end_date}", ""]
    for date in sorted(by_date):
        lines.append(f"### {date}")
        for m in by_date[date]:
            lines.append(_fmt_meal(m))
        lines.append("")

    return "\n".join(lines)


@mcp.tool()
async def add_to_meal_plan(
    planned_date: str,
    meal_type: str,
    calendar_id: str,
    recipe_id: str = "",
    custom_title: str = "",
    servings: float = 4,
    notes: str = "",
) -> str:
    """Add a recipe or custom meal to a meal plan calendar.

    Args:
        planned_date: Date to plan for (YYYY-MM-DD)
        meal_type: breakfast, lunch, dinner, or snack
        calendar_id: Calendar ID to add to
        recipe_id: Recipe ID (provide this OR custom_title)
        custom_title: Custom meal name (if not using a recipe)
        servings: Number of servings
        notes: Optional notes
    """
    body: dict = {
        "calendar_id": calendar_id,
        "planned_date": planned_date,
        "meal_type": meal_type,
        "servings": servings,
    }
    if recipe_id:
        body["recipe_id"] = recipe_id
    if custom_title:
        body["custom_title"] = custom_title
    if notes:
        body["notes"] = notes

    data = await api.post("/meal-plan", json=body)
    title = data.get("custom_title") or (data.get("recipe") or {}).get("title") or "Meal"
    return f"Added **{title}** on {planned_date} ({meal_type}) — ID: {data['id']}"


@mcp.tool()
async def update_meal(
    meal_plan_id: str,
    planned_date: str = "",
    meal_type: str = "",
    servings: float | None = None,
    notes: str = "",
) -> str:
    """Update a meal plan entry.

    Args:
        meal_plan_id: The meal plan entry ID
        planned_date: New date (YYYY-MM-DD)
        meal_type: breakfast, lunch, dinner, or snack
        servings: Number of servings
        notes: Updated notes
    """
    body: dict = {}
    if planned_date:
        body["planned_date"] = planned_date
    if meal_type:
        body["meal_type"] = meal_type
    if servings is not None:
        body["servings"] = servings
    if notes:
        body["notes"] = notes

    data = await api.patch(f"/meal-plan/{meal_plan_id}", json=body)
    return f"Meal updated (ID: {data['id']})"


@mcp.tool()
async def remove_from_meal_plan(meal_plan_id: str) -> str:
    """Remove a meal from the plan.

    Args:
        meal_plan_id: The meal plan entry ID to remove
    """
    await api.delete(f"/meal-plan/{meal_plan_id}")
    return f"Meal {meal_plan_id} removed from plan."


# ---------------------------------------------------------------------------
# Grocery list tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def get_grocery_list(list_id: str = "") -> str:
    """Get a grocery list with all items. If no list_id is given, returns the first list.

    Args:
        list_id: Grocery list ID (optional — fetches default list if omitted)
    """
    if not list_id:
        lists = await api.get("/grocery-list")
        if not lists:
            return "No grocery lists found."
        list_id = lists[0]["id"]

    data = await api.get(f"/grocery-list/{list_id}")
    items = data.get("items", [])
    name = data.get("name", "Grocery List")

    if not items:
        return f"**{name}** is empty."

    # Group by category
    by_cat = data.get("items_by_category", {})
    lines = [f"# {name}", f"{len(items)} items", ""]

    if by_cat:
        for cat, cat_items in by_cat.items():
            lines.append(f"## {cat}")
            for item in cat_items:
                lines.append(f"  {_fmt_grocery_item(item)}")
            lines.append("")
    else:
        for item in items:
            lines.append(f"  {_fmt_grocery_item(item)}")

    lines.append(f"\nList ID: {list_id}")
    return "\n".join(lines)


@mcp.tool()
async def generate_grocery_list(
    start_date: str,
    end_date: str,
    list_id: str = "",
    merge: bool = True,
    calendar_ids: str = "",
) -> str:
    """Generate a grocery list from meal plan entries in a date range.

    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        list_id: Target grocery list ID (uses default if empty)
        merge: Merge with existing items (True) or replace (False)
        calendar_ids: Comma-separated calendar IDs (optional)
    """
    if not list_id:
        lists = await api.get("/grocery-list")
        if not lists:
            return "No grocery lists found."
        list_id = lists[0]["id"]

    body: dict = {
        "start_date": start_date,
        "end_date": end_date,
        "merge": merge,
    }
    if calendar_ids:
        body["calendar_ids"] = [c.strip() for c in calendar_ids.split(",")]

    data = await api.post(f"/grocery-list/{list_id}/generate", json=body)
    item_count = len(data.get("items", []))
    return f"Grocery list generated with {item_count} items from meals {start_date} to {end_date}. List ID: {list_id}"


@mcp.tool()
async def add_grocery_item(
    name: str,
    list_id: str = "",
    quantity: float | None = None,
    unit: str = "",
    category: str = "",
) -> str:
    """Add an item to a grocery list.

    Args:
        name: Item name
        list_id: Grocery list ID (uses default if empty)
        quantity: Amount needed
        unit: Measurement unit (e.g., kg, pieces, cups)
        category: Category (e.g., Produce, Dairy, Meat)
    """
    if not list_id:
        lists = await api.get("/grocery-list")
        if not lists:
            return "No grocery lists found."
        list_id = lists[0]["id"]

    body: dict = {"name": name}
    if quantity is not None:
        body["quantity"] = quantity
    if unit:
        body["unit"] = unit
    if category:
        body["category"] = category

    data = await api.post(f"/grocery-list/{list_id}/items", json=body)
    return f"Added **{data['name']}** to grocery list."


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@mcp.tool()
async def search(query: str, category: str = "", page: int = 1, page_size: int = 10) -> str:
    """Full-text search across recipes, tags, collections, users, and ingredients.

    Args:
        query: Search text
        category: Optionally limit to: recipes, tags, collections, users, ingredients
        page: Page number
        page_size: Results per page
    """
    params: dict = {"q": query, "page": page, "page_size": page_size}
    if category:
        params["category"] = category

    data = await api.get("/search/full", params=params)

    lines = [f"Search results for \"{query}\":", ""]

    for key in ["recipes", "tags", "collections", "users", "ingredients"]:
        section = data.get(key)
        if not section:
            continue
        items = section.get("items", section) if isinstance(section, dict) else section
        if not items:
            continue

        lines.append(f"## {key.title()}")
        for item in items[:10]:
            if key == "recipes":
                lines.append(f"- **{item['title']}** (ID: {item['id']})")
            elif key == "tags":
                lines.append(f"- {item.get('name', item.get('id', str(item)))}")
            elif key == "collections":
                lines.append(f"- {item.get('name', '')} (ID: {item.get('id', '')})")
            elif key == "users":
                lines.append(f"- {item.get('name', '')} ({item.get('email', '')})")
            elif key == "ingredients":
                lines.append(f"- {item.get('name', str(item))}")
        lines.append("")

    if len(lines) <= 2:
        return f"No results for \"{query}\"."

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    host = os.environ.get("MCP_HOST", "0.0.0.0")
    port = int(os.environ.get("MCP_PORT", "8001"))
    mcp.run(transport="streamable-http", host=host, port=port)
