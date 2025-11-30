# FamilyKitchen Implementation Plan

## Current State Summary

### Already Implemented
- **Authentication**: Registration, login, logout, JWT tokens, refresh tokens
- **Google OAuth**: Full OAuth flow with callback handling
- **Email Verification**: Verification emails, resend functionality
- **Password Reset**: Forgot password, reset with token
- **User Profiles**: Username, bio, avatar, privacy settings
- **User Settings**: Basic settings management
- **Database Models**: User, RefreshToken, VerificationToken, Notification, UserFollow

### Partially Implemented (Models Exist, No Endpoints)
- **UserFollow**: Model defined with status (pending/confirmed/declined)
- **Notification**: Model with rich metadata support

### Not Implemented
- **Recipes**: No models, endpoints, or UI
- **Collections**: No models, endpoints, or UI
- **Meal Planning**: Deferred (Phase 2)
- **Shopping Lists**: Deferred (Phase 2)

---

## Phase 1: Core Recipe & Social Features

Following the PRD Section 6 Implementation Plan, focusing on items 1-4.

---

## 1. Recipe Management (Priority: P0)

### 1.1 Backend - Database Models

**File**: `backend/models.py`

```python
# New models to add:

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    yield_quantity = Column(Float, default=4)
    yield_unit = Column(String(50), default="servings")
    prep_time_minutes = Column(Integer, nullable=True)
    cook_time_minutes = Column(Integer, nullable=True)
    difficulty = Column(String(20), nullable=True)  # easy, medium, hard
    privacy_level = Column(String(20), default="private")  # private, public
    source_url = Column(String(500), nullable=True)
    source_name = Column(String(200), nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    status = Column(String(20), default="published")  # draft, published
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    author = relationship("User", back_populates="recipes")
    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")
    instructions = relationship("RecipeInstruction", back_populates="recipe", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary="recipe_tags", back_populates="recipes")
    collections = relationship("Collection", secondary="collection_recipes", back_populates="recipes")

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    recipe_id = Column(String, ForeignKey("recipes.id"), nullable=False)
    sort_order = Column(Integer, nullable=False)
    quantity = Column(Float, nullable=True)
    quantity_max = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    name = Column(String(200), nullable=False)
    preparation = Column(String(200), nullable=True)
    is_optional = Column(Boolean, default=False)
    is_staple = Column(Boolean, default=False)
    ingredient_group = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    recipe = relationship("Recipe", back_populates="ingredients")

class RecipeInstruction(Base):
    __tablename__ = "recipe_instructions"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    recipe_id = Column(String, ForeignKey("recipes.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    instruction_text = Column(Text, nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    instruction_group = Column(String(100), nullable=True)

    recipe = relationship("Recipe", back_populates="instructions")

class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(100), nullable=False, unique=True)
    category = Column(String(50), nullable=True)  # cuisine, diet, meal_type, technique, season, custom
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    recipes = relationship("Recipe", secondary="recipe_tags", back_populates="tags")

class RecipeTag(Base):
    __tablename__ = "recipe_tags"

    recipe_id = Column(String, ForeignKey("recipes.id"), primary_key=True)
    tag_id = Column(String, ForeignKey("tags.id"), primary_key=True)

class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    is_default = Column(Boolean, default=False)
    privacy_level = Column(String(20), default="private")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="collections")
    recipes = relationship("Recipe", secondary="collection_recipes", back_populates="collections")

class CollectionRecipe(Base):
    __tablename__ = "collection_recipes"

    collection_id = Column(String, ForeignKey("collections.id"), primary_key=True)
    recipe_id = Column(String, ForeignKey("recipes.id"), primary_key=True)
    sort_order = Column(Integer, default=0)
    added_at = Column(DateTime, default=datetime.utcnow)
```

### 1.2 Backend - API Endpoints

**File**: `backend/routers/recipe_router.py`

| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/api/recipes` | GET | List user's recipes (search, filter, pagination) | P0 |
| `/api/recipes` | POST | Create new recipe | P0 |
| `/api/recipes/{id}` | GET | Get single recipe (with scaling) | P0 |
| `/api/recipes/{id}` | PUT | Update recipe | P0 |
| `/api/recipes/{id}` | DELETE | Soft delete recipe | P0 |
| `/api/recipes/{id}/clone` | POST | Clone recipe to user's collection | P1 |
| `/api/recipes/parse-ingredients` | POST | Parse ingredient text | P0 |
| `/api/recipes/import` | POST | Import from URL (deferred) | P2 |

**File**: `backend/routers/collection_router.py`

| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/api/collections` | GET | List user's collections | P0 |
| `/api/collections` | POST | Create new collection | P0 |
| `/api/collections/{id}` | GET | Get collection with recipes | P0 |
| `/api/collections/{id}` | PUT | Update collection | P0 |
| `/api/collections/{id}` | DELETE | Delete collection | P0 |
| `/api/collections/{id}/recipes` | POST | Add recipe to collection | P0 |
| `/api/collections/{id}/recipes/{recipe_id}` | DELETE | Remove recipe | P0 |

**File**: `backend/routers/tag_router.py`

| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/api/tags` | GET | List all tags (system + user's custom) | P0 |
| `/api/tags` | POST | Create custom tag | P1 |

### 1.3 Frontend - Pages & Components

**Pages to Create**:

| Page | Route | Description |
|------|-------|-------------|
| Recipe List | `/recipes` | Grid of user's recipes with search/filter |
| Recipe Detail | `/recipes/[id]` | View recipe with scaling |
| Recipe Create | `/recipes/new` | Multi-step wizard |
| Recipe Edit | `/recipes/[id]/edit` | Edit existing recipe |
| Collections | `/collections` | List user's collections |
| Collection Detail | `/collections/[id]` | View collection's recipes |

**Components to Create**:

```
frontend/src/components/
├── recipes/
│   ├── RecipeCard.tsx          # Recipe preview card
│   ├── RecipeList.tsx          # Grid/list view of recipes
│   ├── RecipeDetail.tsx        # Full recipe view
│   ├── RecipeForm/
│   │   ├── BasicInfoStep.tsx   # Title, description, times
│   │   ├── IngredientsStep.tsx # Ingredient list editor
│   │   ├── InstructionsStep.tsx# Instructions editor
│   │   └── OrganizationStep.tsx# Tags, collections
│   ├── IngredientParser.tsx    # Paste & parse modal
│   ├── ServingScaler.tsx       # Adjust servings
│   └── RecipeSearch.tsx        # Search/filter bar
├── collections/
│   ├── CollectionCard.tsx
│   ├── CollectionList.tsx
│   └── CollectionForm.tsx
└── common/
    ├── TagSelector.tsx
    └── DragDropList.tsx
```

### 1.4 Ingredient Parser (P0)

Simple regex-based parser for MVP:

```python
# backend/services/ingredient_parser.py

import re
from typing import List, Dict, Optional

UNITS = {
    'cup': ['cup', 'cups', 'c'],
    'tablespoon': ['tablespoon', 'tablespoons', 'tbsp', 'tbs', 'tb'],
    'teaspoon': ['teaspoon', 'teaspoons', 'tsp', 'ts'],
    'ounce': ['ounce', 'ounces', 'oz'],
    'pound': ['pound', 'pounds', 'lb', 'lbs'],
    'gram': ['gram', 'grams', 'g'],
    'kilogram': ['kilogram', 'kilograms', 'kg'],
    'milliliter': ['milliliter', 'milliliters', 'ml'],
    'liter': ['liter', 'liters', 'l'],
    'pinch': ['pinch', 'pinches'],
    'clove': ['clove', 'cloves'],
    'can': ['can', 'cans'],
    'package': ['package', 'packages', 'pkg'],
}

FRACTIONS = {
    '½': 0.5, '⅓': 0.333, '⅔': 0.667,
    '¼': 0.25, '¾': 0.75, '⅛': 0.125,
    '1/2': 0.5, '1/3': 0.333, '2/3': 0.667,
    '1/4': 0.25, '3/4': 0.75, '1/8': 0.125,
}

def parse_ingredient_line(line: str) -> Dict:
    """Parse a single ingredient line into structured data."""
    # Implementation handles:
    # - "1 cup flour"
    # - "2 tablespoons olive oil"
    # - "1/2 tsp salt"
    # - "3 large eggs"
    # - "Salt to taste"
    # - "1-2 cups milk"
    pass

def parse_ingredients_block(text: str) -> List[Dict]:
    """Parse multiple lines of ingredients."""
    lines = text.strip().split('\n')
    return [parse_ingredient_line(line) for line in lines if line.strip()]
```

---

## 2. User Settings Enhancement (Priority: P0)

### 2.1 Backend Updates

**Add to User model in `backend/models.py`**:
- Already has: `is_public`, `bio`, `username`, `profile_image_url`

**Add UserSettings model** (if not exists):
```python
class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    preferred_unit_system = Column(String(20), default="imperial")  # imperial, metric
    theme = Column(String(20), default="system")  # light, dark, system
    timezone = Column(String(50), default="America/New_York")
    email_notifications = Column(JSON, default={})
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### 2.2 Frontend Updates

**Enhance `/settings` page**:
- Profile section (already partially done)
- Preferences section (unit system, theme)
- Notifications section
- Account section (change password, delete account)

---

## 3. Follow System (Priority: P1)

### 3.1 Backend - API Endpoints

**File**: `backend/routers/social_router.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/{username}` | GET | Get public profile |
| `/api/users/{username}/recipes` | GET | Get user's public recipes |
| `/api/users/{user_id}/follow` | POST | Follow user |
| `/api/users/{user_id}/follow` | DELETE | Unfollow user |
| `/api/users/followers` | GET | List my followers |
| `/api/users/following` | GET | List who I follow |
| `/api/feed` | GET | Get recipes from followed users |
| `/api/users/search` | GET | Search users |

### 3.2 Frontend - Pages & Components

**Pages**:
- `/profile/[username]` - Public profile page
- `/feed` - Social feed of followed users' recipes
- `/settings/social` - Manage followers/following

**Components**:
```
frontend/src/components/
├── social/
│   ├── UserCard.tsx
│   ├── UserList.tsx
│   ├── FollowButton.tsx
│   ├── UserSearch.tsx
│   └── RecipeFeed.tsx
```

---

## 4. Notifications (Priority: P2)

### 4.1 Backend - API Endpoints

**File**: `backend/routers/notification_router.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | List notifications (paginated) |
| `/api/notifications/unread-count` | GET | Get unread count |
| `/api/notifications/{id}/read` | POST | Mark as read |
| `/api/notifications/read-all` | POST | Mark all as read |

### 4.2 Frontend - Components

```
frontend/src/components/
├── notifications/
│   ├── NotificationBell.tsx    # Header icon with badge
│   ├── NotificationList.tsx    # Dropdown list
│   └── NotificationItem.tsx    # Single notification
```

---

## Implementation Order

### Sprint 1: Recipe Foundation
1. Add Recipe, RecipeIngredient, RecipeInstruction models
2. Create recipe CRUD endpoints
3. Build ingredient parser
4. Create RecipeCard, RecipeList components
5. Build recipe creation wizard (basic)
6. Recipe detail page with scaling

### Sprint 2: Collections & Tags
1. Add Collection, Tag models
2. Create collection/tag endpoints
3. Collection management UI
4. Tag selector component
5. Recipe organization step in wizard

### Sprint 3: Social Features
1. Implement follow endpoints
2. Public profile pages
3. Recipe feed
4. User search
5. Follow/unfollow UI

### Sprint 4: Polish & Notifications
1. Notification endpoints
2. Notification UI components
3. Settings page enhancements
4. Search improvements
5. UI polish and mobile optimization

---

## Database Migration Strategy

Since using SQLite for development:

```bash
# After adding models, recreate database
cd backend
rm potatoes.db  # Only in development!
python -c "from database import engine, Base; from models import *; Base.metadata.create_all(bind=engine)"
```

For production, implement Alembic migrations.

---

## Seeding Data

Create a seed script for:
1. System tags (cuisines, diets, meal types)
2. Sample recipes for testing
3. Default collections ("Favorites", "Want to Try")

**File**: `backend/seed.py`

---

## Testing Strategy

### Backend
- Unit tests for ingredient parser
- Integration tests for recipe CRUD
- API endpoint tests

### Frontend
- Component tests with React Testing Library
- E2E tests with Playwright for critical flows

---

## Future Phases (Deferred)

### Phase 2: Family & Planning
- Family creation and management
- Meal plan calendar
- Recipe assignment to meals
- Meal templates

### Phase 3: Shopping Lists
- Shopping list generation from meal plans
- Ingredient aggregation
- Real-time sync (WebSockets)
- Store management

---

## Quick Start Commands

```bash
# Start backend
cd backend
source venv/bin/activate
uvicorn main:app --reload

# Start frontend
cd frontend
npm run dev

# Both services
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
```
