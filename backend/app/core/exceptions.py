"""HTTP error handlers that avoid leaking internal details to clients."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Register application-wide exception handlers."""

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        # Log the stack trace server-side, but never return it to the client.
        logger.exception(
            "Unhandled exception while processing %s %s",
            request.method,
            request.url.path,
            exc_info=exc,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred."},
        )
