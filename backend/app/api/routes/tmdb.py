"""TMDB catalog endpoints."""

from __future__ import annotations

from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Path, Query

from app.core.logging import get_logger
from app.schemas.tmdb import (
    TMDBCatalogResponse,
    TMDBCountry,
    TMDBMovie,
    TMDBVideo,
    TMDBVideosResponse,
    TMDBWatchAvailability,
    TMDBWatchProvidersResponse,
)
from app.services.tmdb_service import TMDBError, tmdb_client

logger = get_logger(__name__)

router = APIRouter(prefix="/tmdb", tags=["tmdb"])


def _safe_https_link(value: object) -> str | None:
    """Accept only absolute HTTPS destinations returned by TMDB."""
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").lower()
    trusted_host = any(hostname == domain or hostname.endswith(f".{domain}") for domain in ("themoviedb.org", "justwatch.com"))
    if parsed.scheme != "https" or not trusted_host or parsed.username or parsed.password or parsed.port not in (None, 443):
        return None
    return value


def _format_tmdb_movie(movie: dict) -> TMDBMovie:
    """Format TMDB movie dict to our schema."""
    release_date = movie.get("release_date")
    release_year = None
    if release_date and len(release_date) >= 4:
        try:
            release_year = int(release_date[:4])
        except ValueError:
            pass

    return TMDBMovie(
        id=movie["id"],
        tmdb_id=movie["id"],
        title=movie.get("title", ""),
        overview=movie.get("overview"),
        poster_path=movie.get("poster_path"),
        poster_url=tmdb_client.get_image_url(movie.get("poster_path"), "w500"),
        backdrop_path=movie.get("backdrop_path"),
        backdrop_url=tmdb_client.get_image_url(movie.get("backdrop_path"), "w780"),
        genre_ids=movie.get("genre_ids"),
        release_date=release_date,
        release_year=release_year,
        vote_average=movie.get("vote_average"),
        vote_count=movie.get("vote_count"),
        source="tmdb",
    )


@router.get("/popular", response_model=TMDBCatalogResponse)
async def get_popular_movies(page: int = Query(1, ge=1, le=500)) -> TMDBCatalogResponse:
    """Get popular movies from TMDB."""
    if not tmdb_client.is_configured():
        raise HTTPException(
            status_code=503,
            detail="TMDB API key not configured. Set TMDB_API_KEY in environment.",
        )

    try:
        data = await tmdb_client.get_popular(page=page)
        movies = [_format_tmdb_movie(m) for m in data.get("results", [])]
        return TMDBCatalogResponse(
            page=data.get("page", page),
            results=movies,
            total_pages=data.get("total_pages", 0),
            total_results=data.get("total_results", 0),
            source="tmdb",
            configured=True,
        )
    except TMDBError as exc:
        logger.warning("TMDB error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error fetching popular movies from TMDB")
        raise HTTPException(status_code=500, detail="Failed to fetch movies from TMDB") from exc


@router.get("/search", response_model=TMDBCatalogResponse)
async def search_movies(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, le=500),
) -> TMDBCatalogResponse:
    """Search movies on TMDB."""
    if not tmdb_client.is_configured():
        raise HTTPException(
            status_code=503,
            detail="TMDB API key not configured. Set TMDB_API_KEY in environment.",
        )

    try:
        data = await tmdb_client.search_movies(query=q, page=page)
        movies = [_format_tmdb_movie(m) for m in data.get("results", [])]
        return TMDBCatalogResponse(
            page=data.get("page", page),
            results=movies,
            total_pages=data.get("total_pages", 0),
            total_results=data.get("total_results", 0),
            source="tmdb",
            configured=True,
        )
    except TMDBError as exc:
        logger.warning("TMDB error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error searching movies on TMDB")
        raise HTTPException(status_code=500, detail="Failed to search movies on TMDB") from exc


@router.get("/status")
async def tmdb_status():
    """Check TMDB configuration status."""
    return {
        "configured": tmdb_client.is_configured(),
        "message": "TMDB API configured" if tmdb_client.is_configured() else "TMDB API key not configured",
    }


@router.get("/movies/{tmdb_movie_id}/videos", response_model=TMDBVideosResponse)
async def get_movie_videos(tmdb_movie_id: int = Path(..., gt=0, description="TMDB movie ID")) -> TMDBVideosResponse:
    """Return safe video metadata; official YouTube trailers are ordered first."""
    if not tmdb_client.is_configured():
        raise HTTPException(status_code=503, detail="TMDB API key not configured")
    try:
        data = await tmdb_client.get_movie_videos(tmdb_movie_id)
        videos = [
            TMDBVideo(
                title=item["name"],
                site=item["site"],
                key=item["key"],
                type=item["type"],
                official=bool(item.get("official", False)),
            )
            for item in data.get("results", [])
            if all(isinstance(item.get(field), str) and item[field].strip() for field in ("name", "site", "key", "type"))
        ]
        videos.sort(key=lambda video: (video.site.lower() != "youtube" or video.type.lower() != "trailer" or not video.official, video.title.casefold()))
        return TMDBVideosResponse(tmdb_movie_id=tmdb_movie_id, results=videos)
    except TMDBError as exc:
        logger.warning("TMDB video lookup failed for movie %s: %s", tmdb_movie_id, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error fetching TMDB videos")
        raise HTTPException(status_code=500, detail="Failed to fetch movie videos from TMDB") from exc


@router.get("/movies/{tmdb_movie_id}/watch-providers", response_model=TMDBWatchProvidersResponse)
async def get_movie_watch_providers(
    tmdb_movie_id: int = Path(..., gt=0, description="TMDB movie ID"),
    region: str = Query("IN", pattern=r"^[A-Za-z]{2}$", description="ISO 3166-1 country code"),
) -> TMDBWatchProvidersResponse:
    """Return legal watch-provider listings for a TMDB movie and region."""
    if not tmdb_client.is_configured():
        raise HTTPException(status_code=503, detail="TMDB API key not configured")
    normalized_region = region.upper()
    try:
        data = await tmdb_client.get_movie_watch_providers(tmdb_movie_id, normalized_region)
        regional_data = data.get("results", {}).get(normalized_region)
        availability = None
        link = None
        if isinstance(regional_data, dict):
            link = _safe_https_link(regional_data.get("link"))
            categories = {key: regional_data.get(key) or [] for key in ("flatrate", "free", "ads", "rent", "buy")}
            availability = TMDBWatchAvailability(**categories)
        return TMDBWatchProvidersResponse(
            tmdb_movie_id=tmdb_movie_id,
            region=normalized_region,
            link=link,
            availability=availability,
        )
    except TMDBError as exc:
        logger.warning("TMDB provider lookup failed for movie %s in %s: %s", tmdb_movie_id, normalized_region, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error fetching TMDB watch providers")
        raise HTTPException(status_code=500, detail="Failed to fetch watch providers from TMDB") from exc


@router.get("/countries", response_model=list[TMDBCountry])
async def get_tmdb_countries() -> list[TMDBCountry]:
    """Return country choices supported by TMDB for regional availability."""
    if not tmdb_client.is_configured():
        raise HTTPException(status_code=503, detail="TMDB API key not configured")
    try:
        return [
            TMDBCountry(**country)
            for country in await tmdb_client.get_countries()
            if all(isinstance(country.get(key), str) and country[key] for key in ("iso_3166_1", "english_name", "native_name"))
        ]
    except TMDBError as exc:
        logger.warning("TMDB country lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error fetching TMDB countries")
        raise HTTPException(status_code=500, detail="Failed to fetch supported regions from TMDB") from exc
