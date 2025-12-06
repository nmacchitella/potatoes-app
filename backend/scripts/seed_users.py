"""
Seed Script for Test Users and Sample Recipes

Creates multiple test users with different privacy settings and sample recipes.

Run from backend directory:
    python scripts/seed_users.py
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import random
from database import SessionLocal, engine, Base
from models import (
    User, Recipe, RecipeIngredient, RecipeInstruction, Tag,
    Collection, UserFollow, Notification, Ingredient
)
from auth import get_password_hash


def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for matching: lowercase, stripped, single spaces."""
    return " ".join(name.lower().strip().split())


def find_or_create_ingredient_for_user(db, name: str, user_id: str, category: str = "other") -> Ingredient:
    """
    Find an existing ingredient or create a new user-specific one.
    Checks system ingredients first, then user's ingredients.
    """
    normalized = normalize_ingredient_name(name)

    # Check for system ingredient first
    existing_system = db.query(Ingredient).filter(
        Ingredient.is_system == True,
        Ingredient.normalized_name == normalized
    ).first()

    if existing_system:
        return existing_system

    # Check for user's custom ingredient
    existing_user = db.query(Ingredient).filter(
        Ingredient.user_id == user_id,
        Ingredient.normalized_name == normalized
    ).first()

    if existing_user:
        return existing_user

    # Create new user-specific ingredient
    ingredient = Ingredient(
        name=name.strip(),
        normalized_name=normalized,
        category=category,
        is_system=False,
        user_id=user_id,
    )
    db.add(ingredient)
    db.flush()

    return ingredient

# Test users configuration
TEST_USERS = [
    {
        "email": "alice@example.com",
        "name": "Alice Johnson",
        "username": "alicecooks",
        "bio": "Home chef passionate about Italian cuisine and fresh ingredients.",
        "is_public": True,
        "is_verified": True,
    },
    {
        "email": "bob@example.com",
        "name": "Bob Smith",
        "username": "chefbob",
        "bio": "Professional chef sharing my restaurant secrets.",
        "is_public": True,
        "is_verified": True,
    },
    {
        "email": "carol@example.com",
        "name": "Carol Williams",
        "username": "carolskitchen",
        "bio": "Baking enthusiast. Cakes, cookies, and everything sweet!",
        "is_public": False,  # Private user
        "is_verified": True,
    },
    {
        "email": "david@example.com",
        "name": "David Brown",
        "username": "davidcooks",
        "bio": "Weekend griller and BBQ master.",
        "is_public": False,  # Private user
        "is_verified": True,
    },
    {
        "email": "emma@example.com",
        "name": "Emma Davis",
        "username": "emmaeats",
        "bio": "Vegetarian recipes for the whole family.",
        "is_public": True,
        "is_verified": True,
    },
]

# Sample recipes for each user
SAMPLE_RECIPES = {
    "alicecooks": [
        {
            "title": "Classic Spaghetti Carbonara",
            "description": "A creamy Roman pasta dish with eggs, cheese, and pancetta.",
            "difficulty": "medium",
            "prep_time": 15,
            "cook_time": 20,
            "ingredients": [
                {"qty": 400, "unit": "g", "name": "spaghetti"},
                {"qty": 200, "unit": "g", "name": "pancetta", "prep": "diced"},
                {"qty": 4, "unit": None, "name": "egg yolks"},
                {"qty": 100, "unit": "g", "name": "Pecorino Romano", "prep": "grated"},
                {"qty": None, "unit": None, "name": "black pepper", "prep": "freshly ground"},
            ],
            "instructions": [
                "Bring a large pot of salted water to boil and cook spaghetti until al dente.",
                "Meanwhile, cook pancetta in a large pan until crispy.",
                "Whisk egg yolks with grated cheese and plenty of black pepper.",
                "Drain pasta, reserving some cooking water. Add hot pasta to pancetta.",
                "Remove from heat and quickly stir in egg mixture, adding pasta water as needed.",
            ],
            "privacy": "public",
        },
        {
            "title": "Fresh Tomato Bruschetta",
            "description": "Simple Italian appetizer with ripe tomatoes and basil.",
            "difficulty": "easy",
            "prep_time": 15,
            "cook_time": 5,
            "ingredients": [
                {"qty": 4, "unit": None, "name": "ripe tomatoes", "prep": "diced"},
                {"qty": 1, "unit": "clove", "name": "garlic", "prep": "minced"},
                {"qty": 1, "unit": "bunch", "name": "fresh basil", "prep": "chopped"},
                {"qty": 3, "unit": "Tbsp", "name": "olive oil"},
                {"qty": 1, "unit": None, "name": "baguette", "prep": "sliced"},
            ],
            "instructions": [
                "Mix diced tomatoes with garlic, basil, and olive oil. Season with salt.",
                "Toast baguette slices until golden.",
                "Top toasted bread with tomato mixture and serve immediately.",
            ],
            "privacy": "public",
        },
        {
            "title": "Tiramisu",
            "description": "Classic Italian coffee-flavored dessert.",
            "difficulty": "medium",
            "prep_time": 30,
            "cook_time": 0,
            "ingredients": [
                {"qty": 6, "unit": None, "name": "egg yolks"},
                {"qty": 150, "unit": "g", "name": "sugar"},
                {"qty": 500, "unit": "g", "name": "mascarpone"},
                {"qty": 300, "unit": "ml", "name": "espresso", "prep": "cooled"},
                {"qty": 200, "unit": "g", "name": "ladyfinger cookies"},
                {"qty": 2, "unit": "Tbsp", "name": "cocoa powder"},
            ],
            "instructions": [
                "Beat egg yolks with sugar until pale and creamy.",
                "Fold in mascarpone until smooth.",
                "Dip ladyfingers briefly in espresso and layer in dish.",
                "Spread mascarpone mixture over cookies. Repeat layers.",
                "Refrigerate for at least 4 hours. Dust with cocoa before serving.",
            ],
            "privacy": "public",
        },
    ],
    "chefbob": [
        {
            "title": "Pan-Seared Salmon",
            "description": "Restaurant-quality salmon with crispy skin.",
            "difficulty": "medium",
            "prep_time": 10,
            "cook_time": 15,
            "ingredients": [
                {"qty": 4, "unit": None, "name": "salmon fillets"},
                {"qty": 2, "unit": "Tbsp", "name": "olive oil"},
                {"qty": 2, "unit": "Tbsp", "name": "butter"},
                {"qty": 4, "unit": "cloves", "name": "garlic", "prep": "smashed"},
                {"qty": 1, "unit": "sprig", "name": "fresh thyme"},
                {"qty": 1, "unit": None, "name": "lemon"},
            ],
            "instructions": [
                "Pat salmon dry and season generously with salt and pepper.",
                "Heat oil in a cast iron pan over high heat until smoking.",
                "Place salmon skin-side down and press gently. Cook for 4 minutes.",
                "Add butter, garlic, and thyme. Baste salmon with the butter.",
                "Flip and cook 2 more minutes. Squeeze lemon juice over top.",
            ],
            "privacy": "public",
        },
        {
            "title": "Beef Bourguignon",
            "description": "French braised beef in red wine sauce.",
            "difficulty": "hard",
            "prep_time": 30,
            "cook_time": 180,
            "ingredients": [
                {"qty": 1, "unit": "kg", "name": "beef chuck", "prep": "cubed"},
                {"qty": 1, "unit": "bottle", "name": "red wine"},
                {"qty": 200, "unit": "g", "name": "bacon lardons"},
                {"qty": 2, "unit": None, "name": "carrots", "prep": "sliced"},
                {"qty": 1, "unit": None, "name": "onion", "prep": "diced"},
                {"qty": 200, "unit": "g", "name": "mushrooms"},
                {"qty": 2, "unit": "Tbsp", "name": "tomato paste"},
            ],
            "instructions": [
                "Brown beef in batches and set aside.",
                "Cook bacon until crispy, then sauté vegetables.",
                "Add tomato paste and cook for 1 minute.",
                "Return beef, add wine and enough stock to cover.",
                "Simmer covered for 2-3 hours until beef is tender.",
                "Add mushrooms in the last 30 minutes.",
            ],
            "privacy": "public",
        },
    ],
    "carolskitchen": [
        {
            "title": "Secret Chocolate Cake",
            "description": "My grandmother's recipe - family secret!",
            "difficulty": "medium",
            "prep_time": 20,
            "cook_time": 35,
            "ingredients": [
                {"qty": 200, "unit": "g", "name": "dark chocolate"},
                {"qty": 200, "unit": "g", "name": "butter"},
                {"qty": 200, "unit": "g", "name": "sugar"},
                {"qty": 4, "unit": None, "name": "eggs"},
                {"qty": 100, "unit": "g", "name": "flour"},
            ],
            "instructions": [
                "Melt chocolate and butter together.",
                "Whisk eggs and sugar until fluffy.",
                "Fold chocolate mixture into eggs, then add flour.",
                "Bake at 180°C for 25-30 minutes.",
            ],
            "privacy": "private",  # Private recipe
        },
        {
            "title": "Vanilla Bean Cupcakes",
            "description": "Light and fluffy cupcakes with vanilla buttercream.",
            "difficulty": "easy",
            "prep_time": 20,
            "cook_time": 20,
            "ingredients": [
                {"qty": 200, "unit": "g", "name": "flour"},
                {"qty": 150, "unit": "g", "name": "sugar"},
                {"qty": 2, "unit": None, "name": "eggs"},
                {"qty": 1, "unit": None, "name": "vanilla bean"},
                {"qty": 120, "unit": "ml", "name": "milk"},
            ],
            "instructions": [
                "Mix dry ingredients together.",
                "Beat eggs with sugar and vanilla seeds.",
                "Combine wet and dry ingredients, add milk.",
                "Bake at 175°C for 18-20 minutes.",
            ],
            "privacy": "public",
        },
    ],
    "davidcooks": [
        {
            "title": "Texas-Style Brisket",
            "description": "Low and slow smoked brisket - BBQ perfection.",
            "difficulty": "hard",
            "prep_time": 30,
            "cook_time": 720,  # 12 hours
            "ingredients": [
                {"qty": 5, "unit": "kg", "name": "beef brisket"},
                {"qty": 4, "unit": "Tbsp", "name": "black pepper", "prep": "coarsely ground"},
                {"qty": 4, "unit": "Tbsp", "name": "kosher salt"},
                {"qty": None, "unit": None, "name": "oak wood", "prep": "for smoking"},
            ],
            "instructions": [
                "Trim brisket, leaving 1/4 inch fat cap.",
                "Apply salt and pepper rub generously.",
                "Smoke at 225°F for 10-12 hours until internal temp reaches 203°F.",
                "Wrap in butcher paper at the stall (around 165°F internal).",
                "Rest for at least 1 hour before slicing against the grain.",
            ],
            "privacy": "private",  # Private user, private recipe
        },
    ],
    "emmaeats": [
        {
            "title": "Mediterranean Quinoa Bowl",
            "description": "Healthy vegetarian bowl packed with flavor.",
            "difficulty": "easy",
            "prep_time": 15,
            "cook_time": 20,
            "ingredients": [
                {"qty": 1, "unit": "cup", "name": "quinoa"},
                {"qty": 1, "unit": "can", "name": "chickpeas", "prep": "drained"},
                {"qty": 1, "unit": None, "name": "cucumber", "prep": "diced"},
                {"qty": 200, "unit": "g", "name": "cherry tomatoes", "prep": "halved"},
                {"qty": 100, "unit": "g", "name": "feta cheese"},
                {"qty": None, "unit": None, "name": "kalamata olives"},
            ],
            "instructions": [
                "Cook quinoa according to package directions.",
                "Roast chickpeas with olive oil and spices at 400°F for 20 minutes.",
                "Assemble bowls with quinoa, chickpeas, vegetables, and feta.",
                "Drizzle with olive oil and lemon juice.",
            ],
            "privacy": "public",
        },
        {
            "title": "Creamy Mushroom Risotto",
            "description": "Vegetarian comfort food at its finest.",
            "difficulty": "medium",
            "prep_time": 10,
            "cook_time": 30,
            "ingredients": [
                {"qty": 300, "unit": "g", "name": "arborio rice"},
                {"qty": 300, "unit": "g", "name": "mixed mushrooms"},
                {"qty": 1, "unit": "L", "name": "vegetable stock"},
                {"qty": 1, "unit": "cup", "name": "white wine"},
                {"qty": 50, "unit": "g", "name": "parmesan", "prep": "grated"},
                {"qty": 2, "unit": "Tbsp", "name": "butter"},
            ],
            "instructions": [
                "Sauté mushrooms until golden and set aside.",
                "Toast rice in butter, then add wine and stir until absorbed.",
                "Add warm stock one ladle at a time, stirring constantly.",
                "Continue for 18-20 minutes until rice is creamy.",
                "Stir in mushrooms, parmesan, and butter. Season to taste.",
            ],
            "privacy": "public",
        },
        {
            "title": "Thai Green Curry",
            "description": "Aromatic vegetable curry with coconut milk.",
            "difficulty": "medium",
            "prep_time": 15,
            "cook_time": 25,
            "ingredients": [
                {"qty": 2, "unit": "Tbsp", "name": "green curry paste"},
                {"qty": 400, "unit": "ml", "name": "coconut milk"},
                {"qty": 200, "unit": "g", "name": "tofu", "prep": "cubed"},
                {"qty": 1, "unit": None, "name": "bell pepper", "prep": "sliced"},
                {"qty": 100, "unit": "g", "name": "snap peas"},
                {"qty": None, "unit": None, "name": "Thai basil"},
            ],
            "instructions": [
                "Fry curry paste in a little coconut milk until fragrant.",
                "Add remaining coconut milk and bring to simmer.",
                "Add tofu and vegetables, cook until tender.",
                "Season with soy sauce and palm sugar.",
                "Garnish with Thai basil and serve with jasmine rice.",
            ],
            "privacy": "public",
        },
    ],
}

# Sample collections
SAMPLE_COLLECTIONS = {
    "alicecooks": [
        {"name": "Italian Classics", "description": "Traditional Italian recipes", "privacy": "public"},
        {"name": "Quick Dinners", "description": "Meals ready in 30 minutes", "privacy": "public"},
    ],
    "chefbob": [
        {"name": "Restaurant Secrets", "description": "Pro techniques at home", "privacy": "public"},
    ],
    "carolskitchen": [
        {"name": "Family Recipes", "description": "Passed down generations", "privacy": "private"},
    ],
    "emmaeats": [
        {"name": "Meatless Mondays", "description": "Vegetarian favorites", "privacy": "public"},
    ],
}


def create_test_users(db):
    """Create test users."""
    print("Creating test users...")
    users = {}

    for user_data in TEST_USERS:
        existing = db.query(User).filter(User.email == user_data["email"]).first()

        if existing:
            print(f"  User {user_data['username']} already exists")
            users[user_data["username"]] = existing
            continue

        user = User(
            email=user_data["email"],
            name=user_data["name"],
            username=user_data["username"],
            bio=user_data["bio"],
            is_public=user_data["is_public"],
            is_verified=user_data["is_verified"],
            hashed_password=get_password_hash("password123"),
        )
        db.add(user)
        db.flush()
        users[user_data["username"]] = user
        privacy_label = "public" if user_data["is_public"] else "private"
        print(f"  Created {user_data['username']} ({privacy_label})")

    db.commit()
    return users


def create_recipes_for_user(db, user, recipes_data):
    """Create sample recipes for a user."""
    tags = db.query(Tag).filter(Tag.is_system == True).all()
    created_count = 0

    for recipe_data in recipes_data:
        # Check if recipe already exists
        existing = db.query(Recipe).filter(
            Recipe.title == recipe_data["title"],
            Recipe.author_id == user.id
        ).first()

        if existing:
            continue

        recipe = Recipe(
            author_id=user.id,
            title=recipe_data["title"],
            description=recipe_data["description"],
            difficulty=recipe_data["difficulty"],
            prep_time_minutes=recipe_data["prep_time"],
            cook_time_minutes=recipe_data["cook_time"],
            privacy_level=recipe_data.get("privacy", "public"),
            status="published",
            yield_quantity=4,
            yield_unit="servings",
        )
        db.add(recipe)
        db.flush()

        # Add ingredients
        for idx, ing in enumerate(recipe_data["ingredients"]):
            # Find or create master ingredient entity
            master_ingredient = find_or_create_ingredient_for_user(
                db=db,
                name=ing["name"],
                user_id=user.id
            )
            ingredient = RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=master_ingredient.id,
                sort_order=idx,
                quantity=ing.get("qty"),
                unit=ing.get("unit"),
                name=ing["name"],
                preparation=ing.get("prep"),
            )
            db.add(ingredient)

        # Add instructions
        for idx, step in enumerate(recipe_data["instructions"]):
            instruction = RecipeInstruction(
                recipe_id=recipe.id,
                step_number=idx + 1,
                instruction_text=step,
            )
            db.add(instruction)

        # Add random tags
        if tags:
            recipe.tags = random.sample(tags, min(2, len(tags)))

        created_count += 1

    return created_count


def create_collections_for_user(db, user, collections_data):
    """Create sample collections for a user."""
    created_count = 0

    for idx, coll_data in enumerate(collections_data):
        existing = db.query(Collection).filter(
            Collection.name == coll_data["name"],
            Collection.user_id == user.id
        ).first()

        if existing:
            continue

        collection = Collection(
            user_id=user.id,
            name=coll_data["name"],
            description=coll_data["description"],
            privacy_level=coll_data.get("privacy", "public"),
            sort_order=idx + 1,
        )
        db.add(collection)
        created_count += 1

    return created_count


def create_follow_relationships(db, users):
    """Create some follow relationships between users."""
    print("Creating follow relationships...")

    # Alice follows Bob (public, auto-confirm)
    # Alice follows Carol (private, pending)
    # Bob follows Alice (public, auto-confirm)
    # Emma follows Alice (public, auto-confirm)

    relationships = [
        ("alicecooks", "chefbob", "confirmed"),    # Alice -> Bob (public)
        ("alicecooks", "carolskitchen", "pending"),  # Alice -> Carol (private, pending)
        ("chefbob", "alicecooks", "confirmed"),    # Bob -> Alice (public)
        ("emmaeats", "alicecooks", "confirmed"),   # Emma -> Alice (public)
        ("emmaeats", "chefbob", "confirmed"),      # Emma -> Bob (public)
    ]

    for follower_username, following_username, status in relationships:
        follower = users.get(follower_username)
        following = users.get(following_username)

        if not follower or not following:
            continue

        existing = db.query(UserFollow).filter(
            UserFollow.follower_id == follower.id,
            UserFollow.following_id == following.id
        ).first()

        if existing:
            continue

        follow = UserFollow(
            follower_id=follower.id,
            following_id=following.id,
            status=status,
        )
        db.add(follow)

        # Create notification for the target user
        if status == "pending":
            notification = Notification(
                user_id=following.id,
                type="follow_request",
                title="New Follow Request",
                message=f"{follower.name} wants to follow you",
                link=f"/profile/{follower.username or follower.id}",
                data={"follower_id": follower.id, "follower_name": follower.name, "follower_username": follower.username},
            )
        else:
            notification = Notification(
                user_id=following.id,
                type="new_follower",
                title="New Follower",
                message=f"{follower.name} started following you",
                link=f"/profile/{follower.username or follower.id}",
                data={"follower_id": follower.id, "follower_name": follower.name, "follower_username": follower.username},
            )
        db.add(notification)

        print(f"  {follower_username} -> {following_username} ({status})")

    db.commit()


def run_seed():
    """Run the seed script."""
    print("=" * 50)
    print("Seeding Test Users and Sample Data")
    print("=" * 50)

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Create users
        users = create_test_users(db)

        # Create recipes and collections for each user
        print("\nCreating recipes...")
        for username, recipes_data in SAMPLE_RECIPES.items():
            user = users.get(username)
            if user:
                count = create_recipes_for_user(db, user, recipes_data)
                if count > 0:
                    print(f"  Created {count} recipes for {username}")
        db.commit()

        print("\nCreating collections...")
        for username, collections_data in SAMPLE_COLLECTIONS.items():
            user = users.get(username)
            if user:
                count = create_collections_for_user(db, user, collections_data)
                if count > 0:
                    print(f"  Created {count} collections for {username}")
        db.commit()

        # Create follow relationships
        create_follow_relationships(db, users)

        print("\n" + "=" * 50)
        print("Seed completed successfully!")
        print("=" * 50)
        print("\nTest Users (password: password123):")
        print("-" * 40)
        for user_data in TEST_USERS:
            privacy = "PUBLIC" if user_data["is_public"] else "PRIVATE"
            print(f"  {user_data['email']:25} @{user_data['username']:15} [{privacy}]")

    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
