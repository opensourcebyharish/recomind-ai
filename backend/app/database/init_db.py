"""Safe, explicit database initialization for local development."""

from __future__ import annotations

from sqlalchemy.engine import Engine

from app.database.base import Base
from app.database.migrations import migrate_rating_catalog


def init_db(engine: Engine) -> None:
    """Create missing tables without dropping or altering existing data.

    Models must be imported before this call so they are registered on
    ``Base.metadata``. ``create_all`` only creates missing tables, so explicit
    idempotent migrations run afterward to evolve existing SQLite tables.
    """

    # Importing the package registers model modules; no models exist yet.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    migrate_rating_catalog(engine)
