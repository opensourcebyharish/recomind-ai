"""Shared pytest fixtures."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture()
def test_settings(tmp_path: Path) -> Settings:
    """Isolated settings pointing at a temporary SQLite database."""

    database_path = (tmp_path / "test.db").as_posix()
    return Settings(
        _env_file=None,
        app_env="testing",
        debug=False,
        log_level="WARNING",
        database_url=f"sqlite:///{database_path}",
        backend_cors_origins=["http://localhost:5173"],
    )


@pytest.fixture()
def test_app(test_settings: Settings) -> FastAPI:
    """Application instance configured for tests."""

    return create_app(test_settings)


@pytest.fixture()
def client(test_app: FastAPI) -> Iterator[TestClient]:
    """Test client with lifespan events enabled."""

    with TestClient(test_app) as test_client:
        yield test_client
