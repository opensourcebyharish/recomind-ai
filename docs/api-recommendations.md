# Recommendation API Integration

## Endpoints
- `POST /api/recommendations` â€” Content-based recommendations using TF-IDF and cosine similarity.

The endpoint uses the synthetic dataset at `data/raw/sample_movies.csv` by default. The recommender is loaded once and cached for the application lifetime (reloaded only if the dataset path changes or `reset_recommender()` is called).

## Request schema
```json
{
  "mode": "similar",        // "similar" or "liked"
  "movie_id": "m001",       // required if mode="similar"
  "liked_movie_ids": ["m001", "m004"], // required if mode="liked"
  "top_n": 5,               // 1-50
  "genre_preference": "Sci-Fi", // string or ["Sci-Fi", "Adventure"]
  "min_vote_average": 7.5,  // 0-10
  "exclude_ids": ["m002"],
  "exclude_rated_by_user": ["m003"]
}
```

## Response schema
```json
{
  "mode": "similar",
  "source_movie_id": "m001",
  "liked_movie_ids": null,
  "count": 5,
  "dataset": "C:/.../data/raw/sample_movies.csv",
  "recommendations": [
    {
      "movie_id": "m014",
      "title": "Peak Peril",
      "genres": "Adventure|Thriller",
      "release_year": 2020,
      "vote_average": 7.6,
      "similarity_score": 0.1249,
      "explanation": "Similar to 'Starlight Horizon' (cosine similarity 0.125); shared genre(s): Adventure; content similarity via TF-IDF of genres and overview"
    }
  ]
}
```

## Examples

### Similar to a movie
```bash
curl -X POST http://127.0.0.1:8000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"mode":"similar","movie_id":"m001","top_n":5}'
```

### From liked movies
```bash
curl -X POST http://127.0.0.1:8000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"mode":"liked","liked_movie_ids":["m001","m004"],"top_n":5}'
```

### With filters
```bash
curl -X POST http://127.0.0.1:8000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"mode":"similar","movie_id":"m001","genre_preference":"Sci-Fi","min_vote_average":7.7,"exclude_ids":["m002"]}'
```

## Errors
- `404` â€” Unknown movie ID
- `422` â€” Validation errors (missing required fields, invalid top_n, empty liked list)
- `400` â€” Other data errors from the recommendation engine
- `503` â€” Recommendation dataset unavailable
- `500` â€” Unexpected server error (details not leaked)

## Notes
- Uses only content-based filtering (TF-IDF + cosine similarity). No collaborative filtering.
- The dataset is synthetic (`data/raw/sample_movies.csv`) and not real third-party data.
- Similarity scores are content similarity values, not predicted user ratings.
- Existing endpoints (`GET /`, `GET /health`) are unchanged.
