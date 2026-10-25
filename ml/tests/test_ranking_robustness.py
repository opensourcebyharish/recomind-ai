"""Additional tests for recommendation robustness."""

from __future__ import annotations

import pandas as pd
import pytest

from ml.data.movielens_preprocess import MovieLensDataError
from ml.data.preprocess import MovieDataError
from ml.recommender.content_based import ContentBasedRecommender
from ml.recommender.collaborative import ItemBasedCFRecommender


def test_content_based_empty_dataset() -> None:
    rec = ContentBasedRecommender()
    with pytest.raises(MovieDataError):
        rec.fit(pd.DataFrame())


def test_content_based_sparse_user_insufficient_history() -> None:
    df = pd.DataFrame(
        [
            {"movie_id": "s1", "title": "A", "genres": "Drama", "overview": "test", "release_year": 2020, "vote_average": 7.0},
            {"movie_id": "s2", "title": "B", "genres": "Comedy", "overview": "other", "release_year": 2021, "vote_average": 7.5},
        ]
    )
    rec = ContentBasedRecommender().fit(df)
    # Single liked item should work
    results = rec.recommend_from_liked(["s1"], top_n=1)
    assert len(results) == 1
    assert results[0].movie_id == "s2"


def test_content_based_excludes_already_rated() -> None:
    df = pd.DataFrame(
        [
            {"movie_id": "x1", "title": "A", "genres": "Drama", "overview": "a", "release_year": 2020, "vote_average": 7.0},
            {"movie_id": "x2", "title": "B", "genres": "Drama", "overview": "b", "release_year": 2020, "vote_average": 7.0},
            {"movie_id": "x3", "title": "C", "genres": "Comedy", "overview": "c", "release_year": 2020, "vote_average": 7.0},
        ]
    )
    rec = ContentBasedRecommender().fit(df)
    results = rec.recommend_similar("x1", top_n=10, exclude_rated_by_user=["x2"])
    assert all(r.movie_id != "x2" for r in results)


def test_cf_excludes_already_rated() -> None:
    rec = ItemBasedCFRecommender().fit_from_csv("data/raw/movies.csv", "data/raw/ratings.csv")
    user_id = 1
    recs = rec.recommend_for_user(user_id, top_n=10, exclude_rated=True)
    import pandas as pd
    ratings = pd.read_csv("data/raw/ratings.csv")
    rated = set(ratings[ratings["userId"] == user_id]["movieId"].astype(str))
    for r in recs:
        assert r.movie_id not in rated


def test_cf_user_with_few_ratings() -> None:
    rec = ItemBasedCFRecommender().fit_from_csv("data/raw/movies.csv", "data/raw/ratings.csv")
    # Find a user with few ratings
    ratings = pd.read_csv("data/raw/ratings.csv")
    user_counts = ratings.groupby("userId").size()
    sparse_user = user_counts[user_counts < 5].index[0] if len(user_counts[user_counts < 5]) > 0 else 1
    recs = rec.recommend_for_user(int(sparse_user), top_n=5)
    assert isinstance(recs, list)


def test_content_based_deterministic_ranking() -> None:
    df = pd.DataFrame(
        [
            {"movie_id": "d1", "title": "A", "genres": "Drama", "overview": "test drama", "release_year": 2020, "vote_average": 7.0},
            {"movie_id": "d2", "title": "B", "genres": "Drama", "overview": "test drama", "release_year": 2020, "vote_average": 7.0},
            {"movie_id": "d3", "title": "C", "genres": "Drama", "overview": "other", "release_year": 2020, "vote_average": 7.0},
        ]
    )
    rec = ContentBasedRecommender().fit(df)
    r1 = rec.recommend_similar("d1", top_n=3)
    r2 = rec.recommend_similar("d1", top_n=3)
    assert [x.movie_id for x in r1] == [x.movie_id for x in r2]
