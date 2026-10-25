"""Application settings loaded from environment variables and optional .env files."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration.

    Values are read from environment variables first, then from the project
    ``.env`` file, then from ``backend/.env``. Environment variable names are
    case-insensitive (for example, ``DATABASE_URL``).
    """

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "RecoMind AI"
    app_version: str = "0.1.0"
    app_description: str = (
        "Personalized movie recommendations powered by ratings, preferences, "
        "and feedback."
    )
    app_env: Literal["development", "testing", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    database_url: str = "sqlite:///./recomind.db"

    backend_cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    # TMDB API configuration
    tmdb_api_key: str | None = Field(default=None, alias="TMDB_API_KEY")
    tmdb_base_url: str = "https://api.themoviedb.org/3"
    tmdb_image_base_url: str = "https://image.tmdb.org/t/p"


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance for application startup."""

    return Settings()
