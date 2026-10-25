"""Tests for recommendation API endpoints."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_recommend_similar_success(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "similar", "movie_id": "m001", "top_n": 3},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "similar"
    assert payload["catalog"] == "local"
    assert payload["source_movie_id"] == "m001"
    assert payload["count"] == 3
    assert len(payload["recommendations"]) == 3
    # Source should not be returned
    ids = [r["movie_id"] for r in payload["recommendations"]]
    assert "m001" not in ids
    # Check required fields
    for item in payload["recommendations"]:
        assert "similarity_score" in item
        assert "explanation" in item
        assert "title" in item


def test_recommend_liked_success(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "liked", "liked_movie_ids": ["m001", "m004"], "top_n": 4},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "liked"
    assert payload["catalog"] == "local"
    assert payload["count"] == 4
    ids = [r["movie_id"] for r in payload["recommendations"]]
    # Duplicates not allowed, liked movies excluded
    assert len(ids) == len(set(ids))
    assert "m001" not in ids
    assert "m004" not in ids


def test_unknown_movie_id_returns_404(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "similar", "movie_id": "nope-999"},
    )
    assert response.status_code == 404
    assert "Unknown movie_id" in response.json()["detail"]


def test_validation_missing_movie_id_for_similar(client: TestClient) -> None:
    response = client.post("/api/recommendations", json={"mode": "similar"})
    assert response.status_code == 422


def test_validation_missing_liked_for_liked_mode(client: TestClient) -> None:
    response = client.post("/api/recommendations", json={"mode": "liked"})
    assert response.status_code == 422


def test_genre_filter(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "similar", "movie_id": "m001", "genre_preference": "Western", "top_n": 5},
    )
    assert response.status_code == 200
    payload = response.json()
    for item in payload["recommendations"]:
        assert "Western" in item["genres"]


def test_min_vote_average_filter(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "similar", "movie_id": "m001", "min_vote_average": 7.9, "top_n": 10},
    )
    assert response.status_code == 200
    payload = response.json()
    for item in payload["recommendations"]:
        assert item["vote_average"] is not None
        assert item["vote_average"] >= 7.9


def test_exclude_ids(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "similar", "movie_id": "m001", "exclude_ids": ["m002"], "top_n": 10},
    )
    assert response.status_code == 200
    ids = [r["movie_id"] for r in response.json()["recommendations"]]
    assert "m002" not in ids


def test_invalid_top_n_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/recommendations",
        json={"mode": "similar", "movie_id": "m001", "top_n": 0},
    )
    assert response.status_code == 422


def test_empty_dataset_returns_503(test_app: FastAPI, tmp_path: Path) -> None:
    from app.services import recommender_service

    # Point to empty/nonexistent file
    bad_path = tmp_path / "missing.csv"
    os.environ["RECOMMENDER_DATASET_PATH"] = str(bad_path)
    recommender_service.reset_recommender()
    try:
        with TestClient(test_app) as c:
            response = c.post(
                "/api/recommendations",
                json={"mode": "similar", "movie_id": "m001"},
            )
        assert response.status_code == 503
    finally:
        recommender_service.reset_recommender()
        os.environ.pop("RECOMMENDER_DATASET_PATH", None)
