"""Pydantic schemas for TMDB catalog."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TMDBMovie(BaseModel):
    """TMDB movie in catalog format."""

    id: int = Field(description="TMDB movie ID")
    tmdb_id: int = Field(description="TMDB movie ID (explicit)")
    title: str
    overview: str | None = None
    poster_path: str | None = None
    poster_url: str | None = None
    backdrop_path: str | None = None
    backdrop_url: str | None = None
    genres: str | None = None
    genre_ids: list[int] | None = None
    release_date: str | None = None
    release_year: int | None = None
    vote_average: float | None = None
    vote_count: int | None = None
    source: Literal["tmdb"] = "tmdb"


class TMDBCatalogResponse(BaseModel):
    """Response for TMDB catalog browsing/search."""

    page: int
    results: list[TMDBMovie]
    total_pages: int
    total_results: int
    source: Literal["tmdb"] = "tmdb"
    configured: bool = True


class TMDBVideo(BaseModel):
    """Safe, client-facing video metadata for a TMDB movie."""

    title: str
    site: str
    key: str
    type: str
    official: bool


class TMDBVideosResponse(BaseModel):
    tmdb_movie_id: int
    results: list[TMDBVideo]


class TMDBWatchProvider(BaseModel):
    provider_id: int
    provider_name: str
    logo_path: str | None = None
    display_priority: int | None = None


class TMDBWatchAvailability(BaseModel):
    flatrate: list[TMDBWatchProvider] = Field(default_factory=list)
    free: list[TMDBWatchProvider] = Field(default_factory=list)
    ads: list[TMDBWatchProvider] = Field(default_factory=list)
    rent: list[TMDBWatchProvider] = Field(default_factory=list)
    buy: list[TMDBWatchProvider] = Field(default_factory=list)


class TMDBWatchProvidersResponse(BaseModel):
    tmdb_movie_id: int
    region: str
    link: str | None = None
    availability: TMDBWatchAvailability | None = None
    source: Literal["JustWatch"] = "JustWatch"


class TMDBCountry(BaseModel):
    iso_3166_1: str
    english_name: str
    native_name: str
