"""Unit tests for the content-based recommender."""

from __future__ import annotations

import pandas as pd
import pytest

from ml.data.preprocess import MovieDataError
from ml.recommender.content_based import ContentBasedRecommender


@pytest.fixture()
def sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "movie_id": "a1",
                "title": "Space Quest",
                "genres": "Sci-Fi|Adventure",
                "overview": "Spaceship crew explores distant galaxy and alien artifacts.",
                "release_year": 2020,
                "vote_average": 8.0,
            },
            {
                "movie_id": "a2",
                "title": "Galaxy Run",
                "genres": "Sci-Fi|Action",
                "overview": "Racing across star systems to stop an energy weapon.",
                "release_year": 2021,
                "vote_average": 7.8,
            },
            {
                "movie_id": "a3",
                "title": "Desert Outlaw",
                "genres": "Western|Action",
                "overview": "Sheriff tracks bandits through harsh desert canyons.",
                "release_year": 2019,
                "vote_average": 7.5,
            },
            {
                "movie_id": "a4",
                "title": "Paris Romance",
                "genres": "Romance|Comedy",
                "overview": "Two writers fall in love in Paris cafes.",
                "release_year": 2018,
                "vote_average": 7.7,
            },
            {
                "movie_id": "a5",
                "title": "Nebula Mystery",
                "genres": "Sci-Fi|Mystery",
                "overview": "Crew investigates strange signals in a nebula.",
                "release_year": 2022,
                "vote_average": 7.9,
            },
        ]
    )


def test_similar_movies_rank_above_unrelated(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    results = rec.recommend_similar("a1", top_n=3)
    titles = [r.title for r in results]
    # Sci-Fi related should appear before Western/Romance
    assert "Desert Outlaw" not in titles[:2]
    assert "Paris Romance" not in titles[:2]
    assert any(t in ("Galaxy Run", "Nebula Mystery") for t in titles)


def test_recommendations_do_not_include_source_movie(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    results = rec.recommend_similar("a1", top_n=5)
    assert all(r.movie_id != "a1" for r in results)


def test_multiple_liked_movies_produce_unique_results(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    results = rec.recommend_from_liked(["a1", "a2"], top_n=5)
    ids = [r.movie_id for r in results]
    assert len(ids) == len(set(ids))


def test_genre_filtering_works(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    results = rec.recommend_similar("a1", top_n=5, genre_preference="Western")
    assert all("Western" in r.genres for r in results)


def test_min_rating_filtering_works(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    results = rec.recommend_similar("a1", top_n=5, min_vote_average=7.9)
    assert all(r.vote_average is not None and r.vote_average >= 7.9 for r in results)


def test_excluded_movie_ids_are_respected(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    results = rec.recommend_similar("a1", top_n=5, exclude_ids=["a2"])
    assert all(r.movie_id != "a2" for r in results)


def test_unknown_movie_id_is_handled_correctly(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    with pytest.raises(MovieDataError):
        rec.recommend_similar("does-not-exist", top_n=3)


def test_empty_dataset_is_handled_correctly() -> None:
    rec = ContentBasedRecommender()
    with pytest.raises(MovieDataError):
        rec.fit(pd.DataFrame())


def test_missing_metadata_does_not_crash() -> None:
    df = pd.DataFrame(
        [
            {
                "movie_id": "b1",
                "title": "Mystery Lane",
                "genres": None,
                "overview": None,
                "release_year": None,
                "vote_average": None,
            },
            {
                "movie_id": "b2",
                "title": "Dark Alley",
                "genres": "Thriller",
                "overview": "Suspenseful night in the city.",
                "release_year": 2020,
                "vote_average": 7.6,
            },
        ]
    )
    rec = ContentBasedRecommender().fit(df)
    results = rec.recommend_similar("b1", top_n=2)
    assert isinstance(results, list)
    assert all(r.similarity_score >= 0 for r in results)


def test_invalid_top_n_values_are_rejected(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    with pytest.raises(ValueError):
        rec.recommend_similar("a1", top_n=0)
    with pytest.raises(ValueError):
        rec.recommend_from_liked(["a1"], top_n=-1)


def test_duplicate_movie_ids_are_handled_predictably() -> None:
    df = pd.DataFrame(
        [
            {
                "movie_id": "x1",
                "title": "One",
                "genres": "Drama",
                "overview": "Test",
                "release_year": 2020,
                "vote_average": 7.0,
            },
            {
                "movie_id": "x1",
                "title": "One Duplicate",
                "genres": "Drama",
                "overview": "Test",
                "release_year": 2021,
                "vote_average": 7.1,
            },
        ]
    )
    with pytest.raises(MovieDataError):
        ContentBasedRecommender().fit(df)


def test_output_rankings_are_deterministic(sample_df: pd.DataFrame) -> None:
    rec = ContentBasedRecommender().fit(sample_df)
    r1 = rec.recommend_similar("a1", top_n=4)
    r2 = rec.recommend_similar("a1", top_n=4)
    assert [x.movie_id for x in r1] == [x.movie_id for x in r2]
    assert [x.similarity_score for x in r1] == [x.similarity_score for x in r2]


def test_metadata_seed_uses_rating_then_year_and_stable_tie_breaks() -> None:
    df = pd.DataFrame(
        [
            {"movie_id": "z", "title": "Zeta", "genres": "Drama", "overview": "z", "release_year": 2020, "vote_average": 8.0},
            {"movie_id": "b", "title": "Beta", "genres": "Drama", "overview": "b", "release_year": 2020, "vote_average": 8.0},
            {"movie_id": "a", "title": "Alpha", "genres": "Drama", "overview": "a", "release_year": 2019, "vote_average": 8.0},
            {"movie_id": "top", "title": "Top Rated", "genres": "Drama", "overview": "top", "release_year": 2010, "vote_average": 9.0},
        ]
    )
    recommender = ContentBasedRecommender().fit(df)

    assert recommender.select_metadata_seed() == "top"
    assert recommender.select_metadata_seed(exclude_ids=["top"]) == "b"
    assert recommender.select_metadata_seed(exclude_ids=["top", "b"]) == "z"


def test_metadata_seed_returns_none_when_all_catalog_titles_are_seen(sample_df: pd.DataFrame) -> None:
    recommender = ContentBasedRecommender().fit(sample_df)

    assert recommender.select_metadata_seed(movie_id for movie_id in sample_df["movie_id"]) is None
