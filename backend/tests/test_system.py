"""Tests for system endpoints and application metadata."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings


def test_root_returns_api_information(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "RecoMind AI"
    assert payload["version"] == "0.1.0"
    assert payload["docs"] == "/docs"
    assert payload["health"] == "/health"


def test_health_reports_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"
    assert payload["environment"] == "testing"


def test_openapi_document_is_available(client: TestClient) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "RecoMind AI"
    assert "/health" in schema["paths"]


def test_cors_allows_configured_frontend_origin(client: TestClient) -> None:
    response = client.get(
        "/health",
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == "http://localhost:5173"
    )


def test_unknown_route_returns_json_404(client: TestClient) -> None:
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json()["detail"] == "Not Found"


def test_health_returns_503_without_leaking_details(
    test_app: FastAPI,
    client: TestClient,
) -> None:
    from sqlalchemy.exc import SQLAlchemyError

    from app.database.session import get_db

    class FailingSession:
        def execute(self, *args: object, **kwargs: object) -> None:
            raise SQLAlchemyError("simulated database failure")

    def override_get_db() -> object:
        yield FailingSession()

    test_app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/health")
    finally:
        test_app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable."}


def test_debug_mode_is_disabled_by_default(test_settings: Settings) -> None:
    """The shared test settings must not expose tracebacks in responses."""

    assert test_settings.debug is False
