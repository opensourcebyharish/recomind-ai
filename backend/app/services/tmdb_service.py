"""TMDB API client service."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class TMDBError(Exception):
    """TMDB API error."""


class TMDBClient:
    """Client for TMDB API v3."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.api_key = self.settings.tmdb_api_key
        self.base_url = self.settings.tmdb_base_url
        self.image_base_url = self.settings.tmdb_image_base_url
        self.timeout = httpx.Timeout(10.0, connect=5.0)

    def is_configured(self) -> bool:
        """Check if TMDB API key is configured."""
        return bool(self.api_key and self.api_key.strip())

    async def get_popular(self, page: int = 1) -> dict[str, Any]:
        """Fetch popular movies."""
        if not self.is_configured():
            raise TMDBError("TMDB API key not configured")

        params = {"api_key": self.api_key, "page": page}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(f"{self.base_url}/movie/popular", params=params)
                response.raise_for_status()
                return response.json()
            except httpx.TimeoutException as exc:
                raise TMDBError("TMDB API request timed out") from exc
            except httpx.HTTPStatusError as exc:
                raise TMDBError(f"TMDB API error: {exc.response.status_code}") from exc
            except Exception as exc:
                raise TMDBError(f"TMDB API request failed: {exc}") from exc

    async def search_movies(self, query: str, page: int = 1) -> dict[str, Any]:
        """Search for movies."""
        if not self.is_configured():
            raise TMDBError("TMDB API key not configured")
        if not query or not query.strip():
            raise TMDBError("Search query cannot be empty")

        params = {"api_key": self.api_key, "query": query.strip(), "page": page}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(f"{self.base_url}/search/movie", params=params)
                response.raise_for_status()
                return response.json()
            except httpx.TimeoutException as exc:
                raise TMDBError("TMDB API request timed out") from exc
            except httpx.HTTPStatusError as exc:
                raise TMDBError(f"TMDB API error: {exc.response.status_code}") from exc
            except Exception as exc:
                raise TMDBError(f"TMDB API request failed: {exc}") from exc

    async def get_movie_videos(self, tmdb_movie_id: int) -> dict[str, Any]:
        """Fetch video metadata for a TMDB movie without exposing credentials."""
        return await self._get_json(f"/movie/{tmdb_movie_id}/videos")

    async def get_movie_watch_providers(self, tmdb_movie_id: int, region: str = "IN") -> dict[str, Any]:
        """Fetch regional watch providers for a TMDB movie."""
        return await self._get_json(f"/movie/{tmdb_movie_id}/watch/providers", {"watch_region": region})

    async def get_countries(self) -> list[dict[str, Any]]:
        """Fetch TMDB-supported country codes and display names."""
        data = await self._get_json("/configuration/countries")
        if not isinstance(data, list):
            raise TMDBError("TMDB returned an invalid country list")
        return data

    async def _get_json(self, path: str, extra_params: dict[str, str] | None = None) -> Any:
        """GET a TMDB resource and sanitize errors so credentials stay private."""
        if not self.is_configured():
            raise TMDBError("TMDB API key not configured")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f"{self.base_url}{path}",
                    params={"api_key": self.api_key, **(extra_params or {})},
                )
                response.raise_for_status()
                return response.json()
            except httpx.TimeoutException as exc:
                raise TMDBError("TMDB API request timed out") from exc
            except httpx.HTTPStatusError as exc:
                raise TMDBError(f"TMDB API error: {exc.response.status_code}") from exc
            except (httpx.RequestError, ValueError) as exc:
                # Avoid echoing request URLs: the query string contains api_key.
                raise TMDBError("TMDB API request failed") from exc

    def get_image_url(self, path: str | None, size: str = "w500") -> str | None:
        """Get full image URL from TMDB image path."""
        if not path:
            return None
        return f"{self.image_base_url}/{size}{path}"


tmdb_client = TMDBClient()
