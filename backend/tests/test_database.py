"""Tests for database configuration, startup, and session behavior."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core.config import Settings
from app.database.init_db import init_db


def test_startup_creates_database_file(
    client: TestClient,
    test_settings: Settings,
) -> None:
    # The client fixture enters the lifespan context, which initializes the DB.
    assert client.get("/health").status_code == 200

    database_path = Path(test_settings.database_url.removeprefix("sqlite:///"))
    assert database_path.exists()


def test_session_factory_can_query_database(client: TestClient) -> None:
    session_factory = client.app.state.session_factory

    with session_factory() as session:
        assert session.execute(text("SELECT 1")).scalar_one() == 1


def test_engine_is_bound_to_configured_database(
    client: TestClient,
    test_settings: Settings,
) -> None:
    engine = client.app.state.db_engine

    assert str(engine.url) == test_settings.database_url
    assert engine.dialect.name == "sqlite"


def test_startup_migrates_legacy_ratings_without_losing_rows(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    try:
        with engine.begin() as connection:
            connection.execute(text(
                "CREATE TABLE user_movie_ratings ("
                "id INTEGER PRIMARY KEY, user_id VARCHAR NOT NULL, movie_id VARCHAR NOT NULL, "
                "rating FLOAT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "CONSTRAINT uq_user_movie_rating UNIQUE (user_id, movie_id))"
            ))
            connection.execute(text("INSERT INTO user_movie_ratings (id, user_id, movie_id, rating) VALUES (1, 'legacy-user', 'm001', 4.5)"))

        init_db(engine)

        with engine.connect() as connection:
            saved = connection.execute(text("SELECT user_id, movie_id, catalog, rating FROM user_movie_ratings WHERE id=1")).one()
            assert tuple(saved) == ("legacy-user", "m001", "local", 4.5)
        # A repeated startup/migration must be harmless and keep the record.
        init_db(engine)
        with engine.connect() as connection:
            assert connection.execute(text("SELECT COUNT(*) FROM user_movie_ratings")).scalar_one() == 1
    finally:
        engine.dispose()
