"""MovieLens dataset validation and preprocessing utilities."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


class MovieLensDataError(ValueError):
    """Raised for invalid MovieLens dataset issues."""


REQUIRED_MOVIES_COLUMNS = {"movieId", "title", "genres"}
REQUIRED_RATINGS_COLUMNS = {"userId", "movieId", "rating", "timestamp"}


def validate_movies_df(df: pd.DataFrame) -> None:
    """Validate movies dataframe has required columns and no issues."""
    missing = REQUIRED_MOVIES_COLUMNS - set(df.columns)
    if missing:
        raise MovieLensDataError(f"Missing required columns in movies: {sorted(list(missing))}")
    if df.empty:
        raise MovieLensDataError("Movies dataset is empty")
    if df["movieId"].isna().any():
        raise MovieLensDataError("Missing movieId values in movies")
    dups = df[df["movieId"].duplicated()]["movieId"].unique()
    if len(dups) > 0:
        raise MovieLensDataError(f"Duplicate movieId values found: {sorted(list(dups))}")


def validate_ratings_df(df: pd.DataFrame) -> None:
    """Validate ratings dataframe has required columns and valid values."""
    missing = REQUIRED_RATINGS_COLUMNS - set(df.columns)
    if missing:
        raise MovieLensDataError(f"Missing required columns in ratings: {sorted(list(missing))}")
    if df.empty:
        raise MovieLensDataError("Ratings dataset is empty")
    for col in ["userId", "movieId"]:
        if df[col].isna().any():
            raise MovieLensDataError(f"Missing {col} values in ratings")
    if df["rating"].isna().any():
        raise MovieLensDataError("Missing rating values in ratings")
    # Check rating range (MovieLens typical 0.5-5.0)
    if (df["rating"] < 0).any() or (df["rating"] > 5.5).any():
        raise MovieLensDataError("Ratings contain values outside expected range [0, 5.5]")
    dups = df[df.duplicated(["userId", "movieId"])]
    if len(dups) > 0:
        raise MovieLensDataError("Duplicate (userId, movieId) rating entries found")


def load_movielens(movies_path: str, ratings_path: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load and validate MovieLens datasets."""
    try:
        movies_df = pd.read_csv(movies_path)
    except FileNotFoundError as exc:
        raise MovieLensDataError(f"Movies file not found: {movies_path}") from exc
    except Exception as exc:
        raise MovieLensDataError(f"Failed to read movies CSV: {exc}") from exc

    try:
        ratings_df = pd.read_csv(ratings_path)
    except FileNotFoundError as exc:
        raise MovieLensDataError(f"Ratings file not found: {ratings_path}") from exc
    except Exception as exc:
        raise MovieLensDataError(f"Failed to read ratings CSV: {exc}") from exc

    validate_movies_df(movies_df)
    validate_ratings_df(ratings_df)

    # Ensure types
    movies_df = movies_df.copy()
    ratings_df = ratings_df.copy()
    movies_df["movieId"] = movies_df["movieId"].astype(int)
    ratings_df["userId"] = ratings_df["userId"].astype(int)
    ratings_df["movieId"] = ratings_df["movieId"].astype(int)
    ratings_df["rating"] = ratings_df["rating"].astype(float)

    # Check referential integrity
    movie_ids = set(movies_df["movieId"].unique())
    rating_movie_ids = set(ratings_df["movieId"].unique())
    missing_refs = rating_movie_ids - movie_ids
    if missing_refs:
        raise MovieLensDataError(
            f"Ratings reference {len(missing_refs)} movieIds not found in movies"
        )

    return movies_df, ratings_df


def build_user_item_matrix(ratings_df: pd.DataFrame) -> tuple[pd.DataFrame, dict[int, int], dict[int, int]]:
    """Build user-item rating matrix. Returns (matrix, user_to_idx, movie_to_idx)."""
    # Create mappings
    user_ids = sorted(ratings_df["userId"].unique())
    movie_ids = sorted(ratings_df["movieId"].unique())
    user_to_idx = {uid: idx for idx, uid in enumerate(user_ids)}
    movie_to_idx = {mid: idx for idx, mid in enumerate(movie_ids)}
    idx_to_movie = {idx: mid for mid, idx in movie_to_idx.items()}

    # Build matrix (users x movies)
    matrix = np.zeros((len(user_ids), len(movie_ids)))
    for _, row in ratings_df.iterrows():
        u_idx = user_to_idx[int(row["userId"])]
        m_idx = movie_to_idx[int(row["movieId"])]
        matrix[u_idx, m_idx] = float(row["rating"])

    matrix_df = pd.DataFrame(matrix, index=user_ids, columns=movie_ids)
    return matrix_df, user_to_idx, movie_to_idx
