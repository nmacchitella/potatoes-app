# API Reference

Complete API endpoint documentation for Potatoes backend.

## Base URL

- **Local:** `http://localhost:8000/api`
- **Production:** `https://potatoes-backend.fly.dev/api`

## Authentication

Most endpoints require authentication via Bearer token:

```
Authorization: Bearer <access_token>
```

## Interactive Documentation

FastAPI provides auto-generated docs:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## Auth Endpoints

Prefix: `/api/auth`

### Register

Create a new user account.

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "is_verified": false
}
```

### Login (Form)

Authenticate with OAuth2 form data (for Swagger UI compatibility).

```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=securepassword123
```

### Login (JSON)

Authenticate with JSON payload.

```http
POST /api/auth/login-json
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc123...",
  "token_type": "bearer",
  "expires_in": 900
}
```

### Refresh Token

Get a new access token using refresh token.

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "abc123..."
}
```

### Logout

Revoke refresh token.

```http
POST /api/auth/logout
Authorization: Bearer <token>
Content-Type: application/json

{
  "refresh_token": "abc123..."
}
```

### Logout All Devices

Revoke all refresh tokens for the user.

```http
POST /api/auth/logout-all
Authorization: Bearer <token>
```

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "bio": "Food lover",
  "is_public": true,
  "is_verified": true,
  "is_admin": false
}
```

### Update Current User

```http
PUT /api/auth/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John D.",
  "email": "newemail@example.com"
}
```

### Change Password

```http
PUT /api/auth/me/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "oldpassword",
  "new_password": "newpassword123"
}
```

### Delete Account

```http
DELETE /api/auth/me
Authorization: Bearer <token>
```

### Get Profile

```http
GET /api/auth/profile
Authorization: Bearer <token>
```

### Update Profile

```http
PATCH /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John D.",
  "bio": "Updated bio",
  "is_public": true
}
```

### Get Settings

```http
GET /api/auth/settings
Authorization: Bearer <token>
```

### Update Settings

```http
PATCH /api/auth/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "preferred_unit_system": "metric",
  "default_servings": 4,
  "email_new_follower": true,
  "email_follow_request": true,
  "email_recipe_saved": false
}
```

### Verify Email

```http
POST /api/auth/verify-email?token=verification-token
```

### Resend Verification Email

```http
POST /api/auth/resend-verification?email=user@example.com
```

### Forgot Password

```http
POST /api/auth/forgot-password?email=user@example.com
```

### Reset Password

```http
POST /api/auth/reset-password?token=reset-token&new_password=newpassword123
```

### Google OAuth

```http
GET /api/auth/google/login
```

**Response (200):**
```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/..."
}
```

---

## Recipe Endpoints

Prefix: `/api/recipes`

### List My Recipes

```http
GET /api/recipes?page=1&page_size=20
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | int | Page number (default: 1) |
| page_size | int | Items per page (max 100) |
| search | string | Search in title and description |
| tag_ids | string | Comma-separated tag IDs |
| collection_id | string | Filter by collection |
| difficulty | string | Filter by difficulty |
| status | string | Filter by status (draft/published) |

### Get Recipe

```http
GET /api/recipes/{recipe_id}?scale=2.0
Authorization: Bearer <token> (optional for public recipes)
```

### Create Recipe

```http
POST /api/recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Spaghetti Carbonara",
  "description": "Classic Italian pasta",
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "difficulty": "medium",
  "privacy_level": "public",
  "yield_quantity": 4,
  "yield_unit": "servings",
  "ingredients": [
    {
      "name": "Spaghetti",
      "quantity": 400,
      "unit": "g",
      "sort_order": 0
    }
  ],
  "instructions": [
    {
      "step_number": 1,
      "instruction_text": "Boil water and cook pasta"
    }
  ],
  "tag_ids": ["tag-uuid-1", "tag-uuid-2"],
  "collection_ids": ["collection-uuid"]
}
```

### Update Recipe

```http
PUT /api/recipes/{recipe_id}
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Recipe

```http
DELETE /api/recipes/{recipe_id}
Authorization: Bearer <token>
```

### Clone Recipe

Clone another user's public recipe to your account.

```http
POST /api/recipes/{recipe_id}/clone
Authorization: Bearer <token>
```

### Upload Recipe Image

```http
POST /api/recipes/{recipe_id}/upload-image
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image file>
```

### Get Recipe Collections

Get collections containing a specific recipe.

```http
GET /api/recipes/{recipe_id}/collections
Authorization: Bearer <token>
```

### Parse Ingredients

Parse ingredient text into structured data.

```http
POST /api/recipes/parse-ingredients
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "2 cups flour\n1 tsp salt\n3 large eggs"
}
```

### Import Recipe from URL

Import recipe from a website or YouTube video.

```http
POST /api/recipes/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/recipe"
}
```

### Parse Recipe Text

Parse raw recipe text using AI.

```http
POST /api/recipes/parse-text
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Spaghetti Carbonara\n\nIngredients:\n400g spaghetti..."
}
```

### Public Feed

Get public recipes for discovery.

```http
GET /api/recipes/public/feed?page=1&page_size=20
Authorization: Bearer <token> (optional)
```

---

## Collection Endpoints

Prefix: `/api/collections`

### List Collections

```http
GET /api/collections
Authorization: Bearer <token>
```

### Create Collection

```http
POST /api/collections
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Weeknight Dinners",
  "description": "Quick meals for busy days",
  "privacy_level": "public"
}
```

### Get Collection

```http
GET /api/collections/{collection_id}
Authorization: Bearer <token>
```

### Update Collection

```http
PUT /api/collections/{collection_id}
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Collection

```http
DELETE /api/collections/{collection_id}
Authorization: Bearer <token>
```

### Add Recipe to Collection

```http
POST /api/collections/{collection_id}/recipes/{recipe_id}
Authorization: Bearer <token>
```

### Remove Recipe from Collection

```http
DELETE /api/collections/{collection_id}/recipes/{recipe_id}
Authorization: Bearer <token>
```

### List Shared Collections

Get collections shared with you.

```http
GET /api/collections/shared-with-me
Authorization: Bearer <token>
```

### Share Collection

```http
POST /api/collections/{collection_id}/shares
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "user-uuid",
  "permission": "editor"
}
```

### List Collection Shares

```http
GET /api/collections/{collection_id}/shares
Authorization: Bearer <token>
```

### Update Share Permission

```http
PUT /api/collections/{collection_id}/shares/{user_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "permission": "viewer"
}
```

### Remove Share

```http
DELETE /api/collections/{collection_id}/shares/{user_id}
Authorization: Bearer <token>
```

### Leave Shared Collection

```http
DELETE /api/collections/{collection_id}/leave
Authorization: Bearer <token>
```

---

## Meal Plan Endpoints

Prefix: `/api/meal-plan`

### Get Meal Plans

```http
GET /api/meal-plan?start=2024-01-01&end=2024-01-07
Authorization: Bearer <token>
```

### Create Meal Plan

```http
POST /api/meal-plan
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipe_id": "uuid",
  "planned_date": "2024-01-15",
  "meal_type": "dinner",
  "servings": 4,
  "notes": "Optional notes"
}
```

### Get Single Meal Plan

```http
GET /api/meal-plan/{meal_plan_id}
Authorization: Bearer <token>
```

### Update Meal Plan

```http
PATCH /api/meal-plan/{meal_plan_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "planned_date": "2024-01-16",
  "meal_type": "lunch"
}
```

### Delete Meal Plan

```http
DELETE /api/meal-plan/{meal_plan_id}
Authorization: Bearer <token>
```

### Move Meal

Move a meal to a different date/slot.

```http
POST /api/meal-plan/{meal_plan_id}/move
Authorization: Bearer <token>
Content-Type: application/json

{
  "planned_date": "2024-01-20",
  "meal_type": "dinner"
}
```

### Copy Meals

Copy meals from one date range to another.

```http
POST /api/meal-plan/copy
Authorization: Bearer <token>
Content-Type: application/json

{
  "source_start": "2024-01-01",
  "source_end": "2024-01-07",
  "target_start": "2024-01-08"
}
```

### Create Recurring Meal

```http
POST /api/meal-plan/recurring
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipe_id": "uuid",
  "day_of_week": 0,
  "meal_type": "dinner",
  "start_date": "2024-01-01",
  "end_date": "2024-03-31",
  "servings": 4
}
```

### Delete Recurring Meals

```http
DELETE /api/meal-plan/recurring/{recurrence_id}?future_only=true
Authorization: Bearer <token>
```

### Swap Two Meals

```http
POST /api/meal-plan/swap?meal_plan_id_1=uuid1&meal_plan_id_2=uuid2
Authorization: Bearer <token>
```

### Meal Plan Sharing

Share your meal plan with other users.

```http
GET /api/meal-plan/shares
GET /api/meal-plan/shared-with-me
GET /api/meal-plan/shared/{user_id}?start=...&end=...
POST /api/meal-plan/shares
PUT /api/meal-plan/shares/{user_id}
DELETE /api/meal-plan/shares/{user_id}
DELETE /api/meal-plan/shares/leave/{owner_id}
```

---

## Social Endpoints (Users)

Prefix: `/api/users`

### Search Users

```http
GET /api/users/search?q=john&limit=20
Authorization: Bearer <token>
```

### Get User Profile

```http
GET /api/users/{user_id}
Authorization: Bearer <token> (optional)
```

### Get User Recipes

```http
GET /api/users/{user_id}/recipes?page=1&page_size=20
Authorization: Bearer <token> (optional)
```

### Follow User

```http
POST /api/users/{user_id}/follow
Authorization: Bearer <token>
```

### Unfollow User

```http
DELETE /api/users/{user_id}/follow
Authorization: Bearer <token>
```

### Get My Followers

```http
GET /api/users/me/followers
Authorization: Bearer <token>
```

### Get My Following

```http
GET /api/users/me/following
Authorization: Bearer <token>
```

### Get Follow Requests

```http
GET /api/users/me/follow-requests
Authorization: Bearer <token>
```

### Accept Follow Request

```http
POST /api/users/me/follow-requests/{user_id}/accept
Authorization: Bearer <token>
```

### Decline Follow Request

```http
POST /api/users/me/follow-requests/{user_id}/decline
Authorization: Bearer <token>
```

### Get Feed

Get recipes from users you follow.

```http
GET /api/users/me/feed?page=1&page_size=20
Authorization: Bearer <token>
```

---

## Search Endpoints

Prefix: `/api/search`

### Autocomplete Search

Quick search for autocomplete suggestions across all categories.

```http
GET /api/search?q=pasta&limit=5
Authorization: Bearer <token>
```

**Response:**
```json
{
  "my_recipes": [...],
  "discover_recipes": [...],
  "tags": [...],
  "collections": [...],
  "users": [...],
  "ingredients": [...],
  "query": "pasta"
}
```

### Full Search

Full paginated search with category filtering.

```http
GET /api/search/full?q=pasta&page=1&page_size=20&category=recipes
Authorization: Bearer <token>
```

### Recipes by Ingredient

```http
GET /api/search/ingredients/{ingredient_id}/recipes?page=1&page_size=20
Authorization: Bearer <token>
```

---

## Notification Endpoints

Prefix: `/api/notifications`

### Get Notifications

```http
GET /api/notifications?unread_only=true&limit=50&offset=0
Authorization: Bearer <token>
```

### Get Unread Count

```http
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

### Mark as Read

```http
POST /api/notifications/{notification_id}/read
Authorization: Bearer <token>
```

### Mark All as Read

```http
POST /api/notifications/read-all
Authorization: Bearer <token>
```

### Delete Notification

```http
DELETE /api/notifications/{notification_id}
Authorization: Bearer <token>
```

---

## Tag Endpoints

Prefix: `/api/tags`

### List Tags

```http
GET /api/tags?category=cuisine&search=italian
Authorization: Bearer <token>
```

### Create Tag

```http
POST /api/tags
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Spicy",
  "category": "flavor"
}
```

### Get Tag

```http
GET /api/tags/{tag_id}
Authorization: Bearer <token>
```

### Delete Tag

Delete a custom tag (system tags cannot be deleted).

```http
DELETE /api/tags/{tag_id}
Authorization: Bearer <token>
```

---

## Ingredient Endpoints

Prefix: `/api/ingredients`

### List Ingredients

```http
GET /api/ingredients?search=tomato&category=vegetables&limit=50
Authorization: Bearer <token>
```

### Create Ingredient

```http
POST /api/ingredients
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Heirloom Tomatoes",
  "category": "vegetables"
}
```

### Get Ingredient

```http
GET /api/ingredients/{ingredient_id}
Authorization: Bearer <token>
```

### List Ingredient Categories

```http
GET /api/ingredients/categories
Authorization: Bearer <token>
```

### List Measurement Units

```http
GET /api/ingredients/units?search=cup&type=volume
Authorization: Bearer <token>
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "detail": "Error message here"
}
```

**Common Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful deletion) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 422 | Unprocessable Entity (validation error) |
| 500 | Internal Server Error |
