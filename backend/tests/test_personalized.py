"""Tests for catalog-scoped personalized recommendations."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _personalized(client: TestClient, user_id: str, top_n: int = 10) -> dict:
    response = client.get(f"/api/recommendations/personalized?user_id={user_id}&top_n={top_n}")
    assert response.status_code == 200, response.text
    return response.json()


def test_cold_start_uses_deterministic_metadata_seed(client: TestClient) -> None:
    first = _personalized(client, "new-browser-user", top_n=5)
    second = _personalized(client, "new-browser-user", top_n=5)

    assert first["catalog"] == "local"
    assert first["strategy"] == "metadata_seeded_content_fallback"
    assert [item["movie_id"] for item in first["recommendations"]] == [
        item["movie_id"] for item in second["recommendations"]
    ]
    assert all(item["source"] == "content" for item in first["recommendations"])
    assert all("Cold-start content fallback" in item["explanation"] for item in first["recommendations"])
    assert all("no personal history was used" in item["explanation"] for item in first["recommendations"])


def test_feedback_generates_local_content_recommendations(client: TestClient) -> None:
    saved = client.post(
        "/api/feedback/like",
        json={"user_id": "browser-user", "movie_id": "m001", "feedback_type": "like"},
    )
    assert saved.status_code == 200

    result = _personalized(client, "browser-user", top_n=5)

    assert result["catalog"] == "local"
    assert result["strategy"] == "content_based_feedback"
    assert all(item["source"] == "content" for item in result["recommendations"])
    assert "m001" not in {item["movie_id"] for item in result["recommendations"]}
    assert all("your local catalog feedback" in item["explanation"] for item in result["recommendations"])


def test_different_positive_feedback_changes_content_ranking(client: TestClient) -> None:
    for user_id, movie_id in [("sci-fi-viewer", "m001"), ("western-viewer", "m004")]:
        response = client.post(
            "/api/feedback/like",
            json={"user_id": user_id, "movie_id": movie_id, "feedback_type": "like"},
        )
        assert response.status_code == 200

    sci_fi = _personalized(client, "sci-fi-viewer", top_n=8)
    western = _personalized(client, "western-viewer", top_n=8)

    assert [item["movie_id"] for item in sci_fi["recommendations"]] != [
        item["movie_id"] for item in western["recommendations"]
    ]


def test_dislikes_and_low_ratings_are_excluded(client: TestClient) -> None:
    client.post(
        "/api/feedback/like",
        json={"user_id": "feedback-user", "movie_id": "m001", "feedback_type": "like"},
    )
    client.post(
        "/api/feedback/dislike",
        json={"user_id": "feedback-user", "movie_id": "m004", "feedback_type": "dislike"},
    )
    client.post(
        "/api/feedback/rating",
        json={"user_id": "feedback-user", "movie_id": "m006", "rating": 1.0},
    )

    result = _personalized(client, "feedback-user", top_n=20)
    ids = {item["movie_id"] for item in result["recommendations"]}

    assert "m001" not in ids
    assert "m004" not in ids
    assert "m006" not in ids


def test_neutral_rating_is_excluded_but_does_not_become_a_positive_seed(client: TestClient) -> None:
    saved = client.post(
        "/api/feedback/rating",
        json={"user_id": "neutral-user", "movie_id": "m002", "rating": 3.0},
    )
    assert saved.status_code == 200

    result = _personalized(client, "neutral-user", top_n=10)

    assert result["strategy"] == "metadata_seeded_content_fallback"
    assert "m002" not in {item["movie_id"] for item in result["recommendations"]}


def test_numeric_application_id_never_activates_movielens_or_blends_catalogs(client: TestClient) -> None:
    client.post(
        "/api/feedback/like",
        json={"user_id": "1", "movie_id": "m001", "feedback_type": "like"},
    )

    result = _personalized(client, "1", top_n=10)

    assert result["catalog"] == "local"
    assert result["strategy"] == "content_based_feedback"
    assert result["recommendations"]
    assert all(item["source"] == "content" for item in result["recommendations"])
    assert all(item["movie_id"].startswith("m") for item in result["recommendations"])


def test_tmdb_and_unmapped_movielens_feedback_use_metadata_fallback(client: TestClient) -> None:
    for movie_id in ("tmdb:12345", "1"):
        client.post(
            "/api/feedback/like",
            json={"user_id": "mixed-catalog-user", "movie_id": movie_id, "feedback_type": "like"},
        )

    result = _personalized(client, "mixed-catalog-user", top_n=5)

    assert result["catalog"] == "local"
    assert result["strategy"] == "metadata_seeded_content_fallback"
    assert all(item["movie_id"].startswith("m") for item in result["recommendations"])
    assert all(item["source"] == "content" for item in result["recommendations"])


def test_tmdb_catalog_rating_does_not_seed_local_recommendations(client: TestClient) -> None:
    saved = client.post(
        "/api/feedback/rating",
        json={"user_id": "tmdb-rating-user", "catalog": "tmdb", "movie_id": "tmdb:550", "rating": 5},
    )
    assert saved.status_code == 200

    result = _personalized(client, "tmdb-rating-user", top_n=5)

    assert result["strategy"] == "metadata_seeded_content_fallback"
    assert all(item["movie_id"].startswith("m") for item in result["recommendations"])


def test_dislike_only_cold_start_does_not_use_disliked_title_as_seed(client: TestClient) -> None:
    client.post(
        "/api/feedback/dislike",
        json={"user_id": "dislike-only-user", "movie_id": "m001", "feedback_type": "dislike"},
    )

    result = _personalized(client, "dislike-only-user", top_n=10)

    assert result["strategy"] == "metadata_seeded_content_fallback"
    assert "m001" not in {item["movie_id"] for item in result["recommendations"]}
