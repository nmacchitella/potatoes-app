from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from database import engine, Base, get_settings
from routers import auth_router, google_auth, recipe_router, collection_router, tag_router, social_router, notification_router, ingredient_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Potatoes API",
    description="FamilyKitchen - Collaborative meal planning and recipe management",
    version="1.0.0",
    root_path="",
    servers=[
        {"url": "https://potatoes-backend.fly.dev", "description": "Production"},
        {"url": "http://localhost:8000", "description": "Development"}
    ]
)

# Add session middleware
settings = get_settings()
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    session_cookie="session",
    max_age=3600,
    same_site="lax",
    https_only=False  # Set to True in production
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
