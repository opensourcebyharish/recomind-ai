"""Pydantic schemas for recommendation requests and responses."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class RecommendationItem(BaseModel):
    """A single recommendation item."""

    movie_id: str = Field(description="Movie identifier")
    title: str = Field(description="Movie title")
    genres: str = Field(description="Pipe-separated genre list")
    release_year: int | None = Field(default=None, description="Release year if available")
    vote_average: float | None = Field(default=None, description="Average vote if available")
    similarity_score: float | None = Field(default=None, description="Content similarity score from TF-IDF and cosine similarity")
    score: float | None = Field(default=None, description="Collaborative filtering score")
    explanation: str = Field(description="Why this movie was recommended")


class RecommendationRequest(BaseModel):
    """Request body for recommendations."""

    mode: Literal["similar", "liked"] = Field(
        default="similar",
        description="Recommendation mode: 'similar' for a single movie, 'liked' for multiple liked movies",
    )
    algorithm: Literal["content", "collaborative"] = Field(
        default="content",
        description="Recommendation algorithm: 'content' for content-based, 'collaborative' for item-based CF",
    )
    movie_id: str | None = Field(default=None, description="Source movie ID when mode='similar'")
    liked_movie_ids: list[str] | None = Field(
        default=None, description="List of liked movie IDs when mode='liked'"
    )
    user_id: int | None = Field(
        default=None,
        description="MovieLens userId used only when algorithm='collaborative'; separate from application feedback IDs",
    )
    top_n: int = Field(default=5, ge=1, le=50, description="Number of recommendations to return")
    genre_preference: str | list[str] | None = Field(
        default=None, description="Optional genre filter (single genre or list)"
    )
    min_vote_average: float | None = Field(
        default=None, ge=0, le=10, description="Minimum vote_average to include"
    )
    exclude_ids: list[str] | None = Field(default=None, description="Movie IDs to exclude")
    exclude_rated_by_user: list[str] | None = Field(
        default=None, description="Movies already rated by the user to exclude"
    )

    @field_validator("liked_movie_ids")
    @classmethod
    def validate_liked(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if len(v) == 0:
            raise ValueError("liked_movie_ids must contain at least one movie_id")
        cleaned = [str(x).strip() for x in v if str(x).strip()]
        if len(cleaned) == 0:
            raise ValueError("liked_movie_ids must contain at least one valid movie_id")
        return cleaned

    @field_validator("movie_id")
    @classmethod
    def validate_movie_id(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if str(v).strip() == "":
            raise ValueError("movie_id cannot be empty")
        return str(v).strip()


class RecommendationResponse(BaseModel):
    """Response containing ranked recommendations."""

    mode: Literal["similar", "liked"]
    algorithm: Literal["content", "collaborative"] = "content"
    source_movie_id: str | None = None
    liked_movie_ids: list[str] | None = None
    user_id: int | None = None
    catalog: Literal["local", "movielens"] = Field(description="Catalog namespace for all returned movie IDs")
    count: int
    recommendations: list[RecommendationItem]
    dataset: str = Field(description="Dataset used for recommendations")
