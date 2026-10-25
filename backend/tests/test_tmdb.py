"""Tests for TMDB integration."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.services.tmdb_service import TMDBError


def test_tmdb_status_not_configured(client: TestClient) -> None:
    response = client.get("/api/tmdb/status")
    assert response.status_code == 200
    data = response.json()
    assert "configured" in data


def test_tmdb_popular_no_key(client: TestClient) -> None:
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=False):
        response = client.get("/api/tmdb/popular")
        assert response.status_code == 503


def test_tmdb_search_no_key(client: TestClient) -> None:
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=False):
        response = client.get("/api/tmdb/search?q=test")
        assert response.status_code == 503


def test_tmdb_popular_with_mock(client: TestClient) -> None:
    mock_data = {
        "page": 1,
        "results": [
            {
                "id": 123,
                "title": "Test Movie",
                "overview": "A test movie",
                "poster_path": "/test.jpg",
                "backdrop_path": "/test2.jpg",
                "release_date": "2023-01-01",
                "vote_average": 7.5,
                "genre_ids": [28, 12],
            }
        ],
        "total_pages": 1,
        "total_results": 1,
    }
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_popular", new_callable=AsyncMock) as mock_popular:
        mock_popular.return_value = mock_data
        response = client.get("/api/tmdb/popular?page=1")
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "tmdb"
        assert len(data["results"]) == 1
        assert data["results"][0]["tmdb_id"] == 123
        assert data["results"][0]["source"] == "tmdb"
        assert data["results"][0]["poster_url"] is not None


def test_tmdb_search_with_mock(client: TestClient) -> None:
    mock_data = {
        "page": 1,
        "results": [
            {
                "id": 456,
                "title": "Search Movie",
                "overview": "Found it",
                "poster_path": None,
                "release_date": "2022-05-05",
                "vote_average": 8.0,
            }
        ],
        "total_pages": 1,
        "total_results": 1,
    }
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.search_movies", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = mock_data
        response = client.get("/api/tmdb/search?q=search&page=1")
        assert response.status_code == 200
        data = response.json()
        assert data["results"][0]["title"] == "Search Movie"
        assert data["results"][0]["poster_url"] is None


def test_tmdb_pagination(client: TestClient) -> None:
    mock_data = {"page": 2, "results": [], "total_pages": 5, "total_results": 100}
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_popular", new_callable=AsyncMock) as mock_popular:
        mock_popular.return_value = mock_data
        response = client.get("/api/tmdb/popular?page=2")
        assert response.status_code == 200
        assert response.json()["page"] == 2


def test_tmdb_videos_prefers_official_youtube_trailers_and_does_not_return_credentials(client: TestClient) -> None:
    payload = {"results": [
        {"name": "Featurette", "site": "YouTube", "key": "feature", "type": "Featurette", "official": True},
        {"name": "Fan trailer", "site": "YouTube", "key": "fan", "type": "Trailer", "official": False},
        {"name": "Official trailer", "site": "YouTube", "key": "official", "type": "Trailer", "official": True},
        {"name": "Invalid item", "site": "YouTube", "type": "Trailer"},
    ]}
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_movie_videos", new_callable=AsyncMock, return_value=payload):
        response = client.get("/api/tmdb/movies/123/videos")

    assert response.status_code == 200
    data = response.json()
    assert data["tmdb_movie_id"] == 123
    assert data["results"][0] == {"title": "Official trailer", "site": "YouTube", "key": "official", "type": "Trailer", "official": True}
    assert len(data["results"]) == 3
    assert "api_key" not in response.text


def test_tmdb_videos_empty_results(client: TestClient) -> None:
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_movie_videos", new_callable=AsyncMock, return_value={"results": []}):
        response = client.get("/api/tmdb/movies/123/videos")
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_tmdb_media_routes_reject_invalid_movie_ids(client: TestClient) -> None:
    assert client.get("/api/tmdb/movies/0/videos").status_code == 422
    assert client.get("/api/tmdb/movies/not-an-id/videos").status_code == 422
    assert client.get("/api/tmdb/movies/0/watch-providers").status_code == 422
    assert client.get("/api/tmdb/movies/123/watch-providers?region=IND").status_code == 422


def test_tmdb_video_errors_are_gateway_errors_and_do_not_expose_credentials(client: TestClient) -> None:
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_movie_videos", new_callable=AsyncMock, side_effect=TMDBError("TMDB API error: 503")):
        response = client.get("/api/tmdb/movies/123/videos")
    assert response.status_code == 502
    assert "TMDB API error: 503" in response.json()["detail"]
    assert "api_key" not in response.text


def test_tmdb_watch_providers_returns_categories_and_justwatch_attribution(client: TestClient) -> None:
    payload = {"results": {"IN": {
        "link": "https://www.justwatch.com/in/movie/example",
        "flatrate": [{"provider_id": 8, "provider_name": "Netflix", "logo_path": "/netflix.png", "display_priority": 1}],
        "free": [], "ads": [], "rent": [], "buy": [],
    }}}
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_movie_watch_providers", new_callable=AsyncMock, return_value=payload) as mock_providers:
        response = client.get("/api/tmdb/movies/123/watch-providers?region=in")
    assert response.status_code == 200
    data = response.json()
    assert data["region"] == "IN"
    assert data["source"] == "JustWatch"
    assert data["availability"]["flatrate"][0]["provider_name"] == "Netflix"
    assert data["link"] == payload["results"]["IN"]["link"]
    mock_providers.assert_awaited_once_with(123, "IN")
    assert "api_key" not in response.text


def test_tmdb_watch_providers_handles_region_without_availability(client: TestClient) -> None:
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_movie_watch_providers", new_callable=AsyncMock, return_value={"results": {}}):
        response = client.get("/api/tmdb/movies/123/watch-providers?region=NZ")
    assert response.status_code == 200
    assert response.json()["availability"] is None
    assert response.json()["link"] is None


def test_tmdb_watch_providers_rejects_non_https_destination(client: TestClient) -> None:
    payload = {"results": {"IN": {"link": "javascript:alert(1)", "flatrate": [], "free": [], "ads": [], "rent": [], "buy": []}}}
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_movie_watch_providers", new_callable=AsyncMock, return_value=payload):
        response = client.get("/api/tmdb/movies/123/watch-providers")
    assert response.status_code == 200
    assert response.json()["link"] is None


def test_tmdb_provider_errors_are_reported_without_credentials(client: TestClient) -> None:
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_movie_watch_providers", new_callable=AsyncMock, side_effect=TMDBError("TMDB API request timed out")):
        response = client.get("/api/tmdb/movies/123/watch-providers")
    assert response.status_code == 502
    assert "api_key" not in response.text


def test_tmdb_countries_endpoint(client: TestClient) -> None:
    country = {"iso_3166_1": "IN", "english_name": "India", "native_name": "à¤­à¤¾à¤°à¤¤"}
    with patch("app.services.tmdb_service.tmdb_client.is_configured", return_value=True), \
         patch("app.services.tmdb_service.tmdb_client.get_countries", new_callable=AsyncMock, return_value=[country]):
        response = client.get("/api/tmdb/countries")
    assert response.status_code == 200
    assert response.json() == [country]
