"""Database engine, session factory, and FastAPI session dependency."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings


def create_db_engine(settings: Settings) -> Engine:
    """Create a SQLAlchemy engine from application settings."""

    connect_args: dict[str, Any] = {}
    if settings.database_url.startswith("sqlite"):
        # SQLite connections are used by FastAPI worker threads.
        connect_args["check_same_thread"] = False

    return create_engine(
        settings.database_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Create a session factory bound to the given engine."""

    return sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def get_db(request: Request) -> Iterator[Session]:
    """Yield a database session and guarantee it is closed afterwards."""

    session_factory: sessionmaker[Session] = request.app.state.session_factory
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
