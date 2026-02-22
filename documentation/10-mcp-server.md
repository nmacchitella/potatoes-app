# MCP Server

The Potatoes backend embeds an MCP (Model Context Protocol) server at `/mcp`, enabling Claude and other MCP-compatible AI assistants to manage recipes, meal plans, and grocery lists.

## Architecture

```
Claude ──(Streamable HTTP)──► /mcp (auth middleware) ──► MCP tools ──► /api/* (same process)
```

The MCP server is mounted directly on the FastAPI app. Tools call the backend's own REST API internally via httpx (localhost), reusing all existing validation and business logic. No separate service needed.

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `MCP_AUTH_TOKEN` | Bearer token clients must send to access `/mcp` | Yes (to enable) |
| `MCP_USER_EMAIL` | Email of the user the MCP acts on behalf of | Yes (to enable) |

Both must be set to enable the MCP server. If either is missing, the MCP endpoint is disabled and the backend runs normally.

## Setup

### 1. Set environment variables

In your `.env` file or Fly.io secrets:

```bash
MCP_AUTH_TOKEN=your-secret-token-here
MCP_USER_EMAIL=your@email.com
```

Generate a secure token:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Deploy

The MCP server deploys with the backend — no separate deployment step. Just push to `main` and the existing CI/CD pipeline handles it.

For Fly.io, set the secrets:
```bash
fly secrets set MCP_AUTH_TOKEN=your-token MCP_USER_EMAIL=your@email.com
```

### 3. Connect Claude

Add to your Claude MCP settings:

```json
{
  "mcpServers": {
    "potatoes": {
      "type": "streamable-http",
      "url": "https://potatoes-backend.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer your-mcp-auth-token"
      }
    }
  }
}
```

For local development:
```json
{
  "url": "http://localhost:8000/mcp"
}
```

## Authentication

The MCP endpoint is protected by a bearer token (`MCP_AUTH_TOKEN`). Clients must send:

```
Authorization: Bearer <MCP_AUTH_TOKEN>
```

Internally, the MCP tools authenticate with the backend API using a JWT generated for the `MCP_USER_EMAIL` user. This JWT is created at startup using the backend's `SECRET_KEY`.

## Available Tools

### Recipes (7 tools)

| Tool | Description |
|------|-------------|
| `search_recipes` | Search recipes by text, tags, difficulty, or collection |
| `get_recipe` | Get full recipe details with optional ingredient scaling |
| `create_recipe` | Create a new recipe with ingredients and instructions |
| `update_recipe` | Update any fields on an existing recipe |
| `delete_recipe` | Soft-delete a recipe |
| `import_recipe` | Import a recipe from a website URL or YouTube video |
| `discover_recipes` | Browse the public recipe feed |

### Meal Plans (4 tools)

| Tool | Description |
|------|-------------|
| `get_meal_plan` | Get meals for a date range, optionally filtered by calendar |
| `add_to_meal_plan` | Add a recipe or custom meal to a calendar |
| `update_meal` | Change date, meal type, servings, or notes |
| `remove_from_meal_plan` | Remove a meal from the plan |

### Grocery Lists (3 tools)

| Tool | Description |
|------|-------------|
| `get_grocery_list` | Get a grocery list with items grouped by category |
| `generate_grocery_list` | Auto-generate from meal plan date range |
| `add_grocery_item` | Add a manual item with quantity, unit, and category |

### Search (1 tool)

| Tool | Description |
|------|-------------|
| `search` | Full-text search across recipes, tags, collections, users, ingredients |

## Tool Parameter Reference

### search_recipes

| Param | Type | Description |
|-------|------|-------------|
| `query` | str | Text to search in title/description |
| `tag_ids` | str | Comma-separated tag IDs |
| `difficulty` | str | easy, medium, hard |
| `collection_id` | str | Filter by collection |
| `page` | int | Page number (default 1) |
| `page_size` | int | Results per page (default 20, max 100) |

### get_recipe

| Param | Type | Description |
|-------|------|-------------|
| `recipe_id` | str | Recipe ID |
| `scale` | float | Scale factor (e.g., 2.0 to double) |

### create_recipe

| Param | Type | Description |
|-------|------|-------------|
| `title` | str | Recipe title (required) |
| `description` | str | Short description |
| `ingredients` | str | JSON array: `[{name, quantity, unit, preparation, is_optional, ingredient_group}]` |
| `instructions` | str | JSON array: `[{step_number, instruction_text, instruction_group}]` |
| `prep_time_minutes` | int | Prep time |
| `cook_time_minutes` | int | Cook time |
| `yield_quantity` | float | Servings count |
| `yield_unit` | str | "servings", "pieces", etc. |
| `difficulty` | str | easy, medium, hard |
| `privacy_level` | str | public or private |
| `tag_ids` | str | Comma-separated tag IDs |
| `status` | str | draft or published |

### import_recipe

| Param | Type | Description |
|-------|------|-------------|
| `url` | str | Website or YouTube URL to import from |

### get_meal_plan

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | str | YYYY-MM-DD |
| `end_date` | str | YYYY-MM-DD |
| `calendar_ids` | str | Comma-separated calendar IDs (optional) |

### add_to_meal_plan

| Param | Type | Description |
|-------|------|-------------|
| `planned_date` | str | YYYY-MM-DD (required) |
| `meal_type` | str | breakfast, lunch, dinner, snack (required) |
| `calendar_id` | str | Calendar ID (required) |
| `recipe_id` | str | Recipe ID (or use custom_title) |
| `custom_title` | str | Custom meal name |
| `servings` | float | Default 4 |
| `notes` | str | Optional notes |

### generate_grocery_list

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | str | YYYY-MM-DD (required) |
| `end_date` | str | YYYY-MM-DD (required) |
| `list_id` | str | Target list (default list if empty) |
| `merge` | bool | Merge with existing items (default true) |
| `calendar_ids` | str | Comma-separated calendar IDs |

### search

| Param | Type | Description |
|-------|------|-------------|
| `query` | str | Search text (required) |
| `category` | str | Limit to: recipes, tags, collections, users, ingredients |
| `page` | int | Page number |
| `page_size` | int | Results per page |

## Implementation

The MCP server lives in `backend/mcp_server.py`. It uses:

- **fastmcp** — Python MCP SDK with FastAPI mounting support
- **httpx** — Async HTTP client for internal API calls
- **ASGI auth middleware** — Validates bearer token on the `/mcp` endpoint

The server is conditionally mounted in `main.py` — only when both `MCP_AUTH_TOKEN` and `MCP_USER_EMAIL` are set.
