"""Tests for feedback API."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_submit_rating(client: TestClient) -> None:
    response = client.post(
        "/api/feedback/rating",
        json={"user_id": "demo1", "movie_id": "m001", "rating": 4.5},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == "demo1"
    assert payload["catalog"] == "local"
    assert payload["movie_id"] == "m001"
    assert payload["rating"] == 4.5


def test_update_rating(client: TestClient) -> None:
    client.post("/api/feedback/rating", json={"user_id": "demo2", "movie_id": "m001", "rating": 3.0})
    response = client.post("/api/feedback/rating", json={"user_id": "demo2", "movie_id": "m001", "rating": 5.0})
    assert response.status_code == 200
    assert response.json()["rating"] == 5.0


def test_tmdb_rating_is_saved_and_returned_by_history(client: TestClient) -> None:
    local = client.post("/api/feedback/rating", json={"user_id": "catalog-user", "catalog": "local", "movie_id": "m001", "rating": 4})
    tmdb = client.post("/api/feedback/rating", json={"user_id": "catalog-user", "catalog": "tmdb", "movie_id": "tmdb:550", "rating": 5})
    assert local.status_code == 200
    assert tmdb.status_code == 200
    assert tmdb.json()["catalog"] == "tmdb"
    assert tmdb.json()["movie_id"] == "tmdb:550"

    history = client.get("/api/feedback/history/catalog-user")
    assert history.status_code == 200
    ratings = {(item["catalog"], item["movie_id"]): item["rating"] for item in history.json()["ratings"]}
    assert ratings == {("local", "m001"): 4.0, ("tmdb", "tmdb:550"): 5.0}


def test_tmdb_rating_can_be_updated(client: TestClient) -> None:
    request = {"user_id": "tmdb-rater", "catalog": "tmdb", "movie_id": "tmdb:42", "rating": 2}
    created = client.post("/api/feedback/rating", json=request)
    updated = client.post("/api/feedback/rating", json={**request, "rating": 3})
    assert created.status_code == updated.status_code == 200
    assert updated.json()["id"] == created.json()["id"]
    assert updated.json()["rating"] == 3


def test_invalid_rating_range(client: TestClient) -> None:
    response = client.post(
        "/api/feedback/rating",
        json={"user_id": "demo3", "movie_id": "m001", "rating": 6.0},
    )
    assert response.status_code == 422
    lower = client.post("/api/feedback/rating", json={"user_id": "demo3", "movie_id": "m001", "rating": 0})
    assert lower.status_code == 422


def test_rating_rejects_catalog_id_mismatch(client: TestClient) -> None:
    local_with_tmdb_id = client.post("/api/feedback/rating", json={"user_id": "bad", "catalog": "local", "movie_id": "tmdb:10", "rating": 4})
    malformed_tmdb = client.post("/api/feedback/rating", json={"user_id": "bad", "catalog": "tmdb", "movie_id": "10", "rating": 4})
    assert local_with_tmdb_id.status_code == malformed_tmdb.status_code == 422


def test_like_movie(client: TestClient) -> None:
    response = client.post(
        "/api/feedback/like",
        json={"user_id": "demo4", "movie_id": "m002", "feedback_type": "like"},
    )
    assert response.status_code == 200
    assert response.json()["feedback_type"] == "like"


def test_dislike_movie(client: TestClient) -> None:
    response = client.post(
        "/api/feedback/dislike",
        json={"user_id": "demo5", "movie_id": "m003", "feedback_type": "dislike"},
    )
    assert response.status_code == 200
    assert response.json()["feedback_type"] == "dislike"


def test_get_user_history(client: TestClient) -> None:
    client.post("/api/feedback/rating", json={"user_id": "demo6", "movie_id": "m001", "rating": 4.0})
    client.post("/api/feedback/like", json={"user_id": "demo6", "movie_id": "m002", "feedback_type": "like"})
    response = client.get("/api/feedback/history/demo6")
    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == "demo6"
    assert len(payload["ratings"]) >= 1
    assert len(payload["feedback"]) >= 1


def test_record_interaction(client: TestClient) -> None:
    response = client.post(
        "/api/feedback/interaction",
        json={"user_id": "demo7", "movie_id": "m001", "interaction_type": "click"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["movie_id"] == "m001"
    assert payload["interaction_type"] == "click"
    assert payload["created_at"]


def test_interaction_is_persisted_in_feedback_history(client: TestClient) -> None:
    response = client.post(
        "/api/feedback/interaction",
        json={"user_id": "activity-user", "movie_id": "tmdb:42", "interaction_type": "view"},
    )
    assert response.status_code == 200

    history = client.get("/api/feedback/history/activity-user")
    assert history.status_code == 200
    assert history.json()["interactions"] == [
        {
            "id": response.json()["id"],
            "movie_id": "tmdb:42",
            "interaction_type": "view",
            "created_at": response.json()["created_at"],
        }
    ]
