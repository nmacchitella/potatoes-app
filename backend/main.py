from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from config import settings, logger
from routers import auth_router, google_auth, recipe_router, collection_router, tag_router, social_router, notification_router, ingredient_router, search_router, meal_plan_router, admin_router, grocery_list_router, library_router
from admin import create_admin
from models import User

# NOTE: Do not use Base.metadata.create_all() here — rely solely on Alembic migrations
# to avoid schema drift between what Alembic tracks and what exists in the database.


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
        {"url": settings.backend_url, "description": "Current"},
    ]
)

# Add session middleware
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    session_cookie="admin_session",
    max_age=3600,
    same_site="lax",
    https_only=not settings.debug,  # True in production, False for localhost
)

# Configure CORS — origins are managed centrally in config.py / CORS_ORIGINS env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^http://192\.168\.\d{1,3}\.\d{1,3}:(3000|3001)$" if settings.debug else None,
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
app.include_router(library_router.router, prefix="/api")
app.include_router(admin_router.router, prefix="/api")

# Create admin interface (must be after app creation and middleware setup)
admin = create_admin(app)


# ============================================================================
# GLOBAL EXCEPTION HANDLERS
# ============================================================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Return a consistent JSON error shape for all HTTP errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return a consistent JSON error shape for request validation errors."""
    errors = exc.errors()
    # Simplify the error list for the client
    simplified = [
        {"field": " -> ".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
        for e in errors
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": simplified, "status_code": 422},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions — log and return 500."""
    logger.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "status_code": 500},
    )


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
