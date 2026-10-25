"""Data preprocessing utilities for movie metadata."""

from __future__ import annotations

import pandas as pd


class MovieDataError(ValueError):
    """Raised for invalid or missing movie data."""


REQUIRED_COLUMNS = {"movie_id", "title", "genres", "overview", "release_year", "vote_average"}


def ensure_required_columns(df: pd.DataFrame, required: set[str] | None = None) -> None:
    """Validate that all required columns are present."""
    req = required or REQUIRED_COLUMNS
    missing = req - set(df.columns)
    if missing:
        raise MovieDataError(f"Missing required columns: {sorted(list(missing))}")


def normalize_genres(genres: object) -> str:
    """Normalize genre strings to pipe-separated form."""
    if genres is None or (isinstance(genres, float) and pd.isna(genres)):
        return ""
    s = str(genres).strip()
    if not s:
        return ""
    # Keep pipe separator; collapse extra whitespace
    parts = [p.strip() for p in s.replace(";", "|").split("|")]
    parts = [p for p in parts if p]
    return "|".join(parts)


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Clean and normalize movie metadata without silently dropping everything."""
    if df.empty:
        raise MovieDataError("Dataset is empty")

    out = df.copy()

    # Detect duplicate IDs
    ids = out["movie_id"].astype(str)
    duplicates = ids[ids.duplicated()].unique()
    if len(duplicates) > 0:
        raise MovieDataError(f"Duplicate movie_id values found: {sorted(list(duplicates))}")

    out["movie_id"] = ids
    out["title"] = out["title"].fillna("").astype(str).str.strip()
    out["genres"] = out["genres"].apply(normalize_genres)
    out["overview"] = out["overview"].fillna("").astype(str).str.strip()

    # Coerce numeric fields safely
    out["release_year"] = pd.to_numeric(out["release_year"], errors="coerce")
    out["vote_average"] = pd.to_numeric(out["vote_average"], errors="coerce")

    # Drop rows missing critical identifiers
    out = out[out["movie_id"].str.len() > 0]
    out = out[out["title"].str.len() > 0]
    if out.empty:
        raise MovieDataError("No valid rows after basic normalization")

    out = out.reset_index(drop=True)
    return out


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Combine genres and overview into a single text feature."""
    out = df.copy()
    genres_text = out["genres"].str.replace("|", " ")
    overview_text = out["overview"]
    features = (genres_text + " " + overview_text).str.strip()
    features = features.replace("", "unknown")
    out["features"] = features
    return out
