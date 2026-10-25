# Recommendation catalogs and ranking

## Catalog boundaries

RecoMind keeps the local content catalog and MovieLens as separate ID spaces. Local titles use IDs such as `m001`; MovieLens uses numeric movie IDs. The project has no explicit crosswalk between them, so raw IDs, similar titles, or coincidental numeric values are never used to merge candidates or scores.

`POST /api/recommendations` with `algorithm="content"` and `/api/recommendations/personalized` operate on the local catalog. The personalized route accepts the browser's demo feedback user ID, but it does not interpret it as a MovieLens user ID. `POST /api/recommendations` with `algorithm="collaborative"` accepts a numeric MovieLens `user_id` and returns only MovieLens IDs. This collaborative endpoint remains independent; the personalized route does not claim to be hybrid.

## Personalized local content ranking

The personalized route reads persisted ratings and like/dislike feedback for the supplied app user, then retains only IDs present in the fitted local dataset. Likes and ratings of 4 or 5 stars are positive seeds. Dislikes and ratings of 1 or 2 stars are negative; ratings from 2.5 to 3.5 are neutral. A negative signal takes precedence if records conflict. All rated or reacted local titles are excluded from results. The content model averages TF-IDF/cosine similarity vectors for positive seeds and returns local candidates only.

If no valid positive seed exists, the route chooses a deterministic local catalog seed using available metadata: highest `vote_average`, then newest `release_year`, then title and ID in ascending order. Missing numeric values sort last. This is a documented metadata heuristic, not a personal preference or popularity prediction. If no unseen catalog item is available, the route returns an empty list.

## Interaction history

The feedback interaction endpoint persists recommendation views and movie-detail clicks in activity history. These events are currently for display and auditability only; they do not affect ranking. TMDB IDs are prefixed as `tmdb:<id>` and are excluded from local feedback-based recommendations. No identity or item mapping is inferred from those IDs.

## Standalone MovieLens collaborative filtering

The standalone collaborative algorithm uses the MovieLens ratings matrix, numeric MovieLens user IDs, and MovieLens movie IDs. It ranks unrated items for that MovieLens user. Its scores and IDs must not be merged into local-catalog content results without an explicit, validated crosswalk and a design for score calibration.

## Limitations

- `data/raw/sample_movies.csv` is a small synthetic 20-title catalog, so local recommendations are illustrative.
- MovieLens and local content metadata are separate; no crosswalk is present.
- The browser demo user ID is an app feedback key, not authentication or a MovieLens account.
- Activity events do not influence recommendation ranking.
- The deterministic cold-start seed favors catalog metadata values; it does not estimate individual taste.
