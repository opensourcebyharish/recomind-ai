"""Small, idempotent schema migrations for the SQLite application database."""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def migrate_rating_catalog(engine: Engine) -> bool:
    """Add an explicit rating catalog column, preserving old rows as local.

    Returns True when the column was added. Existing ratings were written only
    for local catalog movies, so the SQLite server default safely classifies
    those historical records as ``local``.
    """
    if engine.dialect.name != "sqlite":
        raise RuntimeError("The rating catalog migration currently supports SQLite only")

    inspector = inspect(engine)
    if not inspector.has_table("user_movie_ratings"):
        raise RuntimeError("user_movie_ratings table does not exist; initialize the database first")
    if any(column["name"] == "catalog" for column in inspector.get_columns("user_movie_ratings")):
        return False

    with engine.begin() as connection:
        # Recheck in the transaction to avoid repeating the DDL after a second
        # process has already applied this idempotent migration.
        columns = inspect(connection).get_columns("user_movie_ratings")
        if any(column["name"] == "catalog" for column in columns):
            return False
        connection.execute(text(
            "ALTER TABLE user_movie_ratings "
            "ADD COLUMN catalog VARCHAR(16) NOT NULL DEFAULT 'local'"
        ))
    return True
