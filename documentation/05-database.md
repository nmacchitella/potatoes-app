# Database Schema

Database models and relationships for Potatoes.

## Overview

- **ORM:** SQLAlchemy 2.0
- **Database:** SQLite (development/production) or PostgreSQL
- **Migrations:** Alembic configured (auto-create on startup as fallback)

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │     Recipe      │       │   Collection    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◀──┐   │ id (PK)         │   ┌──▶│ id (PK)         │
│ email           │   │   │ author_id (FK)  │───┘   │ user_id (FK)    │───┐
│ name            │   │   │ title           │       │ name            │   │
│ hashed_password │   │   │ description     │       │ description     │   │
│ oauth_provider  │   │   │ privacy_level   │       │ privacy_level   │   │
│ is_admin        │   │   │ difficulty      │       └─────────────────┘   │
│ is_verified     │   │   │ prep_time       │              ▲              │
│ username        │   │   │ cook_time       │              │              │
│ bio             │   │   │ ...             │              │              │
│ is_public       │   │   └─────────────────┘     collection_recipes     │
└─────────────────┘   │          │                    (junction)          │
        │             │          │                         │              │
        │             │          ▼                         │              │
        │             │   ┌─────────────────┐              │              │
        │             │   │RecipeIngredient │              │              │
        │             │   ├─────────────────┤              │              │
        │             │   │ id (PK)         │              │              │
        │             │   │ recipe_id (FK)  │──────────────┘              │
        │             │   │ ingredient_id   │                             │
        │             │   │ quantity        │                             │
        │             │   │ unit            │                             │
        │             │   │ name            │                             │
        │             │   └─────────────────┘                             │
        │             │                                                   │
        │             │   ┌─────────────────┐                             │
        │             │   │RecipeInstruction│                             │
        │             │   ├─────────────────┤                             │
        │             │   │ id (PK)         │                             │
        │             │   │ recipe_id (FK)  │                             │
        │             │   │ step_number     │                             │
        │             │   │ instruction_text│                             │
        │             │   └─────────────────┘                             │
        │             │                                                   │
        ▼             │   ┌─────────────────┐                             │
┌─────────────────┐   │   │      Tag        │                             │
│  RefreshToken   │   │   ├─────────────────┤                             │
├─────────────────┤   │   │ id (PK)         │                             │
│ id (PK)         │   │   │ name            │◀── recipe_tags (junction)   │
│ token           │   │   │ category        │                             │
│ user_id (FK)    │───┘   │ is_system       │                             │
│ expires_at      │       └─────────────────┘                             │
│ revoked         │                                                       │
└─────────────────┘       ┌─────────────────┐                             │
        │                 │    MealPlan     │                             │
        │                 ├─────────────────┤                             │
        │                 │ id (PK)         │                             │
        │                 │ user_id (FK)    │─────────────────────────────┘
        │                 │ recipe_id (FK)  │
        │                 │ planned_date    │
        │                 │ meal_type       │
        │                 │ servings        │
        │                 └─────────────────┘
        │
        ▼
┌─────────────────┐       ┌─────────────────┐
│   UserFollow    │       │  Notification   │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ follower_id(FK) │       │ user_id (FK)    │
│ following_id(FK)│       │ type            │
│ status          │       │ title           │
└─────────────────┘       │ message         │
                          │ is_read         │
                          └─────────────────┘
```

## Models

### User

Core user account model.

```python
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)              # UUID
    email = Column(String, unique=True, index=True)    # Login identifier
    name = Column(String, nullable=False)              # Display name
    hashed_password = Column(String, nullable=True)    # Null for OAuth users
    oauth_provider = Column(String, nullable=True)     # 'google', etc.
    oauth_id = Column(String, nullable=True)           # Provider user ID
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)       # Email verified
    created_at = Column(DateTime, server_default=func.now())

    # Profile
    is_public = Column(Boolean, default=True)          # Public/private profile
    username = Column(String, unique=True, nullable=True)  # @handle
    bio = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
```

### RefreshToken

JWT refresh token storage for revocation.

```python
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True)
    token = Column(String, unique=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    revoked = Column(Boolean, default=False)
```

### VerificationToken

Email verification and password reset tokens.

```python
class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    type = Column(String)  # 'verify_email' or 'reset_password'
    expires_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
```

### Recipe

Recipe with full details.

```python
class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(String, primary_key=True)
    author_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    yield_quantity = Column(Float, nullable=True)
    yield_unit = Column(String(50), nullable=True)
    prep_time_minutes = Column(Integer, nullable=True)
    cook_time_minutes = Column(Integer, nullable=True)
    difficulty = Column(String(20), nullable=True)     # easy, medium, hard
    privacy_level = Column(String(20), default="public")
    source_url = Column(String(500), nullable=True)
    source_name = Column(String(200), nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    video_start_seconds = Column(Integer, nullable=True)  # YouTube timestamp
    status = Column(String(20), default="published")   # draft, published
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)       # Soft delete

    # Fork tracking
    forked_from_recipe_id = Column(String, ForeignKey("recipes.id"))
    forked_from_user_id = Column(String, ForeignKey("users.id"))
```

### RecipeIngredient

Individual ingredient in a recipe.

```python
class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(String, primary_key=True)
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete='CASCADE'))
    ingredient_id = Column(String, ForeignKey("ingredients.id"))  # Master link
    sort_order = Column(Integer, default=0)
    quantity = Column(Float, nullable=True)
    quantity_max = Column(Float, nullable=True)        # For ranges "1-2 cups"
    unit = Column(String(50), nullable=True)
    name = Column(String(200), nullable=False)         # Display name
    preparation = Column(String(200), nullable=True)   # "diced", "minced"
    is_optional = Column(Boolean, default=False)
    is_staple = Column(Boolean, default=False)
    ingredient_group = Column(String(100), nullable=True)  # "For the sauce"
    notes = Column(Text, nullable=True)
```

### RecipeInstruction

Step-by-step instructions.

```python
class RecipeInstruction(Base):
    __tablename__ = "recipe_instructions"

    id = Column(String, primary_key=True)
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete='CASCADE'))
    step_number = Column(Integer, nullable=False)
    instruction_text = Column(Text, nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    instruction_group = Column(String(100), nullable=True)  # "Make the dough"
```

### Tag

Recipe categorization tags.

```python
class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True)
    name = Column(String(100), unique=True)
    category = Column(String(50), nullable=True)  # cuisine, diet, meal_type, etc.
    is_system = Column(Boolean, default=False)    # System vs user-created
```

### Ingredient

Master ingredients list for autocomplete and linking.

```python
class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(String, primary_key=True)
    name = Column(String(200), nullable=False)           # Display name
    normalized_name = Column(String(200), index=True)    # Lowercase for matching
    category = Column(String(50), nullable=True)         # produce, meat, dairy, etc.
    is_system = Column(Boolean, default=False)
    user_id = Column(String, ForeignKey("users.id"))     # NULL = system/global
    created_at = Column(DateTime, server_default=func.now())
```

### MeasurementUnit

Master measurement units for autocomplete.

```python
class MeasurementUnit(Base):
    __tablename__ = "measurement_units"

    id = Column(String, primary_key=True)
    name = Column(String(50), unique=True)        # "cup", "tablespoon"
    abbreviation = Column(String(20), nullable=True)  # "c", "tbsp"
    type = Column(String(30), nullable=True)      # volume, weight, count
    is_system = Column(Boolean, default=False)
```

### Collection

User-created recipe collections (cookbooks).

```python
class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    is_default = Column(Boolean, default=False)
    privacy_level = Column(String(20), default="public")
    sort_order = Column(Integer, default=0)
```

### CollectionShare

Tracks collection sharing with other users.

```python
class CollectionShare(Base):
    __tablename__ = "collection_shares"

    id = Column(String, primary_key=True)
    collection_id = Column(String, ForeignKey("collections.id", ondelete='CASCADE'))
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))  # shared with
    permission = Column(String(20), default="viewer")  # viewer, editor
    invited_by_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
```

### UserSettings

User preferences and notification settings.

```python
class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    preferred_unit_system = Column(String(20), default="metric")  # imperial, metric
    default_servings = Column(Integer, default=4)
    email_new_follower = Column(Boolean, default=True)
    email_follow_request = Column(Boolean, default=True)
    email_recipe_saved = Column(Boolean, default=False)
    updated_at = Column(DateTime, onupdate=func.now())
```

### MealPlan

Scheduled meal entries.

```python
class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete='CASCADE'))
    planned_date = Column(Date, nullable=False)
    meal_type = Column(String(20))  # breakfast, lunch, dinner, snack
    servings = Column(Float, default=4)
    notes = Column(Text, nullable=True)
    recurrence_id = Column(String, nullable=True)  # For recurring meals
```

### MealPlanShare

Sharing meal plans with other users (e.g., family members).

```python
class MealPlanShare(Base):
    __tablename__ = "meal_plan_shares"

    id = Column(String, primary_key=True)
    owner_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    shared_with_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    permission = Column(String(20), default="viewer")  # viewer, editor
    created_at = Column(DateTime, server_default=func.now())
```

### UserFollow

Social following relationships.

```python
class UserFollow(Base):
    __tablename__ = "user_follows"

    id = Column(String, primary_key=True)
    follower_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    following_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    status = Column(String)  # 'pending', 'confirmed', 'declined'
    created_at = Column(DateTime, server_default=func.now())
```

### Notification

User notifications.

```python
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'))
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    data = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
```

### URLCheck

Cache for URL recipe detection (avoid re-checking failed URLs).

```python
class URLCheck(Base):
    __tablename__ = "url_checks"

    url = Column(String(2048), primary_key=True)
    domain = Column(String(255), nullable=False, index=True)
    has_recipe = Column(Boolean, default=False)
    error = Column(String(500), nullable=True)
    checked_at = Column(DateTime, server_default=func.now())
```

## Junction Tables

### recipe_tags

Links recipes to tags (many-to-many).

```python
recipe_tags = Table(
    'recipe_tags',
    Base.metadata,
    Column('recipe_id', String, ForeignKey('recipes.id', ondelete='CASCADE')),
    Column('tag_id', String, ForeignKey('tags.id', ondelete='CASCADE'))
)
```

### collection_recipes

Links collections to recipes (many-to-many).

```python
collection_recipes = Table(
    'collection_recipes',
    Base.metadata,
    Column('collection_id', String, ForeignKey('collections.id', ondelete='CASCADE')),
    Column('recipe_id', String, ForeignKey('recipes.id', ondelete='CASCADE')),
    Column('sort_order', Integer, default=0),
    Column('added_at', DateTime, server_default=func.now())
)
```

## Database Operations

### Auto-Creation

Tables are auto-created on startup:

```python
# In main.py
from database import Base, engine
Base.metadata.create_all(bind=engine)
```

### Reset Database

```bash
rm backend/potatoes.db
# Restart server - tables recreate automatically
```

### Database Connection

```python
# database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# SQLite needs check_same_thread=False
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## Indexing

Key indexes for performance:

| Table | Column | Purpose |
|-------|--------|---------|
| users | email | Login lookup |
| users | username | Profile lookup |
| refresh_tokens | token | Token validation |
| recipes | author_id | User's recipes |
| meal_plans | user_id, planned_date | Date range queries |
| meal_plans | recurrence_id | Recurring meal lookups |
| ingredients | normalized_name | Autocomplete search |
| url_checks | domain | URL cache by domain |
