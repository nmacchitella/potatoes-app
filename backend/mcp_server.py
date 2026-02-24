"""
Potatoes MCP Server

Exposes kitchen assistant tools for Claude via the Model Context Protocol.
Mounted on the FastAPI app at /mcp. Tools call the backend API internally
via httpx (localhost), reusing all existing validation and business logic.

Auth modes:
- Static token (CLI): MCP_AUTH_TOKEN for Claude Code
- JWT token (OAuth 2.1): Issued by /oauth/token for Claude.ai
"""

import json
import secrets as secrets_mod
from datetime import timedelta

import jwt as pyjwt
from fastmcp import FastMCP
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send
import httpx

from config import settings, logger
from auth import create_access_token


# ---------------------------------------------------------------------------
# MCP instance
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "Potatoes Kitchen",
    instructions=(
        "You are a kitchen assistant for the Potatoes family app. "
        "Use these tools to manage recipes, meal plans, and grocery lists."
    ),
)


# ---------------------------------------------------------------------------
# Auth middleware — supports static token (CLI) and JWT (OAuth 2.1)
# ---------------------------------------------------------------------------

class MCPAuthMiddleware:
    """ASGI middleware supporting two auth modes:
    - Static token: matches MCP_AUTH_TOKEN, uses MCP_USER_EMAIL (CLI)
    - JWT token: decoded as JWT from OAuth 2.1 flow (claude.ai)
    """

    def __init__(self, app: ASGIApp, static_token: str = ""):
        self.app = app
        self.static_token = static_token

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode()
            bearer = auth_header.removeprefix("Bearer ").strip()

            if not bearer:
                resp = JSONResponse(status_code=401, content={"error": "Unauthorized"})
                await resp(scope, receive, send)
                return

            # Mode 1: Static token (CLI)
            if self.static_token and secrets_mod.compare_digest(bearer, self.static_token):
                await self.app(scope, receive, send)
                return

            # Mode 2: JWT token (OAuth 2.1)
            try:
                payload = pyjwt.decode(
                    bearer, settings.secret_key, algorithms=[settings.algorithm]
                )
                if not payload.get("sub"):
                    raise ValueError("No sub claim")
                await self.app(scope, receive, send)
                return
            except Exception:
                resp = JSONResponse(status_code=401, content={"error": "Invalid token"})
                await resp(scope, receive, send)
                return

        await self.app(scope, receive, send)


# ---------------------------------------------------------------------------
# Internal API client — calls the backend's own REST API via localhost
# ---------------------------------------------------------------------------

_client: httpx.AsyncClient | None = None


def _get_api_token() -> str:
    """Generate a long-lived JWT for the MCP user."""
    return create_access_token(
        data={"sub": settings.mcp_user_email},
        expires_delta=timedelta(days=3650),
    )


async def api() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=f"{settings.backend_url}/api",
            headers={"Authorization": f"Bearer {_get_api_token()}"},
            timeout=30.0,
        )
    return _client


async def api_get(path: str, params: dict | None = None) -> dict | list:
    c = await api()
    resp = await c.get(path, params=params)
    resp.raise_for_status()
    return resp.json()


async def api_post(path: str, body: dict | None = None) -> dict:
    c = await api()
    resp = await c.post(path, json=body)
    resp.raise_for_status()
    return resp.json() if resp.status_code != 204 else {"status": "ok"}


async def api_put(path: str, body: dict | None = None) -> dict:
    c = await api()
    resp = await c.put(path, json=body)
    resp.raise_for_status()
    return resp.json()


async def api_patch(path: str, body: dict | None = None) -> dict:
    c = await api()
    resp = await c.patch(path, json=body)
    resp.raise_for_status()
    return resp.json()


async def api_delete(path: str) -> dict:
    c = await api()
    resp = await c.delete(path)
    resp.raise_for_status()
    return resp.json() if resp.status_code != 204 else {"status": "deleted"}


# ---------------------------------------------------------------------------
# Formatters
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
    tags = r.get("tags") or []
    if tags:
        tag_names = [t["name"] if isinstance(t, dict) else str(t) for t in tags]
        parts.append(f"  Tags: {', '.join(tag_names)}")
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
        lines += [f"Tags: {', '.join(t['name'] for t in r['tags'])}", ""]
    if r.get("ingredients"):
        lines.append("## Ingredients")
        group = None
        for ing in r["ingredients"]:
            g = ing.get("ingredient_group")
            if g and g != group:
                lines.append(f"\n### {g}")
                group = g
            qty = str(ing["quantity"]) if ing.get("quantity") else ""
            if ing.get("quantity_max"):
                qty += f"-{ing['quantity_max']}"
            unit = ing.get("unit") or ""
            prep = f", {ing['preparation']}" if ing.get("preparation") else ""
            opt = " (optional)" if ing.get("is_optional") else ""
            lines.append(f"- {qty} {unit} {ing['name']}{prep}{opt}".strip())
        lines.append("")
    if r.get("instructions"):
        lines.append("## Instructions")
        group = None
        for inst in r["instructions"]:
            g = inst.get("instruction_group")
            if g and g != group:
                lines.append(f"\n### {g}")
                group = g
            lines.append(f"{inst['step_number']}. {inst['instruction_text']}")
        lines.append("")
    if r.get("source_url"):
        lines.append(f"Source: {r['source_url']}")
    lines.append(f"\nID: {r['id']}")
    return "\n".join(lines)


def _fmt_meal(m: dict) -> str:
    title = m.get("custom_title") or (m.get("recipe") or {}).get("title") or "Untitled"
    line = f"- [{m['meal_type']}] {title} ({m['servings']} servings)"
    if m.get("recipe_id"):
        line += f"  [recipe:{m['recipe_id']}]"
    if m.get("notes"):
        line += f"\n  Note: {m['notes']}"
    if m.get("grocery_items"):
        items = [gi.get("name", "") for gi in m["grocery_items"]]
        line += f"\n  Grocery: {', '.join(items)}"
    return line


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
# Tag tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def list_tags(category: str = "") -> str:
    """List all available tags (system and custom). Use this to discover tag IDs for filtering recipes.

    Args:
        category: Optional filter: cuisine, diet, meal_type, technique, season, custom
    """
    params: dict = {}
    if category:
        params["category"] = category
    data = await api_get("/tags", params=params)
    if not data:
        return "No tags found."
    lines = [f"Found {len(data)} tags:", ""]
    current_cat = None
    for t in data:
        cat = t.get("category") or "other"
        if cat != current_cat:
            lines.append(f"## {cat.replace('_', ' ').title()}")
            current_cat = cat
        system = " (system)" if t.get("is_system") else ""
        lines.append(f"- {t['name']} (ID: {t['id']}){system}")
    return "\n".join(lines)


@mcp.tool()
async def create_tag(name: str, category: str = "") -> str:
    """Create a new custom tag for categorizing recipes.

    Args:
        name: Tag name (e.g., "Italian", "Date Night", "Quick Weeknight")
        category: Optional category: cuisine, diet, meal_type, technique, season, or custom (default: custom)
    """
    body: dict = {"name": name}
    if category:
        body["category"] = category
    data = await api_post("/tags", body)
    return f"Tag created: **{data['name']}** (ID: {data['id']}, category: {data.get('category', 'custom')})"


@mcp.tool()
async def delete_tag(tag_id: str) -> str:
    """Delete a custom tag (system tags cannot be deleted).

    Args:
        tag_id: The tag ID to delete
    """
    await api_delete(f"/tags/{tag_id}")
    return f"Tag {tag_id} deleted."


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
        query: Text to search in title, description, and ingredient names
        tag_ids: Comma-separated tag IDs to filter by
        difficulty: Filter by difficulty (easy, medium, hard)
        collection_id: Filter by collection ID
        page: Page number (starts at 1)
        page_size: Results per page (max 100)
    """
    params: dict = {"page": page, "page_size": page_size}
    if query:
        params["search"] = query
    if tag_ids:
        params["tag_ids"] = tag_ids
    if difficulty:
        params["difficulty"] = difficulty
    if collection_id:
        params["collection_id"] = collection_id
    data = await api_get("/recipes", params=params)
    items = data.get("items", [])
    if not items:
        return "No recipes found."
    total = data.get("total", 0)
    total_pages = data.get("total_pages", 1)
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
    params = {"scale": scale} if scale != 1.0 else {}
    data = await api_get(f"/recipes/{recipe_id}", params=params)
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
    data = await api_post("/recipes", body)
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
    data = await api_put(f"/recipes/{recipe_id}", body)
    return f"Recipe updated: **{data['title']}** (ID: {data['id']})"


@mcp.tool()
async def delete_recipe(recipe_id: str) -> str:
    """Delete a recipe (soft delete).

    Args:
        recipe_id: The recipe ID to delete
    """
    await api_delete(f"/recipes/{recipe_id}")
    return f"Recipe {recipe_id} deleted."


@mcp.tool()
async def import_recipe(url: str) -> str:
    """Import a recipe from a URL (website or YouTube video).

    Args:
        url: The URL to import from
    """
    data = await api_post("/recipes/import", {"url": url})
    recipes = data.get("recipes", [])
    source = data.get("source_type", "unknown")
    if not recipes:
        return "Could not parse any recipes from that URL."
    lines = [f"Imported {len(recipes)} recipe(s) from {source}:", ""]
    for r in recipes:
        lines.append(f"**{r['title']}**")
        if r.get("description"):
            lines.append(f"  {r['description'][:120]}")
        lines.append(f"  {len(r.get('ingredients', []))} ingredients, {len(r.get('instructions', []))} steps")
        lines.append(f"  (Preview only — use create_recipe to save)")
        lines.append("")
    return "\n".join(lines)


@mcp.tool()
async def discover_recipes(page: int = 1, page_size: int = 20) -> str:
    """Browse public recipes from other users.

    Args:
        page: Page number
        page_size: Results per page
    """
    data = await api_get("/recipes/public/feed", params={"page": page, "page_size": page_size})
    items = data.get("items", [])
    if not items:
        return "No public recipes found."
    total = data.get("total", 0)
    lines = [f"Public recipes ({total} total, page {page}):", ""]
    for r in items:
        author = r.get("author", {}).get("name", "Unknown")
        lines.append(f"{_fmt_recipe_summary(r)}")
        lines.append(f"  by {author}")
    return "\n".join(lines)


@mcp.tool()
async def clone_recipe(recipe_id: str) -> str:
    """Clone a public recipe to your own collection.

    Args:
        recipe_id: The recipe ID to clone
    """
    data = await api_post(f"/recipes/{recipe_id}/clone")
    return f"Recipe cloned: **{data['title']}** (ID: {data['id']})"


# ---------------------------------------------------------------------------
# Meal plan calendar tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def list_calendars() -> str:
    """List all meal plan calendars (owned and shared with you)."""
    data = await api_get("/meal-plan/calendars")
    if not data:
        return "No calendars found."
    lines = [f"Found {len(data)} calendars:", ""]
    for c in data:
        owner_info = ""
        if not c.get("is_owner") and c.get("owner"):
            owner_info = f" (shared by {c['owner']['name']}, {c.get('permission', 'viewer')})"
        elif c.get("share_count"):
            owner_info = f" (shared with {c['share_count']} user(s))"
        lines.append(f"- **{c['name']}** (ID: {c['id']}){owner_info}")
    return "\n".join(lines)


@mcp.tool()
async def create_calendar(name: str) -> str:
    """Create a new meal plan calendar.

    Args:
        name: Calendar name (e.g., "Family Dinners", "Meal Prep")
    """
    data = await api_post("/meal-plan/calendars", {"name": name})
    return f"Calendar created: **{data['name']}** (ID: {data['id']})"


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
    params: dict = {"start": start_date, "end": end_date}
    if calendar_ids:
        params["calendar_ids"] = calendar_ids
    data = await api_get("/meal-plan", params=params)
    items = data.get("items", [])
    if not items:
        return f"No meals planned from {start_date} to {end_date}."
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
    grocery_items: str = "",
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
        grocery_items: JSON array of grocery items for custom meals, e.g. [{"name":"apples","quantity":4,"unit":"pieces","category":"produce"}]
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
    if grocery_items:
        body["grocery_items"] = json.loads(grocery_items)
    data = await api_post("/meal-plan", body)
    title = data.get("custom_title") or (data.get("recipe") or {}).get("title") or "Meal"
    return f"Added **{title}** on {planned_date} ({meal_type}) — ID: {data['id']}"


@mcp.tool()
async def update_meal(
    meal_plan_id: str,
    planned_date: str = "",
    meal_type: str = "",
    servings: float | None = None,
    notes: str = "",
    grocery_items: str = "",
) -> str:
    """Update a meal plan entry.

    Args:
        meal_plan_id: The meal plan entry ID
        planned_date: New date (YYYY-MM-DD)
        meal_type: breakfast, lunch, dinner, or snack
        servings: Number of servings
        notes: Updated notes
        grocery_items: JSON array of grocery items for custom meals, e.g. [{"name":"apples","quantity":4,"unit":"pieces","category":"produce"}]
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
    if grocery_items:
        body["grocery_items"] = json.loads(grocery_items)
    data = await api_patch(f"/meal-plan/{meal_plan_id}", body)
    return f"Meal updated (ID: {data['id']})"


@mcp.tool()
async def remove_from_meal_plan(meal_plan_id: str) -> str:
    """Remove a meal from the plan.

    Args:
        meal_plan_id: The meal plan entry ID to remove
    """
    await api_delete(f"/meal-plan/{meal_plan_id}")
    return f"Meal {meal_plan_id} removed from plan."


@mcp.tool()
async def move_meal(meal_plan_id: str, planned_date: str, meal_type: str) -> str:
    """Move a meal to a different date and/or meal slot.

    Args:
        meal_plan_id: The meal plan entry ID to move
        planned_date: New date (YYYY-MM-DD)
        meal_type: New meal slot: breakfast, lunch, dinner, or snack
    """
    data = await api_post(f"/meal-plan/{meal_plan_id}/move", {
        "planned_date": planned_date,
        "meal_type": meal_type,
    })
    title = data.get("custom_title") or (data.get("recipe") or {}).get("title") or "Meal"
    return f"Moved **{title}** to {planned_date} ({meal_type})"


@mcp.tool()
async def swap_meals(meal_plan_id_1: str, meal_plan_id_2: str) -> str:
    """Swap two meals (exchange their dates and meal types).

    Args:
        meal_plan_id_1: First meal plan entry ID
        meal_plan_id_2: Second meal plan entry ID
    """
    await api_post(f"/meal-plan/swap?meal_plan_id_1={meal_plan_id_1}&meal_plan_id_2={meal_plan_id_2}")
    return f"Swapped meals {meal_plan_id_1} and {meal_plan_id_2}."


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
        lists = await api_get("/grocery-list")
        if not lists:
            return "No grocery lists found."
        list_id = lists[0]["id"]
    data = await api_get(f"/grocery-list/{list_id}")
    items = data.get("items", [])
    name = data.get("name", "Grocery List")
    if not items:
        return f"**{name}** is empty."
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
        lists = await api_get("/grocery-list")
        if not lists:
            return "No grocery lists found."
        list_id = lists[0]["id"]
    body: dict = {"start_date": start_date, "end_date": end_date, "merge": merge}
    if calendar_ids:
        body["calendar_ids"] = [c.strip() for c in calendar_ids.split(",")]
    data = await api_post(f"/grocery-list/{list_id}/generate", body)
    count = len(data.get("items", []))
    return f"Grocery list generated with {count} items from meals {start_date} to {end_date}. List ID: {list_id}"


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
        lists = await api_get("/grocery-list")
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
    data = await api_post(f"/grocery-list/{list_id}/items", body)
    return f"Added **{data['name']}** to grocery list."


@mcp.tool()
async def delete_grocery_item(item_id: str, list_id: str = "") -> str:
    """Remove an item from a grocery list.

    Args:
        item_id: The grocery item ID to delete
        list_id: Grocery list ID (uses default if empty)
    """
    if not list_id:
        lists = await api_get("/grocery-list")
        if not lists:
            return "No grocery lists found."
        list_id = lists[0]["id"]
    await api_delete(f"/grocery-list/{list_id}/items/{item_id}")
    return f"Item {item_id} removed from grocery list."


@mcp.tool()
async def check_grocery_items(item_ids: str, is_checked: bool = True, list_id: str = "") -> str:
    """Check or uncheck multiple grocery list items at once.

    Args:
        item_ids: Comma-separated item IDs to check/uncheck
        is_checked: True to check items off, False to uncheck them
        list_id: Grocery list ID (uses default if empty)
    """
    if not list_id:
        lists = await api_get("/grocery-list")
        if not lists:
            return "No grocery lists found."
        list_id = lists[0]["id"]
    id_list = [i.strip() for i in item_ids.split(",")]
    data = await api_patch(f"/grocery-list/{list_id}/items/bulk-check", {
        "item_ids": id_list,
        "is_checked": is_checked,
    })
    action = "checked" if is_checked else "unchecked"
    return f"{data.get('updated', len(id_list))} items {action}."


@mcp.tool()
async def clear_grocery_list(list_id: str = "", checked_only: bool = False) -> str:
    """Clear all items from a grocery list.

    Args:
        list_id: Grocery list ID (uses default if empty)
        checked_only: If True, only clear checked-off items
    """
    if not list_id:
        lists = await api_get("/grocery-list")
        if not lists:
            return "No grocery lists found."
        list_id = lists[0]["id"]
    data = await api_delete(f"/grocery-list/{list_id}/clear?checked_only={str(checked_only).lower()}")
    count = data.get("deleted", 0)
    scope = "checked items" if checked_only else "all items"
    return f"Cleared {count} {scope} from grocery list."


# ---------------------------------------------------------------------------
# Collection tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def list_collections() -> str:
    """List all recipe collections (owned and from library partners)."""
    data = await api_get("/collections")
    if not data:
        return "No collections found."
    lines = [f"Found {len(data)} collections:", ""]
    for c in data:
        count = c.get("recipe_count", 0)
        owner = ""
        if c.get("owner"):
            owner = f" (by {c['owner']['name']})"
        lines.append(f"- **{c['name']}** — {count} recipes (ID: {c['id']}){owner}")
    return "\n".join(lines)


@mcp.tool()
async def get_collection(collection_id: str) -> str:
    """Get a collection with its recipes.

    Args:
        collection_id: The collection ID
    """
    data = await api_get(f"/collections/{collection_id}")
    name = data.get("name", "Collection")
    recipes = data.get("recipes", [])
    lines = [f"# {name}"]
    if data.get("description"):
        lines.append(data["description"])
    lines.append(f"\n{len(recipes)} recipes:")
    lines.append("")
    for r in recipes:
        lines.append(_fmt_recipe_summary(r))
    lines.append(f"\nCollection ID: {collection_id}")
    return "\n".join(lines)


@mcp.tool()
async def create_collection(name: str, description: str = "") -> str:
    """Create a new recipe collection.

    Args:
        name: Collection name (e.g., "Weeknight Dinners", "Holiday Baking")
        description: Optional description
    """
    body: dict = {"name": name}
    if description:
        body["description"] = description
    data = await api_post("/collections", body)
    return f"Collection created: **{data['name']}** (ID: {data['id']})"


@mcp.tool()
async def update_collection(collection_id: str, name: str = "", description: str = "") -> str:
    """Update a collection's name or description.

    Args:
        collection_id: The collection ID
        name: New name
        description: New description
    """
    body: dict = {}
    if name:
        body["name"] = name
    if description:
        body["description"] = description
    data = await api_put(f"/collections/{collection_id}", body)
    return f"Collection updated: **{data['name']}** (ID: {data['id']})"


@mcp.tool()
async def delete_collection(collection_id: str) -> str:
    """Delete a collection (recipes in it are NOT deleted).

    Args:
        collection_id: The collection ID to delete
    """
    await api_delete(f"/collections/{collection_id}")
    return f"Collection {collection_id} deleted."


@mcp.tool()
async def add_recipe_to_collection(collection_id: str, recipe_id: str) -> str:
    """Add a recipe to a collection.

    Args:
        collection_id: The collection ID
        recipe_id: The recipe ID to add
    """
    await api_post(f"/collections/{collection_id}/recipes/{recipe_id}")
    return f"Recipe {recipe_id} added to collection {collection_id}."


@mcp.tool()
async def remove_recipe_from_collection(collection_id: str, recipe_id: str) -> str:
    """Remove a recipe from a collection (does not delete the recipe).

    Args:
        collection_id: The collection ID
        recipe_id: The recipe ID to remove
    """
    await api_delete(f"/collections/{collection_id}/recipes/{recipe_id}")
    return f"Recipe {recipe_id} removed from collection {collection_id}."


# ---------------------------------------------------------------------------
# Ingredient tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def search_ingredients(query: str = "", category: str = "", limit: int = 20) -> str:
    """Search available ingredients for autocomplete when building recipes.

    Args:
        query: Search text to match ingredient names
        category: Filter by category (e.g., produce, dairy, meat, spices)
        limit: Max results (default 20)
    """
    params: dict = {"limit": limit}
    if query:
        params["search"] = query
    if category:
        params["category"] = category
    data = await api_get("/ingredients", params=params)
    if not data:
        return "No ingredients found."
    lines = [f"Found {len(data)} ingredients:", ""]
    for ing in data:
        cat = ing.get("category") or "other"
        system = " (system)" if ing.get("is_system") else ""
        lines.append(f"- {ing['name']} [{cat}]{system} (ID: {ing['id']})")
    return "\n".join(lines)


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
    data = await api_get("/search/full", params=params)
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
                lines.append(f"- {item.get('name', str(item))}")
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
# Build the mountable ASGI app
# ---------------------------------------------------------------------------

def create_mcp_app() -> tuple[ASGIApp, object] | None:
    """Create the MCP ASGI app with auth middleware. Returns (asgi_app, mcp_app) or None."""
    has_legacy = bool(settings.mcp_auth_token and settings.mcp_user_email)
    has_oauth = bool(settings.mcp_oauth_client_id)

    if not has_legacy and not has_oauth:
        logger.info("MCP server disabled (need MCP_AUTH_TOKEN+MCP_USER_EMAIL or MCP_OAUTH_CLIENT_ID)")
        return None

    mcp_app = mcp.http_app(path="/")
    authed_app = MCPAuthMiddleware(
        mcp_app,
        static_token=settings.mcp_auth_token if has_legacy else "",
    )
    logger.info("MCP server enabled (static_token=%s, oauth=%s)", bool(has_legacy), bool(has_oauth))
    return authed_app, mcp_app
