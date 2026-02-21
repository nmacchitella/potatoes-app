"""
Application Configuration

Centralized configuration management using pydantic-settings.
All configuration values can be overridden via environment variables or .env file.
"""

import logging
import sys
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Potatoes API"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./potatoes.db"

    # Security
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # URLs
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Email
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = "noreply@potatoes.app"
    mail_server: str = "smtp.gmail.com"
    mail_port: int = 587
    mail_starttls: bool = True
    mail_ssl_tls: bool = False

    # External APIs
    gemini_api_key: str = ""

    # Cloudinary Storage
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Logging
    log_level: str = "INFO"

    # Admin user (promoted to admin on startup if set)
    admin_email: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra env vars


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    s = Settings()
    if not s.secret_key:
        raise RuntimeError(
            "SECRET_KEY environment variable is not set. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return s


def setup_logging(settings: Settings) -> logging.Logger:
    """Configure application logging."""
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )

    # Create application logger
    logger = logging.getLogger("potatoes")
    logger.setLevel(log_level)

    return logger


# Global instances
settings = get_settings()
logger = setup_logging(settings)
