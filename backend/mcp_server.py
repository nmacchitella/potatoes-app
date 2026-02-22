"""
Potatoes MCP Server

Exposes kitchen assistant tools for Claude via the Model Context Protocol.
Mounted on the FastAPI app at /mcp. Tools call the backend API internally
via httpx (localhost), reusing all existing validation and business logic.

Auth modes:
- Google OAuth (for Claude.ai): Uses FastMCP's GoogleProvider when GOOGLE_CLIENT_ID is set
- Bearer token (for Claude Code): Falls back to MCP_AUTH_TOKEN when Google OAuth is not configured
"""

import json
import secrets as secrets_mod
from datetime import timedelta

from fastmcp import FastMCP
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send
import httpx

from config import settings, logger
from auth import create_access_token


# ---------------------------------------------------------------------------
# Auth setup
# ---------------------------------------------------------------------------

def _build_google_auth():
    """Build GoogleProvider if Google OAuth credentials are available."""
    if not settings.google_client_id or not settings.google_client_secret:
        return None
    try:
        from fastmcp.server.auth.providers.google import GoogleProvider
        from key_value.aio.stores.memory.store import MemoryStore
        return GoogleProvider(
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            base_url=f"{settings.backend_url}/mcp",
            required_scopes=["openid", "https://www.googleapis.com/auth/userinfo.email"],
            require_authorization_consent=False,
            jwt_signing_key=settings.secret_key,
            client_storage=MemoryStore(),
        )
    except Exception as e:
        logger.warning(f"Failed to initialize Google OAuth for MCP: {e}")
        return None


_google_auth = _build_google_auth()


# ---------------------------------------------------------------------------
# MCP instance
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "Potatoes Kitchen",
    instructions=(
        "You are a kitchen assistant for the Potatoes family app. "
        "Use these tools to manage recipes, meal plans, and grocery lists."
    ),
    auth=_google_auth,
)


# ---------------------------------------------------------------------------
# Bearer token middleware — fallback when Google OAuth is not available
# ---------------------------------------------------------------------------

class MCPAuthMiddleware:
    """ASGI middleware that rejects requests without a valid bearer token."""

    def __init__(self, app: ASGIApp, token: str):
        self.app = app
        self.token = token

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode()
            provided = auth_header.removeprefix("Bearer ").strip()
            if not provided or not secrets_mod.compare_digest(provided, self.token):
                resp = JSONResponse(status_code=401, content={"error": "Unauthorized"})
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
    """Create the MCP ASGI app with auth. Returns (asgi_app, mcp_app) or None.

    Auth strategy:
    - If Google OAuth is configured: FastMCP handles OAuth internally (for Claude.ai)
    - Else if MCP_AUTH_TOKEN is set: Bearer token middleware (for Claude Code)
    - Else: MCP server is disabled
    """
    if not settings.mcp_user_email:
        logger.info("MCP server disabled (MCP_USER_EMAIL required)")
        return None

    # Need at least one auth method (Google OAuth or bearer token)
    has_google_auth = _google_auth is not None
    has_bearer_auth = bool(settings.mcp_auth_token)

    if not has_google_auth and not has_bearer_auth:
        logger.info("MCP server disabled (need GOOGLE_CLIENT_ID or MCP_AUTH_TOKEN)")
        return None

    mcp_app = mcp.http_app(path="/")

    if has_google_auth:
        # Google OAuth is handled by FastMCP internally — no extra middleware needed
        logger.info(f"MCP server enabled with Google OAuth for user {settings.mcp_user_email}")
        return mcp_app, mcp_app
    else:
        # Fall back to bearer token auth
        authed_app = MCPAuthMiddleware(mcp_app, settings.mcp_auth_token)
        logger.info(f"MCP server enabled with bearer token for user {settings.mcp_user_email}")
        return authed_app, mcp_app
