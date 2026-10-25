"""Tests for collaborative filtering API integration."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_collaborative_recommendations_success(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"algorithm": "collaborative", "user_id": 1, "top_n": 5},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["algorithm"] == "collaborative"
    assert payload["catalog"] == "movielens"
    assert payload["user_id"] == 1
    assert payload["count"] == 5
    assert len(payload["recommendations"]) == 5
    for item in payload["recommendations"]:
        assert item["movie_id"].isdigit()
        assert item["score"] is not None
        assert item["similarity_score"] is None
        assert "explanation" in item
    scores = [item["score"] for item in payload["recommendations"]]
    assert scores == sorted(scores, reverse=True)


def test_collaborative_requires_user_id(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"algorithm": "collaborative", "top_n": 5},
    )
    assert response.status_code == 422


def test_collaborative_unknown_user_returns_404(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"algorithm": "collaborative", "user_id": 99999, "top_n": 5},
    )
    assert response.status_code == 404


def test_content_based_still_works(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "similar", "movie_id": "m001", "top_n": 3},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["algorithm"] == "content"
    assert payload["catalog"] == "local"
    assert payload["recommendations"][0]["similarity_score"] is not None
    assert payload["recommendations"][0]["score"] is None


def test_content_based_default_algorithm(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "similar", "movie_id": "m002", "top_n": 2},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["algorithm"] == "content"
