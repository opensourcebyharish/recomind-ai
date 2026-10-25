"""Reusable recommendation service that loads and caches recommenders."""

from __future__ import annotations

import os
from pathlib import Path
from threading import Lock

from app.core.config import PROJECT_ROOT, get_settings
from app.core.logging import get_logger
from ml.data.movielens_preprocess import MovieLensDataError
from ml.data.preprocess import MovieDataError
from ml.recommender.collaborative import ItemBasedCFRecommender
from ml.recommender.content_based import ContentBasedRecommender

logger = get_logger(__name__)

_lock = Lock()
_content_recommender: ContentBasedRecommender | None = None
_content_dataset_path: str | None = None
_cf_recommender: ItemBasedCFRecommender | None = None
_movies_path: str | None = None
_ratings_path: str | None = None


def get_dataset_path() -> Path:
    """Return the path to the dataset used for content-based recommendations."""
    settings = get_settings()
    default_path = PROJECT_ROOT / "data" / "raw" / "sample_movies.csv"
    env_path = getattr(settings, "recommender_dataset_path", None) or os.getenv(
        "RECOMMENDER_DATASET_PATH"
    )
    if env_path:
        return Path(env_path)
    return default_path


def get_movielens_paths() -> tuple[Path, Path]:
    """Return paths to MovieLens movies and ratings CSV files."""
    settings = get_settings()
    movies_env = getattr(settings, "movielens_movies_path", None) or os.getenv(
        "MOVIELENS_MOVIES_PATH"
    )
    ratings_env = getattr(settings, "movielens_ratings_path", None) or os.getenv(
        "MOVIELENS_RATINGS_PATH"
    )
    default_movies = PROJECT_ROOT / "data" / "raw" / "movies.csv"
    default_ratings = PROJECT_ROOT / "data" / "raw" / "ratings.csv"
    movies_path = Path(movies_env) if movies_env else default_movies
    ratings_path = Path(ratings_env) if ratings_env else default_ratings
    return movies_path, ratings_path


def get_recommender(force_reload: bool = False) -> ContentBasedRecommender:
    """Get a cached ContentBasedRecommender fitted on the content dataset."""
    global _content_recommender, _content_dataset_path

    path = get_dataset_path()
    path_str = str(path)

    with _lock:
        if _content_recommender is not None and not force_reload and _content_dataset_path == path_str:
            return _content_recommender

        if not path.exists():
            raise MovieDataError(f"Recommendation dataset not found: {path_str}")

        logger.info("Loading content recommendation dataset from %s", path_str)
        recommender = ContentBasedRecommender().fit_from_csv(path_str)
        _content_recommender = recommender
        _content_dataset_path = path_str
        logger.info("Content recommendation engine initialized with %d movies", len(recommender.movies))
        return _content_recommender


def get_cf_recommender(force_reload: bool = False) -> ItemBasedCFRecommender:
    """Get a cached ItemBasedCFRecommender fitted on MovieLens data."""
    global _cf_recommender, _movies_path, _ratings_path

    movies_path, ratings_path = get_movielens_paths()
    movies_str = str(movies_path)
    ratings_str = str(ratings_path)

    with _lock:
        if (
            _cf_recommender is not None
            and not force_reload
            and _movies_path == movies_str
            and _ratings_path == ratings_str
        ):
            return _cf_recommender

        if not movies_path.exists():
            raise MovieLensDataError(f"MovieLens movies file not found: {movies_str}")
        if not ratings_path.exists():
            raise MovieLensDataError(f"MovieLens ratings file not found: {ratings_str}")

        logger.info("Loading MovieLens data from %s and %s", movies_str, ratings_str)
        recommender = ItemBasedCFRecommender().fit_from_csv(movies_str, ratings_str)
        _cf_recommender = recommender
        _movies_path = movies_str
        _ratings_path = ratings_str
        logger.info("Collaborative filtering engine initialized")
        return _cf_recommender


def reset_recommender() -> None:
    """Reset cached recommenders (useful for tests)."""
    global _content_recommender, _content_dataset_path, _cf_recommender, _movies_path, _ratings_path
    with _lock:
        _content_recommender = None
        _content_dataset_path = None
        _cf_recommender = None
        _movies_path = None
        _ratings_path = None
