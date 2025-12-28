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

**Response (201):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "is_verified": false
}
```

### Login

Authenticate with email and password.

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

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "xyz789...",
  "token_type": "bearer",
  "expires_in": 900
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
  "username": "@johndoe",
  "bio": "Food lover",
  "is_public": true,
  "is_verified": true,
  "is_admin": false
}
```

### Update Profile

```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John D.",
  "username": "johnd",
  "bio": "Updated bio",
  "is_public": true
}
```

### Forgot Password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "password": "newpassword123"
}
```

### Verify Email

```http
GET /api/auth/verify-email?token=verification-token
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

### List Recipes

```http
GET /api/recipes?skip=0&limit=20&status=published
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| skip | int | Pagination offset |
| limit | int | Items per page (max 100) |
| status | string | Filter by status (draft/published) |

### Get Recipe

```http
GET /api/recipes/{recipe_id}
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
    },
    {
      "name": "Guanciale",
      "quantity": 200,
      "unit": "g",
      "sort_order": 1
    }
  ],
  "instructions": [
    {
      "step_number": 1,
      "instruction_text": "Boil water and cook pasta"
    },
    {
      "step_number": 2,
      "instruction_text": "Cook guanciale until crispy"
    }
  ],
  "tags": ["Italian", "Pasta"]
}
```

### Update Recipe

```http
PUT /api/recipes/{recipe_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  ...
}
```

### Delete Recipe

```http
DELETE /api/recipes/{recipe_id}
Authorization: Bearer <token>
```

### Fork Recipe

Clone another user's recipe to your account.

```http
POST /api/recipes/{recipe_id}/fork
Authorization: Bearer <token>
```

---

## Collection Endpoints

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

---

## Meal Plan Endpoints

### Get Meal Plans

```http
GET /api/meal-plans?start_date=2024-01-01&end_date=2024-01-07
Authorization: Bearer <token>
```

### Create Meal Plan

```http
POST /api/meal-plans
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipe_id": "uuid",
  "planned_date": "2024-01-15",
  "meal_type": "dinner",
  "servings": 4
}
```

### Update Meal Plan

```http
PUT /api/meal-plans/{meal_plan_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "planned_date": "2024-01-16",
  "meal_type": "lunch"
}
```

### Delete Meal Plan

```http
DELETE /api/meal-plans/{meal_plan_id}
Authorization: Bearer <token>
```

---

## Social Endpoints

### Follow User

```http
POST /api/social/follow/{user_id}
Authorization: Bearer <token>
```

### Unfollow User

```http
DELETE /api/social/follow/{user_id}
Authorization: Bearer <token>
```

### Accept Follow Request

```http
POST /api/social/follow-requests/{follow_id}/accept
Authorization: Bearer <token>
```

### Get Followers

```http
GET /api/social/followers
Authorization: Bearer <token>
```

### Get Following

```http
GET /api/social/following
Authorization: Bearer <token>
```

### Get User Profile

```http
GET /api/social/users/{username}
Authorization: Bearer <token> (optional)
```

---

## Search Endpoints

### Search Recipes

```http
GET /api/search/recipes?q=pasta&tags=Italian&difficulty=easy
Authorization: Bearer <token> (optional)
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query |
| tags | string | Comma-separated tag names |
| difficulty | string | easy, medium, hard |
| author_id | string | Filter by author |

### Search Users

```http
GET /api/search/users?q=john
Authorization: Bearer <token>
```

---

## Notification Endpoints

### Get Notifications

```http
GET /api/notifications?unread_only=true
Authorization: Bearer <token>
```

### Mark as Read

```http
PUT /api/notifications/{notification_id}/read
Authorization: Bearer <token>
```

### Mark All as Read

```http
PUT /api/notifications/read-all
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
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 422 | Unprocessable Entity (validation error) |
| 500 | Internal Server Error |
