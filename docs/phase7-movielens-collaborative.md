# Phase 7: Real MovieLens Data and Collaborative Filtering

## Dataset
- **Source:** MovieLens latest-small (groupLens)
- **Files:**
  - `data/raw/movies.csv` (9742 movies) - columns: `movieId`, `title`, `genres`
  - `data/raw/ratings.csv` (100836 ratings) - columns: `userId`, `movieId`, `rating`, `timestamp`
- **Validation:** Checked for missing values, duplicates, rating ranges (0.5-5.0), referential integrity
- **Gitignore:** `data/raw/*` is gitignored (only `.gitkeep` and `README.md` are tracked). MovieLens files are present locally but not committed per existing policy.

## Collaborative Filtering
- **Algorithm:** Item-based collaborative filtering using cosine similarity over user-rating vectors
- **Implementation:** `ml/recommender/collaborative.py` - `ItemBasedCFRecommender`
- **Scoring:** Weighted prediction `sum(sim * rating) / sum(|sim|)` for items similar to movies the user has rated
- **Features:**
  - Excludes movies already rated by the user
  - Handles unknown users, sparse data gracefully
  - Deterministic ordering by predicted score
  - Returns movie metadata (title, genres, year extracted from title)

## API Integration
- **Endpoint:** `POST /api/recommendations` (extended, backward compatible)
- **New fields:**
  - `algorithm`: `"content"` (default) or `"collaborative"`
  - `user_id`: required for collaborative filtering
- **Response includes:** `algorithm`, `user_id` (for CF), `score` (for CF) or `similarity_score` (for content), both optional for flexibility
- **Content-based:** Continues to use `data/raw/sample_movies.csv` by default (unchanged behavior)
- **Collaborative:** Uses MovieLens `movies.csv` and `ratings.csv` (configurable via env vars)

## Configuration
Environment variables:
- `RECOMMENDER_DATASET_PATH` - Path to content-based dataset (default: `data/raw/sample_movies.csv`)
- `MOVIELENS_MOVIES_PATH` - Path to MovieLens movies (default: `data/raw/movies.csv`)
- `MOVIELENS_RATINGS_PATH` - Path to MovieLens ratings (default: `data/raw/ratings.csv`)

## Evaluation
- **Method:** Temporal train/test split (per-user, hold out latest ratings)
- **Metrics:** Precision@K, Recall@K
- **Limitations:**
  - Small dataset (latest-small), high sparsity
  - Temporal split may have cold-start issues
  - No cross-validation in this implementation
  - Item-based CF can struggle with very sparse users

## Usage Examples

### Content-based (existing, unchanged)
```json
POST /api/recommendations
{
  "mode": "similar",
  "movie_id": "m001",
  "top_n": 5
}
```

### Collaborative filtering
```json
POST /api/recommendations
{
  "algorithm": "collaborative",
  "user_id": 1,
  "top_n": 10
}
```

## Testing
- Data validation tests
- Collaborative filtering ranking tests
- Rated-item exclusion tests
- Unknown user handling
- Deterministic results
- API backward compatibility
- Content-based still works as before
