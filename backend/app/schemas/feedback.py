"""Pydantic schemas for user feedback."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ValidationInfo, field_validator


class RatingRequest(BaseModel):
    """Request to rate a movie."""

    user_id: str = Field(description="Demo user identifier (no authentication)")
    catalog: Literal["local", "tmdb"] = Field(default="local", description="Movie ID namespace")
    movie_id: str = Field(description="Movie identifier")
    rating: float = Field(ge=1.0, le=5.0, description="Rating on 1-5 scale")

    @field_validator("movie_id")
    @classmethod
    def validate_movie_id(cls, v: str, info: ValidationInfo) -> str:
        if not v or not str(v).strip():
            raise ValueError("movie_id cannot be empty")
        movie_id = str(v).strip()
        catalog = info.data.get("catalog", "local")
        if catalog == "tmdb" and not re.fullmatch(r"tmdb:[1-9][0-9]*", movie_id):
            raise ValueError("TMDB movie IDs must use the tmdb:<positive-id> format")
        if catalog == "local" and movie_id.startswith("tmdb:"):
            raise ValueError("TMDB movie IDs must use catalog='tmdb'")
        return movie_id

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        if not v or not str(v).strip():
            raise ValueError("user_id cannot be empty")
        return str(v).strip()


class FeedbackRequest(BaseModel):
    """Request to like or dislike a movie."""

    user_id: str = Field(description="Demo user identifier (no authentication)")
    movie_id: str = Field(description="Movie identifier")
    feedback_type: Literal["like", "dislike"] = Field(description="Feedback type")

    @field_validator("movie_id")
    @classmethod
    def validate_movie_id(cls, v: str) -> str:
        if not v or not str(v).strip():
            raise ValueError("movie_id cannot be empty")
        return str(v).strip()

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        if not v or not str(v).strip():
            raise ValueError("user_id cannot be empty")
        return str(v).strip()


class InteractionRequest(BaseModel):
    """Record an observed impression or movie-details open for a demo user."""

    user_id: str = Field(description="Demo user identifier (no authentication)")
    movie_id: str = Field(description="Movie identifier")
    interaction_type: Literal["click", "view"] = Field(description="Interaction type")

    @field_validator("movie_id")
    @classmethod
    def validate_movie_id(cls, v: str) -> str:
        if not v or not str(v).strip():
            raise ValueError("movie_id cannot be empty")
        return str(v).strip()

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        if not v or not str(v).strip():
            raise ValueError("user_id cannot be empty")
        return str(v).strip()


class RatingResponse(BaseModel):
    """Response after rating a movie."""

    id: int
    user_id: str
    movie_id: str
    catalog: Literal["local", "tmdb"] = "local"
    rating: float
    created_at: datetime
    updated_at: datetime


class FeedbackResponse(BaseModel):
    """Response after feedback action."""

    id: int
    user_id: str
    movie_id: str
    feedback_type: str
    created_at: datetime
    updated_at: datetime


class InteractionResponse(BaseModel):
    """Persisted interaction returned after a successful write."""

    status: Literal["ok"] = "ok"
    id: int
    movie_id: str
    interaction_type: Literal["click", "view"]
    created_at: datetime


class InteractionHistoryItem(BaseModel):
    """An interaction row returned by the history endpoint."""

    id: int
    movie_id: str
    interaction_type: Literal["click", "view"]
    created_at: datetime


class UserFeedbackHistoryResponse(BaseModel):
    """User's feedback history."""

    user_id: str
    ratings: list[RatingResponse]
    feedback: list[FeedbackResponse]
    interactions: list[InteractionHistoryItem]
