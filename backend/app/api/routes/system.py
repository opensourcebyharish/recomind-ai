"""System endpoints: API discovery and health checks."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.logging import get_logger
from app.database.session import get_db
from app.schemas.system import ErrorResponse, HealthResponse, RootResponse

logger = get_logger(__name__)

router = APIRouter(tags=["system"])


@router.get(
    "/",
    response_model=RootResponse,
    summary="API information",
    description="Return basic service information and useful documentation links.",
)
def read_root(request: Request) -> RootResponse:
    settings: Settings = request.app.state.settings
    return RootResponse(
        name=settings.app_name,
        version=settings.app_version,
        description=settings.app_description,
        docs="/docs",
        health="/health",
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Verify that the API is running and the database is reachable.",
    responses={503: {"model": ErrorResponse, "description": "Database unavailable"}},
)
def health_check(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> HealthResponse:
    settings: Settings = request.app.state.settings

    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        raise HTTPException(
            status_code=503,
            detail="Database unavailable.",
        ) from None

    return HealthResponse(
        app=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
    )
