from sqlalchemy import Boolean, Column, ForeignKey, String, DateTime, JSON, Integer, Float, Text, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid
import secrets


def generate_uuid():
    return str(uuid.uuid4())


# Junction tables
recipe_tags = Table(
    'recipe_tags',
    Base.metadata,
    Column('recipe_id', String, ForeignKey('recipes.id', ondelete='CASCADE'), primary_key=True),
    Column('tag_id', String, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)

collection_recipes = Table(
    'collection_recipes',
    Base.metadata,
    Column('collection_id', String, ForeignKey('collections.id', ondelete='CASCADE'), primary_key=True),
    Column('recipe_id', String, ForeignKey('recipes.id', ondelete='CASCADE'), primary_key=True),
    Column('sort_order', Integer, default=0),
    Column('added_at', DateTime(timezone=True), server_default=func.now())
)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth users
    oauth_provider = Column(String, nullable=True)  # 'google', etc.
    oauth_id = Column(String, nullable=True)  # Provider-specific user ID
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_verified = Column(Boolean, default=False, nullable=False)

    # Profile fields
    is_public = Column(Boolean, default=True, nullable=False)
    username = Column(String, unique=True, nullable=True, index=True)
    bio = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)

    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="owner", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="recipient", cascade="all, delete-orphan")
    following = relationship("UserFollow", foreign_keys="UserFollow.follower_id", back_populates="follower", cascade="all, delete-orphan")
    followers = relationship("UserFollow", foreign_keys="UserFollow.following_id", back_populates="following_user", cascade="all, delete-orphan")
    recipes = relationship("Recipe", back_populates="author", foreign_keys="Recipe.author_id", cascade="all, delete-orphan")
    collections = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=generate_uuid)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked = Column(Boolean, default=False)

    # Relationships
    owner = relationship("User", back_populates="refresh_tokens")


class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    type = Column(String, nullable=False)  # 'verify_email' or 'reset_password'
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    data = Column('metadata', JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    recipient = relationship("User", back_populates="notifications")


class UserFollow(Base):
    __tablename__ = "user_follows"

    id = Column(String, primary_key=True, default=generate_uuid)
    follower_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    following_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    status = Column(String, nullable=False)  # 'pending', 'confirmed', 'declined'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following_user = relationship("User", foreign_keys=[following_id], back_populates="followers")


# ============================================================================
# RECIPE MODELS
# ============================================================================

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(String, primary_key=True, default=generate_uuid)
    author_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    yield_quantity = Column(Float, default=4)
    yield_unit = Column(String(50), default="servings")
    prep_time_minutes = Column(Integer, nullable=True)
    cook_time_minutes = Column(Integer, nullable=True)
    difficulty = Column(String(20), nullable=True)  # easy, medium, hard
    privacy_level = Column(String(20), default="public")  # private, public
    source_url = Column(String(500), nullable=True)
    source_name = Column(String(200), nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    status = Column(String(20), default="published")  # draft, published
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Clone/Fork tracking
    forked_from_recipe_id = Column(String, ForeignKey("recipes.id", ondelete='SET NULL'), nullable=True)
    forked_from_user_id = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)

    # Relationships
    author = relationship("User", back_populates="recipes", foreign_keys=[author_id])
    forked_from_user = relationship("User", foreign_keys=[forked_from_user_id])
    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeIngredient.sort_order")
    instructions = relationship("RecipeInstruction", back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeInstruction.step_number")
    tags = relationship("Tag", secondary=recipe_tags, back_populates="recipes")
    collections = relationship("Collection", secondary=collection_recipes, back_populates="recipes")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(String, primary_key=True, default=generate_uuid)
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete='CASCADE'), nullable=False)
    ingredient_id = Column(String, ForeignKey("ingredients.id", ondelete='SET NULL'), nullable=True)  # Link to master ingredient
    sort_order = Column(Integer, nullable=False, default=0)
    quantity = Column(Float, nullable=True)
    quantity_max = Column(Float, nullable=True)  # For ranges like "1-2 cups"
    unit = Column(String(50), nullable=True)
    name = Column(String(200), nullable=False)  # Display name (kept for flexibility)
    preparation = Column(String(200), nullable=True)  # e.g., "diced", "minced"
    is_optional = Column(Boolean, default=False)
    is_staple = Column(Boolean, default=False)
    ingredient_group = Column(String(100), nullable=True)  # e.g., "For the sauce"
    notes = Column(Text, nullable=True)

    # Relationships
    recipe = relationship("Recipe", back_populates="ingredients")
    ingredient = relationship("Ingredient", back_populates="recipe_ingredients")


class RecipeInstruction(Base):
    __tablename__ = "recipe_instructions"

    id = Column(String, primary_key=True, default=generate_uuid)
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete='CASCADE'), nullable=False)
    step_number = Column(Integer, nullable=False)
    instruction_text = Column(Text, nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    instruction_group = Column(String(100), nullable=True)  # e.g., "Make the dough"

    # Relationships
    recipe = relationship("Recipe", back_populates="instructions")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True)
    category = Column(String(50), nullable=True)  # cuisine, diet, meal_type, technique, season, custom
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    recipes = relationship("Recipe", secondary=recipe_tags, back_populates="tags")


class Ingredient(Base):
    """Master ingredients list for autocomplete and ingredient linking"""
    __tablename__ = "ingredients"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(200), nullable=False)  # Display name (original casing)
    normalized_name = Column(String(200), nullable=False, index=True)  # Lowercase for matching/deduplication
    category = Column(String(50), nullable=True)  # produce, meat, dairy, pantry, spices, etc.
    is_system = Column(Boolean, default=False)  # System-seeded vs user-added
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=True)  # NULL = system/global, set = user-specific
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")
    recipe_ingredients = relationship("RecipeIngredient", back_populates="ingredient")


class MeasurementUnit(Base):
    """Master measurement units list for autocomplete suggestions"""
    __tablename__ = "measurement_units"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(50), nullable=False, unique=True)  # "cup", "tablespoon", etc.
    abbreviation = Column(String(20), nullable=True)  # "c", "tbsp", etc.
    type = Column(String(30), nullable=True)  # volume, weight, count, etc.
    is_system = Column(Boolean, default=False)


class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    is_default = Column(Boolean, default=False)
    privacy_level = Column(String(20), default="public")  # private, public
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="collections")
    recipes = relationship("Recipe", secondary=collection_recipes, back_populates="collections")
    shares = relationship("CollectionShare", back_populates="collection", cascade="all, delete-orphan")


class CollectionShare(Base):
    """Tracks which users a collection is shared with and their permission level."""
    __tablename__ = "collection_shares"

    id = Column(String, primary_key=True, default=generate_uuid)
    collection_id = Column(String, ForeignKey("collections.id", ondelete='CASCADE'), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)  # shared with
    permission = Column(String(20), default="viewer")  # viewer, editor
    invited_by_id = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('collection_id', 'user_id', name='uq_collection_user'),
    )

    # Relationships
    collection = relationship("Collection", back_populates="shares")
    user = relationship("User", foreign_keys=[user_id], backref="shared_collections")
    invited_by = relationship("User", foreign_keys=[invited_by_id])


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), primary_key=True)
    preferred_unit_system = Column(String(20), default="metric")  # imperial, metric
    default_servings = Column(Integer, default=4)
    email_new_follower = Column(Boolean, default=True)
    email_follow_request = Column(Boolean, default=True)
    email_recipe_saved = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="settings")
