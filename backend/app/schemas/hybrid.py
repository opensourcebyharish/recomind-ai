"""Pydantic schemas for hybrid personalized recommendations."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HybridRecommendationItem(BaseModel):
    """A single hybrid recommendation item."""

    movie_id: str = Field(description="Movie identifier (local/MovieLens only, no TMDB)")
    title: str
    genres: str
    release_year: int | None = None
    vote_average: float | None = None
    score: float
    explanation: str
    source: Literal["content", "collaborative", "hybrid"]


class HybridRecommendationResponse(BaseModel):
    """Response for personalized hybrid recommendations."""

    user_id: str
    catalog: Literal["local"] = Field(description="Movie catalog used by this application feedback result")
    count: int
    recommendations: list[HybridRecommendationItem]
    strategy: str
