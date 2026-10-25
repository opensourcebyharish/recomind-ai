"""Pydantic response models for system endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RootResponse(BaseModel):
    """Basic API discovery information."""

    name: str = Field(description="Application name")
    version: str = Field(description="Application version")
    description: str = Field(description="Short application description")
    docs: str = Field(description="Path to interactive API documentation")
    health: str = Field(description="Path to the health check endpoint")


class HealthResponse(BaseModel):
    """Health check result."""

    status: Literal["ok"] = "ok"
    app: str
    version: str
    environment: str
    database: Literal["ok"] = "ok"


class ErrorResponse(BaseModel):
    """Generic error payload."""

    detail: str
