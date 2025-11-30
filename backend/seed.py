"""
Seed Script

Populates the database with:
- System tags (cuisines, diets, meal types, etc.)
- Creates default collections for new users
"""

from database import SessionLocal, engine, Base
from models import Tag, Collection, User

# System tags organized by category
SYSTEM_TAGS = {
    "cuisine": [
        "Italian", "Mexican", "Chinese", "Japanese", "Indian", "Thai",
        "French", "Greek", "Mediterranean", "American", "Korean",
        "Vietnamese", "Spanish", "Middle Eastern", "Caribbean",
        "African", "German", "British", "Brazilian", "Peruvian",
    ],
    "diet": [
        "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto",
        "Paleo", "Low-Carb", "Low-Fat", "Low-Sodium", "Whole30",
        "Nut-Free", "Egg-Free", "Pescatarian", "Halal", "Kosher",
    ],
    "meal_type": [
        "Breakfast", "Brunch", "Lunch", "Dinner", "Snack",
        "Appetizer", "Side Dish", "Main Course", "Dessert",
        "Beverage", "Soup", "Salad", "Sandwich",
    ],
    "technique": [
        "Grilled", "Baked", "Fried", "Roasted", "Steamed",
        "Slow Cooker", "Instant Pot", "Air Fryer", "No-Cook",
        "One-Pot", "Sheet Pan", "Stir-Fry", "Smoked", "Braised",
    ],
    "season": [
        "Spring", "Summer", "Fall", "Winter", "Holiday",
        "Christmas", "Thanksgiving", "Easter", "Halloween",
        "Valentine's Day", "Fourth of July",
    ],
    "other": [
        "Quick & Easy", "Budget-Friendly", "Meal Prep", "Kid-Friendly",
        "Date Night", "Party Food", "Comfort Food", "Healthy",
        "High-Protein", "Spicy", "Sweet", "Savory",
    ],
}

# Default collections created for each new user
DEFAULT_COLLECTIONS = [
    {"name": "Favorites", "is_default": True, "description": "Your favorite recipes"},
    {"name": "Want to Try", "is_default": True, "description": "Recipes you want to make"},
]


def seed_tags(db):
    """Seed system tags."""
    print("Seeding system tags...")
    created = 0
    skipped = 0

    for category, tag_names in SYSTEM_TAGS.items():
        for name in tag_names:
            existing = db.query(Tag).filter(Tag.name == name).first()
            if not existing:
                tag = Tag(
                    name=name,
                    category=category,
                    is_system=True,
                )
                db.add(tag)
                created += 1
            else:
                skipped += 1

    db.commit()
    print(f"  Created: {created}, Skipped (existing): {skipped}")


def create_default_collections_for_user(db, user_id: str):
    """Create default collections for a specific user."""
    for idx, collection_data in enumerate(DEFAULT_COLLECTIONS):
        existing = db.query(Collection).filter(
            Collection.user_id == user_id,
            Collection.name == collection_data["name"]
        ).first()

        if not existing:
            collection = Collection(
                user_id=user_id,
                name=collection_data["name"],
                description=collection_data.get("description"),
                is_default=collection_data.get("is_default", False),
                sort_order=idx,
            )
            db.add(collection)

    db.commit()


def seed_default_collections(db):
    """Create default collections for all existing users who don't have them."""
    print("Seeding default collections for existing users...")
    users = db.query(User).all()

    for user in users:
        create_default_collections_for_user(db, user.id)

    print(f"  Processed {len(users)} users")


def run_seed():
    """Run all seed operations."""
    print("Starting database seed...")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_tags(db)
        seed_default_collections(db)
        print("Seed completed successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
