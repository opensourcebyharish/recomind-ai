"""FastAPI application factory and entry point."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.database.init_db import init_db
from app.database.session import create_db_engine, create_session_factory

logger = get_logger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and configure the FastAPI application."""

    app_settings = settings or get_settings()
    configure_logging(app_settings.log_level)

    engine = create_db_engine(app_settings)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if app_settings.app_env == "production":
            logger.info(
                "Production environment detected; skipping automatic schema creation. "
                "Run Alembic migrations before serving traffic."
            )
        else:
            init_db(engine)
            logger.info("Database schema initialized for %s", app_settings.app_env)

        logger.info("%s v%s starting", app_settings.app_name, app_settings.app_version)
        try:
            yield
        finally:
            engine.dispose()
            logger.info("%s shutdown complete", app_settings.app_name)

    application = FastAPI(
        title=app_settings.app_name,
        description=app_settings.app_description,
        version=app_settings.app_version,
        debug=app_settings.debug,
        lifespan=lifespan,
    )

    application.state.settings = app_settings
    application.state.db_engine = engine
    application.state.session_factory = session_factory

    application.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.backend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router)
    register_exception_handlers(application)

    return application


app = create_app()
