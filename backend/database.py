from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite:///./potatoes.db"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    google_client_id: str = ""
    google_client_secret: str = ""
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    # Email settings
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = "noreply@potatoes.app"
    mail_server: str = "smtp.gmail.com"
    mail_port: int = 587
    mail_starttls: str = "True"
    mail_ssl_tls: str = "False"

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()

# SQLite needs check_same_thread=False
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for database sessions"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
