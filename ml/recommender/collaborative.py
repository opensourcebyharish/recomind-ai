"""Item-based collaborative filtering recommender using MovieLens ratings."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from ml.data.movielens_preprocess import (
    MovieLensDataError,
    build_user_item_matrix,
    load_movielens,
)


@dataclass(frozen=True)
class CFRecommendation:
    """A collaborative filtering recommendation."""

    movie_id: str
    title: str
    genres: str
    release_year: int | None
    score: float
    explanation: str


class ItemBasedCFRecommender:
    """Item-based collaborative filtering using cosine similarity over user-rating vectors."""

    def __init__(self) -> None:
        self._movies_df: pd.DataFrame | None = None
        self._ratings_df: pd.DataFrame | None = None
        self._user_item_matrix: pd.DataFrame | None = None
        self._item_similarity: np.ndarray | None = None
        self._movie_to_idx: dict[int, int] = {}
        self._idx_to_movie: dict[int, int] = {}

    def fit(self, movies_df: pd.DataFrame, ratings_df: pd.DataFrame) -> "ItemBasedCFRecommender":
        """Fit the CF recommender on MovieLens data."""
        if not isinstance(movies_df, pd.DataFrame) or not isinstance(ratings_df, pd.DataFrame):
            raise TypeError("movies_df and ratings_df must be pandas DataFrames")

        self._movies_df = movies_df.copy()
        self._ratings_df = ratings_df.copy()

        self._user_item_matrix, user_to_idx, self._movie_to_idx = build_user_item_matrix(ratings_df)
        self._idx_to_movie = {idx: mid for mid, idx in self._movie_to_idx.items()}

        # Compute item-item similarity (movies x movies) based on user rating vectors
        # Use cosine similarity on the item vectors (columns)
        item_matrix = self._user_item_matrix.T.values  # shape (n_items, n_users)
        self._item_similarity = cosine_similarity(item_matrix)

        return self

    def fit_from_csv(self, movies_path: str, ratings_path: str) -> "ItemBasedCFRecommender":
        """Fit from MovieLens CSV files."""
        movies_df, ratings_df = load_movielens(movies_path, ratings_path)
        return self.fit(movies_df, ratings_df)

    def _ensure_fitted(self) -> None:
        if self._movies_df is None or self._item_similarity is None or self._user_item_matrix is None:
            raise MovieLensDataError("CF recommender has not been fitted. Call fit() first.")

    def recommend_for_user(
        self,
        user_id: int,
        top_n: int = 10,
        exclude_rated: bool = True,
    ) -> list[CFRecommendation]:
        """Recommend movies for a user using item-based CF.

        Score for each candidate = sum(similarity to rated items * rating) / sum(|similarity|)
        Excludes movies already rated by the user if exclude_rated=True.
        """
        if not isinstance(top_n, int) or top_n < 1:
            raise ValueError("top_n must be a positive integer")

        self._ensure_fitted()

        if user_id not in self._user_item_matrix.index:
            raise MovieLensDataError(f"Unknown userId: {user_id}")

        user_ratings = self._user_item_matrix.loc[user_id]
        rated_movies = set(user_ratings[user_ratings > 0].index.tolist())

        scores = {}
        # For each movie the user has rated, add weighted contributions to similar movies
        for rated_movie_id, rating in user_ratings[user_ratings > 0].items():
            if rated_movie_id not in self._movie_to_idx:
                continue
            rated_idx = self._movie_to_idx[rated_movie_id]
            sim_scores = self._item_similarity[rated_idx]
            for idx, sim in enumerate(sim_scores):
                movie_id = self._idx_to_movie[idx]
                if exclude_rated and movie_id in rated_movies:
                    continue
                if movie_id not in scores:
                    scores[movie_id] = {"num": 0.0, "den": 0.0}
                scores[movie_id]["num"] += float(sim) * float(rating)
                scores[movie_id]["den"] += abs(float(sim))

        # Compute weighted scores
        results = []
        for movie_id, s in scores.items():
            if s["den"] == 0:
                continue
            pred_score = s["num"] / s["den"]
            movie_info = self._movies_df[self._movies_df["movieId"] == movie_id]
            if movie_info.empty:
                continue
            row = movie_info.iloc[0]
            # Extract year from title if possible
            title = str(row["title"])
            year = None
            if "(" in title and title.endswith(")"):
                try:
                    year_str = title.split("(")[-1].rstrip(")")
                    year = int(year_str)
                except Exception:
                    year = None
            results.append(
                CFRecommendation(
                    movie_id=str(movie_id),
                    title=title,
                    genres=str(row["genres"]),
                    release_year=year,
                    score=float(pred_score),
                    explanation=f"Item-based CF: predicted score {pred_score:.3f} based on similar users' ratings to movies you've rated.",
                )
            )

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_n]
