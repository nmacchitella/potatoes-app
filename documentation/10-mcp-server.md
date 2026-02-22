# MCP Server

The Potatoes MCP server exposes the app's functionality to Claude and other MCP-compatible AI assistants via the Model Context Protocol over streamable HTTP.

## Architecture

```
Claude ──(Streamable HTTP)──► MCP Server ──(REST API)──► Potatoes Backend
                               :8001                      :8000
```

The MCP server is a stateless Python service that translates MCP tool calls into REST API requests against the Potatoes backend. It authenticates using a pre-generated long-lived JWT.

**Stack:** Python 3.11, `mcp` SDK, `httpx`, Uvicorn

## Available Tools

### Recipes

| Tool | Description |
|------|-------------|
| `search_recipes` | Search recipes by text, tags, difficulty, or collection. Returns paginated results. |
| `get_recipe` | Get full recipe details (ingredients, instructions, tags) with optional scaling. |
| `create_recipe` | Create a new recipe with ingredients and step-by-step instructions. |
| `update_recipe` | Update any fields on an existing recipe. |
| `delete_recipe` | Soft-delete a recipe. |
| `import_recipe` | Import a recipe from a website URL or YouTube video. Uses AI parsing. |
| `discover_recipes` | Browse the public recipe feed from other users. |

### Meal Plans

| Tool | Description |
|------|-------------|
| `get_meal_plan` | Get all meals for a date range, optionally filtered by calendar. |
| `add_to_meal_plan` | Add a recipe or custom meal to a calendar on a specific date/meal slot. |
| `update_meal` | Change the date, meal type, servings, or notes on a planned meal. |
| `remove_from_meal_plan` | Remove a meal from the plan. |

### Grocery Lists

| Tool | Description |
|------|-------------|
| `get_grocery_list` | Get a grocery list with all items grouped by category. |
| `generate_grocery_list` | Auto-generate a grocery list from meal plan entries in a date range. |
| `add_grocery_item` | Manually add an item to a grocery list with quantity, unit, and category. |

### Search

| Tool | Description |
|------|-------------|
| `search` | Full-text search across recipes, tags, collections, users, and ingredients. |

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POTATOES_API_URL` | Backend URL (no trailing slash) | `http://localhost:8000` |
| `POTATOES_API_TOKEN` | Long-lived JWT service token | — |
| `MCP_HOST` | Server bind address | `0.0.0.0` |
| `MCP_PORT` | Server port | `8001` |

## Setup

### 1. Generate a service token

The MCP server authenticates as a specific user. Generate a long-lived JWT:

```bash
cd mcp-server
pip install python-jose[cryptography]
python generate_token.py --secret-key YOUR_SECRET_KEY --email your@email.com
```

This creates a 10-year JWT signed with the backend's secret key.

### 2. Local development

Set the token and start all services:

```bash
export MCP_SERVICE_TOKEN=<token>
docker compose up
```

The MCP server runs at `http://localhost:8001`. The MCP endpoint is at `http://localhost:8001/mcp`.

### 3. Connect to Claude

The project `.mcp.json` is pre-configured for local development:

```json
{
  "mcpServers": {
    "potatoes": {
      "type": "streamable-http",
      "url": "http://localhost:8001/mcp"
    }
  }
}
```

For Claude Desktop or other clients, point to the same URL (local) or the production URL after deployment.

## Deployment

### Fly.io

The MCP server deploys as a separate Fly.io app (`potatoes-mcp`):

```bash
cd mcp-server
fly launch              # first time: creates the app
fly secrets set POTATOES_API_TOKEN=<token>
fly deploy
```

Production URL: `https://potatoes-mcp.fly.dev/mcp`

Configuration is in `mcp-server/fly.toml` — 256MB RAM, shared CPU, auto-stop when idle.

### CI/CD

The `deploy.yml` GitHub Actions workflow includes a `deploy-mcp` job that deploys on every push to `main`, in parallel with the backend and frontend.

## Project Structure

```
mcp-server/
├── server.py           # MCP server + tool definitions
├── api_client.py       # Async HTTP client for backend API
├── generate_token.py   # Service token generator
├── requirements.txt    # Python dependencies
├── Dockerfile          # Production container
├── fly.toml            # Fly.io config
└── .env.example        # Environment template
```

## Tool Details

### search_recipes

```
query        (str)  — Text to search in title/description
tag_ids      (str)  — Comma-separated tag IDs
difficulty   (str)  — easy, medium, hard
collection_id (str) — Filter by collection
page         (int)  — Page number (default 1)
page_size    (int)  — Results per page (default 20, max 100)
```

### get_recipe

```
recipe_id    (str)   — Recipe ID
scale        (float) — Scale factor (e.g., 2.0 to double)
```

### create_recipe

```
title               (str)   — Recipe title (required)
description         (str)   — Short description
ingredients         (str)   — JSON array: [{name, quantity, unit, preparation, is_optional, ingredient_group}]
instructions        (str)   — JSON array: [{step_number, instruction_text, instruction_group}]
prep_time_minutes   (int)   — Prep time
cook_time_minutes   (int)   — Cook time
yield_quantity      (float) — Servings count
yield_unit          (str)   — "servings", "pieces", etc.
difficulty          (str)   — easy, medium, hard
privacy_level       (str)   — public or private
tag_ids             (str)   — Comma-separated tag IDs
status              (str)   — draft or published
```

### import_recipe

```
url          (str) — Website or YouTube URL to import from
```

Returns a preview of parsed recipes. Use `create_recipe` to save.

### get_meal_plan

```
start_date   (str) — YYYY-MM-DD
end_date     (str) — YYYY-MM-DD
calendar_ids (str) — Comma-separated calendar IDs (optional)
```

### add_to_meal_plan

```
planned_date (str)   — YYYY-MM-DD (required)
meal_type    (str)   — breakfast, lunch, dinner, snack (required)
calendar_id  (str)   — Calendar ID (required)
recipe_id    (str)   — Recipe ID (or use custom_title)
custom_title (str)   — Custom meal name
servings     (float) — Default 4
notes        (str)   — Optional notes
```

### generate_grocery_list

```
start_date   (str)  — YYYY-MM-DD (required)
end_date     (str)  — YYYY-MM-DD (required)
list_id      (str)  — Target list (default list if empty)
merge        (bool) — Merge with existing items (default true)
calendar_ids (str)  — Comma-separated calendar IDs
```

### search

```
query        (str) — Search text (required)
category     (str) — Limit to: recipes, tags, collections, users, ingredients
page         (int) — Page number
page_size    (int) — Results per page
```
