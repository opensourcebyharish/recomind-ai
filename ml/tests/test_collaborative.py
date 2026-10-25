"""Tests for MovieLens data validation and collaborative filtering."""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import pytest

from ml.data.movielens_preprocess import (
    MovieLensDataError,
    load_movielens,
    validate_movies_df,
    validate_ratings_df,
)
from ml.recommender.collaborative import ItemBasedCFRecommender


def test_load_movielens_real_data() -> None:
    movies_df, ratings_df = load_movielens("data/raw/movies.csv", "data/raw/ratings.csv")
    assert len(movies_df) > 9000
    assert len(ratings_df) > 100000
    assert "movieId" in movies_df.columns
    assert "userId" in ratings_df.columns


def test_validate_movies_missing_columns() -> None:
    df = pd.DataFrame({"movieId": [1], "title": ["Test"]})
    with pytest.raises(MovieLensDataError):
        validate_movies_df(df)


def test_validate_ratings_invalid_range() -> None:
    df = pd.DataFrame({"userId": [1], "movieId": [1], "rating": [6.0], "timestamp": [123]})
    with pytest.raises(MovieLensDataError):
        validate_ratings_df(df)


def test_cf_recommends_for_user_excludes_rated() -> None:
    rec = ItemBasedCFRecommender().fit_from_csv("data/raw/movies.csv", "data/raw/ratings.csv")
    user_id = 1
    recs = rec.recommend_for_user(user_id, top_n=10)
    ratings = pd.read_csv("data/raw/ratings.csv")
    rated = set(ratings[ratings["userId"] == user_id]["movieId"].astype(str))
    for r in recs:
        assert r.movie_id not in rated


def test_cf_unknown_user_raises_error() -> None:
    rec = ItemBasedCFRecommender().fit_from_csv("data/raw/movies.csv", "data/raw/ratings.csv")
    with pytest.raises(MovieLensDataError):
        rec.recommend_for_user(99999, top_n=10)


def test_cf_deterministic_results() -> None:
    rec = ItemBasedCFRecommender().fit_from_csv("data/raw/movies.csv", "data/raw/ratings.csv")
    r1 = rec.recommend_for_user(1, top_n=5)
    r2 = rec.recommend_for_user(1, top_n=5)
    ids1 = [r.movie_id for r in r1]
    ids2 = [r.movie_id for r in r2]
    scores1 = [r.score for r in r1]
    scores2 = [r.score for r in r2]
    assert ids1 == ids2
    assert scores1 == scores2


def test_cf_returns_required_fields() -> None:
    rec = ItemBasedCFRecommender().fit_from_csv("data/raw/movies.csv", "data/raw/ratings.csv")
    recs = rec.recommend_for_user(2, top_n=3)
    for r in recs:
        assert r.movie_id
        assert r.title
        assert r.genres
        assert isinstance(r.score, float)
        assert r.explanation
