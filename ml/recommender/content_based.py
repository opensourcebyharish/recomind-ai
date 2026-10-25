"""Content-based movie recommendation engine using TF-IDF and cosine similarity."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ml.data.preprocess import (
    MovieDataError,
    ensure_required_columns,
    normalize_dataframe,
    prepare_features,
)


@dataclass(frozen=True)
class Recommendation:
    """A ranked recommendation with an explanation."""

    movie_id: str
    title: str
    genres: str
    release_year: int | None
    vote_average: float | None
    similarity_score: float
    explanation: str


class ContentBasedRecommender:
    """Content-based recommender using genres and overviews."""

    REQUIRED_COLUMNS = {"movie_id", "title", "genres", "overview", "release_year", "vote_average"}

    def __init__(self) -> None:
        self._df: pd.DataFrame | None = None
        self._vectorizer: TfidfVectorizer | None = None
        self._tfidf_matrix = None
        self._similarity: np.ndarray | None = None

    def fit(self, df: pd.DataFrame) -> "ContentBasedRecommender":
        """Fit the recommender on movie metadata."""
        if not isinstance(df, pd.DataFrame):
            raise TypeError("df must be a pandas DataFrame")

        ensure_required_columns(df, self.REQUIRED_COLUMNS)
        normalized = normalize_dataframe(df)
        self._df = normalized

        features_df = prepare_features(normalized)
        self._vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
        self._tfidf_matrix = self._vectorizer.fit_transform(features_df["features"])
        self._similarity = cosine_similarity(self._tfidf_matrix, self._tfidf_matrix)

        return self

    def fit_from_csv(self, path: str) -> "ContentBasedRecommender":
        """Fit from a CSV file."""
        try:
            df = pd.read_csv(path)
        except FileNotFoundError as exc:
            raise MovieDataError(f"Dataset not found: {path}") from exc
        except Exception as exc:
            raise MovieDataError(f"Failed to read CSV: {exc}") from exc
        return self.fit(df)

    @property
    def movies(self) -> pd.DataFrame:
        if self._df is None:
            raise MovieDataError("Recommender has not been fitted. Call fit() first.")
        return self._df

    def _ensure_fitted(self) -> None:
        if self._df is None or self._similarity is None:
            raise MovieDataError("Recommender has not been fitted. Call fit() first.")

    def get_movie_by_id(self, movie_id: str) -> pd.Series:
        self._ensure_fitted()
        df = self._df
        matches = df[df["movie_id"].astype(str) == str(movie_id)]
        if matches.empty:
            raise MovieDataError(f"Unknown movie_id: {movie_id}")
        return matches.iloc[0]

    def select_metadata_seed(self, exclude_ids: Iterable[str] | None = None) -> str | None:
        """Select a deterministic cold-start seed using catalog metadata only.

        The ordering is catalog vote average descending, release year descending,
        then normalized title and ID ascending. Missing numeric metadata sorts last.
        This is a stable catalog heuristic, not a popularity estimate or personal
        preference signal.
        """
        self._ensure_fitted()
        excluded = {str(movie_id) for movie_id in (exclude_ids or [])}
        candidates = self._df[~self._df["movie_id"].astype(str).isin(excluded)].copy()
        if candidates.empty:
            return None

        candidates["_title_sort"] = candidates["title"].astype(str).str.casefold()
        candidates = candidates.sort_values(
            ["vote_average", "release_year", "_title_sort", "movie_id"],
            ascending=[False, False, True, True],
            na_position="last",
            kind="mergesort",
        )
        return str(candidates.iloc[0]["movie_id"])

    def recommend_similar(
        self,
        movie_id: str,
        top_n: int = 5,
        genre_preference: str | Iterable[str] | None = None,
        min_vote_average: float | None = None,
        exclude_ids: Iterable[str] | None = None,
        exclude_rated_by_user: Iterable[str] | None = None,
    ) -> list[Recommendation]:
        """Recommend movies similar to a single source movie."""
        if not isinstance(top_n, int) or top_n < 1:
            raise ValueError("top_n must be a positive integer")

        self._ensure_fitted()
        df = self._df
        source = self.get_movie_by_id(movie_id)
        source_idx = df.index.get_indexer([source.name])[0]
        if source_idx < 0:
            raise MovieDataError("Failed to locate source movie in similarity matrix")

        sim_scores = list(enumerate(self._similarity[source_idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)

        excluded = {str(movie_id)}
        if exclude_ids is not None:
            for mid in exclude_ids:
                excluded.add(str(mid))
        if exclude_rated_by_user is not None:
            for mid in exclude_rated_by_user:
                excluded.add(str(mid))

        genre_set = self._normalize_genre_set(genre_preference)

        results: list[Recommendation] = []
        for idx, score in sim_scores:
            row = df.iloc[idx]
            mid = str(row["movie_id"])
            if mid in excluded:
                continue

            if min_vote_average is not None:
                va = row.get("vote_average")
                if pd.isna(va):
                    continue
                if float(va) < float(min_vote_average):
                    continue

            if genre_set:
                row_genres = set(str(row["genres"]).lower().replace(" ", "").split("|"))
                if not (row_genres & genre_set):
                    continue

            explanation = self._build_explanation(source, row, score)
            results.append(
                Recommendation(
                    movie_id=mid,
                    title=str(row["title"]),
                    genres=str(row["genres"]),
                    release_year=int(row["release_year"]) if not pd.isna(row["release_year"]) else None,
                    vote_average=float(row["vote_average"]) if not pd.isna(row["vote_average"]) else None,
                    similarity_score=float(score),
                    explanation=explanation,
                )
            )
            if len(results) >= top_n:
                break

        return results

    def recommend_from_liked(
        self,
        liked_movie_ids: Iterable[str],
        top_n: int = 5,
        genre_preference: str | Iterable[str] | None = None,
        min_vote_average: float | None = None,
        exclude_ids: Iterable[str] | None = None,
        exclude_rated_by_user: Iterable[str] | None = None,
    ) -> list[Recommendation]:
        """Recommend from multiple liked movies by averaging similarity scores.

        Duplicate results are removed; the highest average similarity score is kept
        for each candidate movie.
        """
        if not isinstance(top_n, int) or top_n < 1:
            raise ValueError("top_n must be a positive integer")

        liked_list = [str(m) for m in liked_movie_ids]
        if not liked_list:
            raise ValueError("liked_movie_ids must contain at least one movie_id")

        self._ensure_fitted()
        df = self._df

        liked_indices = []
        for mid in liked_list:
            source = self.get_movie_by_id(mid)
            idx = df.index.get_indexer([source.name])[0]
            if idx >= 0:
                liked_indices.append(idx)

        if not liked_indices:
            raise MovieDataError("None of the liked movie_ids were found")

        avg_sim = np.mean(self._similarity[liked_indices], axis=0)

        excluded = set(liked_list)
        if exclude_ids is not None:
            for mid in exclude_ids:
                excluded.add(str(mid))
        if exclude_rated_by_user is not None:
            for mid in exclude_rated_by_user:
                excluded.add(str(mid))

        genre_set = self._normalize_genre_set(genre_preference)

        candidates: dict[str, tuple[float, pd.Series]] = {}
        for idx, score in enumerate(avg_sim):
            row = df.iloc[idx]
            mid = str(row["movie_id"])
            if mid in excluded:
                continue

            if min_vote_average is not None:
                va = row.get("vote_average")
                if pd.isna(va):
                    continue
                if float(va) < float(min_vote_average):
                    continue

            if genre_set:
                row_genres = set(str(row["genres"]).lower().replace(" ", "").split("|"))
                if not (row_genres & genre_set):
                    continue

            score_f = float(score)
            if mid not in candidates or score_f > candidates[mid][0]:
                candidates[mid] = (score_f, row)

        sorted_items = sorted(candidates.items(), key=lambda x: x[1][0], reverse=True)

        results: list[Recommendation] = []
        sources = [self.get_movie_by_id(mid) for mid in liked_list]
        source_desc = ", ".join(str(s["title"]) for s in sources)
        for mid, (score, row) in sorted_items:
            if len(results) >= top_n:
                break
            explanation = (
                f"Recommended based on average similarity to liked titles "
                f"({source_desc}). Uses TF-IDF features of genres and overviews."
            )
            results.append(
                Recommendation(
                    movie_id=mid,
                    title=str(row["title"]),
                    genres=str(row["genres"]),
                    release_year=int(row["release_year"]) if not pd.isna(row["release_year"]) else None,
                    vote_average=float(row["vote_average"]) if not pd.isna(row["vote_average"]) else None,
                    similarity_score=score,
                    explanation=explanation,
                )
            )
        return results

    @staticmethod
    def _normalize_genre_set(genre_preference: str | Iterable[str] | None) -> set[str]:
        if genre_preference is None:
            return set()
        if isinstance(genre_preference, str):
            items = [genre_preference]
        else:
            items = list(genre_preference)
        out = set()
        for g in items:
            if g is None:
                continue
            out.add(str(g).strip().lower().replace(" ", ""))
        return out

    @staticmethod
    def _build_explanation(source: pd.Series, row: pd.Series, score: float) -> str:
        shared = []
        s_g = set(str(source.get("genres", "")).split("|"))
        r_g = set(str(row.get("genres", "")).split("|"))
        overlap = sorted(list((s_g & r_g) - {""}))
        if overlap:
            shared.append(f"shared genre(s): {', '.join(overlap)}")
        shared.append("content similarity via TF-IDF of genres and overview")
        return f"Similar to '{source['title']}' (cosine similarity {score:.3f}); " + "; ".join(shared)
