from sqladmin import Admin, ModelView, BaseView, expose
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import engine, SessionLocal
from models import (
    User, RefreshToken, VerificationToken, Notification, UserFollow,
    Recipe, RecipeIngredient, RecipeInstruction, Tag, Ingredient, MeasurementUnit,
    Collection, CollectionShare, UserSettings, MealPlan, MealPlanShare, URLCheck
)
from auth import verify_password
import secrets
import os
import json
import uuid
from datetime import datetime

# Get absolute path to templates directory
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        email = form.get("username")  # SQLAdmin uses 'username' field
        password = form.get("password")

        db: Session = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                return False

            # Check password
            if not user.hashed_password or not verify_password(password, user.hashed_password):
                return False

            # Check if user is admin
            if not user.is_admin:
                return False

            # Store user info in session
            request.session.update({"user_id": user.id, "user_email": user.email})
            return True
        finally:
            db.close()

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        user_id = request.session.get("user_id")
        if not user_id:
            return False

        # Verify user still exists and is still admin
        db: Session = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.is_admin:
                request.session.clear()
                return False
            return True
        finally:
            db.close()


# ============================================================================
# USER & AUTH ADMIN VIEWS
# ============================================================================

class UserAdmin(ModelView, model=User):
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"

    column_list = [User.id, User.email, User.name, User.username, User.is_public, User.is_admin, User.is_verified, User.oauth_provider, User.created_at]
    column_searchable_list = [User.email, User.name, User.username]
    column_sortable_list = [User.email, User.name, User.username, User.created_at, User.is_admin, User.is_public, User.is_verified]
    column_default_sort = [(User.created_at, True)]

    # Don't show password hash in forms
    form_excluded_columns = [User.hashed_password, User.refresh_tokens, User.recipes, User.collections, User.notifications, User.following, User.followers, User.settings]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class RefreshTokenAdmin(ModelView, model=RefreshToken):
    name = "Refresh Token"
    name_plural = "Refresh Tokens"
    icon = "fa-solid fa-key"

    column_list = [RefreshToken.id, RefreshToken.owner, RefreshToken.expires_at, RefreshToken.revoked, RefreshToken.created_at]
    column_searchable_list = [RefreshToken.token]
    column_sortable_list = [RefreshToken.created_at, RefreshToken.expires_at, RefreshToken.revoked]
    column_default_sort = [(RefreshToken.created_at, True)]

    can_create = False  # Tokens should be created through the API
    can_edit = True  # Allow revoking tokens
    can_delete = True
    can_view_details = True


class VerificationTokenAdmin(ModelView, model=VerificationToken):
    name = "Verification Token"
    name_plural = "Verification Tokens"
    icon = "fa-solid fa-envelope"

    column_list = [VerificationToken.token, VerificationToken.user_id, VerificationToken.type, VerificationToken.expires_at, VerificationToken.created_at]
    column_sortable_list = [VerificationToken.created_at, VerificationToken.expires_at, VerificationToken.type]
    column_default_sort = [(VerificationToken.created_at, True)]

    can_create = False
    can_edit = False
    can_delete = True
    can_view_details = True


class NotificationAdmin(ModelView, model=Notification):
    name = "Notification"
    name_plural = "Notifications"
    icon = "fa-solid fa-bell"

    column_list = [Notification.id, Notification.recipient, Notification.type, Notification.title, Notification.is_read, Notification.created_at]
    column_searchable_list = [Notification.title, Notification.message, Notification.type]
    column_sortable_list = [Notification.created_at, Notification.is_read, Notification.type]
    column_default_sort = [(Notification.created_at, True)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class UserFollowAdmin(ModelView, model=UserFollow):
    name = "User Follow"
    name_plural = "User Follows"
    icon = "fa-solid fa-user-group"

    column_list = [UserFollow.id, UserFollow.follower, UserFollow.following_user, UserFollow.status, UserFollow.created_at]
    column_searchable_list = [UserFollow.status]
    column_sortable_list = [UserFollow.created_at, UserFollow.updated_at, UserFollow.status]
    column_default_sort = [(UserFollow.created_at, True)]

    can_create = False
    can_edit = True
    can_delete = True
    can_view_details = True


class UserSettingsAdmin(ModelView, model=UserSettings):
    name = "User Settings"
    name_plural = "User Settings"
    icon = "fa-solid fa-gear"

    column_list = [UserSettings.user_id, UserSettings.preferred_unit_system, UserSettings.default_servings, UserSettings.email_new_follower, UserSettings.updated_at]
    column_sortable_list = [UserSettings.updated_at, UserSettings.preferred_unit_system]
    column_default_sort = [(UserSettings.updated_at, True)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


# ============================================================================
# RECIPE ADMIN VIEWS
# ============================================================================

class RecipeAdmin(ModelView, model=Recipe):
    name = "Recipe"
    name_plural = "Recipes"
    icon = "fa-solid fa-utensils"

    column_list = [Recipe.id, Recipe.title, Recipe.author, Recipe.privacy_level, Recipe.status, Recipe.difficulty, Recipe.created_at]
    column_searchable_list = [Recipe.title, Recipe.description, Recipe.source_name]
    column_sortable_list = [Recipe.title, Recipe.created_at, Recipe.updated_at, Recipe.privacy_level, Recipe.status, Recipe.difficulty]
    column_default_sort = [(Recipe.created_at, True)]

    form_excluded_columns = [Recipe.ingredients, Recipe.instructions, Recipe.tags, Recipe.collections]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class RecipeIngredientAdmin(ModelView, model=RecipeIngredient):
    name = "Recipe Ingredient"
    name_plural = "Recipe Ingredients"
    icon = "fa-solid fa-carrot"

    column_list = [RecipeIngredient.id, RecipeIngredient.recipe, RecipeIngredient.name, RecipeIngredient.quantity, RecipeIngredient.unit, RecipeIngredient.sort_order]
    column_searchable_list = [RecipeIngredient.name, RecipeIngredient.preparation]
    column_sortable_list = [RecipeIngredient.sort_order, RecipeIngredient.name]
    column_default_sort = [(RecipeIngredient.sort_order, False)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class RecipeInstructionAdmin(ModelView, model=RecipeInstruction):
    name = "Recipe Instruction"
    name_plural = "Recipe Instructions"
    icon = "fa-solid fa-list-ol"

    column_list = [RecipeInstruction.id, RecipeInstruction.recipe, RecipeInstruction.step_number, RecipeInstruction.instruction_text, RecipeInstruction.duration_minutes]
    column_searchable_list = [RecipeInstruction.instruction_text]
    column_sortable_list = [RecipeInstruction.step_number]
    column_default_sort = [(RecipeInstruction.step_number, False)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class TagAdmin(ModelView, model=Tag):
    name = "Tag"
    name_plural = "Tags"
    icon = "fa-solid fa-tag"

    column_list = [Tag.id, Tag.name, Tag.category, Tag.is_system, Tag.created_at]
    column_searchable_list = [Tag.name, Tag.category]
    column_sortable_list = [Tag.name, Tag.created_at, Tag.category, Tag.is_system]
    column_default_sort = [(Tag.created_at, True)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class IngredientAdmin(ModelView, model=Ingredient):
    name = "Ingredient"
    name_plural = "Ingredients"
    icon = "fa-solid fa-lemon"

    column_list = [Ingredient.id, Ingredient.name, Ingredient.normalized_name, Ingredient.category, Ingredient.is_system, Ingredient.created_at]
    column_searchable_list = [Ingredient.name, Ingredient.normalized_name, Ingredient.category]
    column_sortable_list = [Ingredient.name, Ingredient.created_at, Ingredient.category, Ingredient.is_system]
    column_default_sort = [(Ingredient.created_at, True)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class MeasurementUnitAdmin(ModelView, model=MeasurementUnit):
    name = "Measurement Unit"
    name_plural = "Measurement Units"
    icon = "fa-solid fa-ruler"

    column_list = [MeasurementUnit.id, MeasurementUnit.name, MeasurementUnit.abbreviation, MeasurementUnit.type, MeasurementUnit.is_system]
    column_searchable_list = [MeasurementUnit.name, MeasurementUnit.abbreviation]
    column_sortable_list = [MeasurementUnit.name, MeasurementUnit.type, MeasurementUnit.is_system]
    column_default_sort = [(MeasurementUnit.name, False)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


# ============================================================================
# COLLECTION ADMIN VIEWS
# ============================================================================

class CollectionAdmin(ModelView, model=Collection):
    name = "Collection"
    name_plural = "Collections"
    icon = "fa-solid fa-folder"

    column_list = [Collection.id, Collection.name, Collection.user, Collection.privacy_level, Collection.is_default, Collection.created_at]
    column_searchable_list = [Collection.name, Collection.description]
    column_sortable_list = [Collection.name, Collection.created_at, Collection.privacy_level, Collection.is_default]
    column_default_sort = [(Collection.created_at, True)]

    form_excluded_columns = [Collection.recipes, Collection.shares]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class CollectionShareAdmin(ModelView, model=CollectionShare):
    name = "Collection Share"
    name_plural = "Collection Shares"
    icon = "fa-solid fa-share-nodes"

    column_list = [CollectionShare.id, CollectionShare.collection, CollectionShare.user, CollectionShare.permission, CollectionShare.invited_by, CollectionShare.created_at]
    column_sortable_list = [CollectionShare.created_at, CollectionShare.permission]
    column_default_sort = [(CollectionShare.created_at, True)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


# ============================================================================
# MEAL PLAN ADMIN VIEWS
# ============================================================================

class MealPlanAdmin(ModelView, model=MealPlan):
    name = "Meal Plan"
    name_plural = "Meal Plans"
    icon = "fa-solid fa-calendar-days"

    column_list = [MealPlan.id, MealPlan.user, MealPlan.recipe, MealPlan.planned_date, MealPlan.meal_type, MealPlan.servings, MealPlan.created_at]
    column_searchable_list = [MealPlan.meal_type, MealPlan.notes]
    column_sortable_list = [MealPlan.planned_date, MealPlan.created_at, MealPlan.meal_type]
    column_default_sort = [(MealPlan.planned_date, True)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


class MealPlanShareAdmin(ModelView, model=MealPlanShare):
    name = "Meal Plan Share"
    name_plural = "Meal Plan Shares"
    icon = "fa-solid fa-users"

    column_list = [MealPlanShare.id, MealPlanShare.owner, MealPlanShare.shared_with, MealPlanShare.permission, MealPlanShare.created_at]
    column_sortable_list = [MealPlanShare.created_at, MealPlanShare.permission]
    column_default_sort = [(MealPlanShare.created_at, True)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True


# ============================================================================
# URL CHECK CACHE ADMIN VIEW
# ============================================================================

class URLCheckAdmin(ModelView, model=URLCheck):
    name = "URL Check"
    name_plural = "URL Checks"
    icon = "fa-solid fa-link"

    column_list = [URLCheck.url, URLCheck.domain, URLCheck.has_recipe, URLCheck.error, URLCheck.checked_at]
    column_searchable_list = [URLCheck.url, URLCheck.domain]
    column_sortable_list = [URLCheck.domain, URLCheck.has_recipe, URLCheck.checked_at]
    column_default_sort = [(URLCheck.checked_at, True)]

    # Truncate long URLs in the list view to prevent horizontal scrolling
    column_formatters = {
        URLCheck.url: lambda m, a: m.url[:60] + "..." if m.url and len(m.url) > 60 else m.url
    }

    can_create = False  # URLs are checked automatically
    can_edit = True
    can_delete = True
    can_view_details = True


# ============================================================================
# CUSTOM VIEWS - RECIPE IMPORT
# ============================================================================

class RecipeImportView(BaseView):
    name = "Import Recipes"
    icon = "fa-solid fa-file-import"

    @expose("/import-recipes", methods=["GET", "POST"])
    async def import_recipes(self, request: Request):
        db: Session = SessionLocal()
        try:
            # Get all users for the dropdown
            users = db.query(User).order_by(User.username).all()

            if request.method == "GET":
                return await self.templates.TemplateResponse(
                    request,
                    "import_recipes.html",
                    context={"users": users, "results": None}
                )

            # Handle POST - file upload
            form = await request.form()
            user_id = form.get("user_id")
            files = form.getlist("files")

            if not user_id:
                return await self.templates.TemplateResponse(
                    request,
                    "import_recipes.html",
                    context={"users": users, "results": None, "error": "Please select a user"}
                )

            # Verify user exists
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return await self.templates.TemplateResponse(
                    request,
                    "import_recipes.html",
                    context={"users": users, "results": None, "error": "User not found"}
                )

            results = []
            for file in files:
                if not file.filename or not file.filename.endswith('.json'):
                    results.append({"filename": file.filename or "unknown", "status": "skipped", "error": "Not a JSON file"})
                    continue

                try:
                    content = await file.read()
                    recipe_data = json.loads(content.decode('utf-8'))

                    # Create the recipe
                    recipe = create_recipe_from_json(db, recipe_data, user_id)
                    results.append({"filename": file.filename, "status": "success", "title": recipe.title, "id": recipe.id})
                except json.JSONDecodeError as e:
                    results.append({"filename": file.filename, "status": "error", "error": f"Invalid JSON: {str(e)}"})
                except Exception as e:
                    results.append({"filename": file.filename, "status": "error", "error": str(e)})

            db.commit()

            success_count = len([r for r in results if r["status"] == "success"])
            error_count = len([r for r in results if r["status"] == "error"])

            return await self.templates.TemplateResponse(
                request,
                "import_recipes.html",
                context={
                    "users": users,
                    "results": results,
                    "success_count": success_count,
                    "error_count": error_count,
                    "selected_user": user
                }
            )

        finally:
            db.close()


def create_recipe_from_json(db: Session, data: dict, user_id: str) -> Recipe:
    """Create a Recipe and related objects from JSON data."""
    recipe_id = str(uuid.uuid4())

    # Create the recipe
    recipe = Recipe(
        id=recipe_id,
        author_id=user_id,
        title=data.get("title", "Untitled Recipe"),
        description=data.get("description"),
        yield_quantity=data.get("yield_quantity"),  # None if not specified
        yield_unit=data.get("yield_unit"),
        prep_time_minutes=data.get("prep_time_minutes"),
        cook_time_minutes=data.get("cook_time_minutes"),
        difficulty=data.get("difficulty"),
        privacy_level="public",
        source_url=data.get("source_url"),
        source_name=data.get("source_name"),
        cover_image_url=data.get("cover_image_url"),
        status="published",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(recipe)

    # Create ingredients
    for idx, ing_data in enumerate(data.get("ingredients", [])):
        ingredient = RecipeIngredient(
            id=str(uuid.uuid4()),
            recipe_id=recipe_id,
            sort_order=idx,
            name=ing_data.get("name", ""),
            quantity=ing_data.get("quantity"),
            quantity_max=ing_data.get("quantity_max"),
            unit=ing_data.get("unit"),
            preparation=ing_data.get("preparation"),
            is_optional=ing_data.get("is_optional", False),
            notes=ing_data.get("notes"),
        )
        db.add(ingredient)

    # Create instructions
    for inst_data in data.get("instructions", []):
        instruction = RecipeInstruction(
            id=str(uuid.uuid4()),
            recipe_id=recipe_id,
            step_number=inst_data.get("step_number", 1),
            instruction_text=inst_data.get("instruction_text", ""),
            duration_minutes=inst_data.get("duration_minutes"),
        )
        db.add(instruction)

    # Handle tags - find or create
    for tag_name in data.get("tags", []):
        if not tag_name:
            continue
        # Try to find existing tag
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            # Create new tag
            tag = Tag(
                id=str(uuid.uuid4()),
                name=tag_name,
                is_system=False,
            )
            db.add(tag)
            db.flush()  # Get the tag ID
        recipe.tags.append(tag)

    return recipe


def create_admin(app):
    """Create and configure the admin interface"""
    # Create authentication backend
    authentication_backend = AdminAuth(secret_key=secrets.token_urlsafe(32))

    # Create admin instance with dark theme
    admin = Admin(
        app=app,
        engine=engine,
        title="Potatoes Admin",
        authentication_backend=authentication_backend,
        base_url="/admin",
        templates_dir=TEMPLATES_DIR,
    )

    # Register user & auth views
    admin.add_view(UserAdmin)
    admin.add_view(RefreshTokenAdmin)
    admin.add_view(VerificationTokenAdmin)
    admin.add_view(NotificationAdmin)
    admin.add_view(UserFollowAdmin)
    admin.add_view(UserSettingsAdmin)

    # Register recipe views
    admin.add_view(RecipeAdmin)
    admin.add_view(RecipeIngredientAdmin)
    admin.add_view(RecipeInstructionAdmin)
    admin.add_view(TagAdmin)
    admin.add_view(IngredientAdmin)
    admin.add_view(MeasurementUnitAdmin)

    # Register collection views
    admin.add_view(CollectionAdmin)
    admin.add_view(CollectionShareAdmin)

    # Register meal plan views
    admin.add_view(MealPlanAdmin)
    admin.add_view(MealPlanShareAdmin)

    # Register URL check cache view
    admin.add_view(URLCheckAdmin)

    # Register custom views
    admin.add_view(RecipeImportView)

    return admin
