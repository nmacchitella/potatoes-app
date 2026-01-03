from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from config import settings, logger
from routers import auth_router, google_auth, recipe_router, collection_router, tag_router, social_router, notification_router, ingredient_router, search_router, meal_plan_router, admin_router, grocery_list_router
from admin import create_admin
from models import User

# Create database tables
Base.metadata.create_all(bind=engine)


def ensure_admin_user():
    """Promote user to admin based on ADMIN_EMAIL environment variable."""
    if not settings.admin_email:
        return

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == settings.admin_email).first()

        if user:
            if not user.is_admin:
                user.is_admin = True
                db.commit()
                logger.info(f"Promoted {settings.admin_email} to admin")
        else:
            logger.info(f"Admin email {settings.admin_email} not found - user must sign in first")
    finally:
        db.close()


# Ensure admin user exists
ensure_admin_user()

logger.info(f"Starting {settings.app_name}")

app = FastAPI(
    title=settings.app_name,
    description="FamilyKitchen - Collaborative meal planning and recipe management",
    version="1.0.0",
    root_path="",
    servers=[
        {"url": "https://potatoes-backend.fly.dev", "description": "Production"},
        {"url": settings.backend_url, "description": "Development"}
    ]
)

# Add session middleware (https_only=False for local development)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    session_cookie="admin_session",
    max_age=3600,
    same_site="lax",
    https_only=False  # Must be False for localhost; Fly.io handles HTTPS at edge
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://potatoes-frontend.fly.dev",
        "https://potatoes-frontend-dev.fly.dev",
        *settings.cors_origins,
    ],
    allow_origin_regex=r"^http://192\.168\.\d{1,3}\.\d{1,3}:3000$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router.router, prefix="/api")
app.include_router(google_auth.router, prefix="/api")
app.include_router(recipe_router.router, prefix="/api")
app.include_router(collection_router.router, prefix="/api")
app.include_router(tag_router.router, prefix="/api")
app.include_router(social_router.router, prefix="/api")
app.include_router(notification_router.router, prefix="/api")
app.include_router(ingredient_router.router, prefix="/api")
app.include_router(search_router.router, prefix="/api")
app.include_router(meal_plan_router.router, prefix="/api")
app.include_router(grocery_list_router.router, prefix="/api")
app.include_router(admin_router.router, prefix="/api")

# Create admin interface (must be after app creation and middleware setup)
admin = create_admin(app)


@app.get("/")
def root():
    return {
        "message": "Potatoes API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
