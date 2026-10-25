"""Evaluation utilities for recommendation systems."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def precision_at_k(recommended: list, relevant: set, k: int) -> float:
    """Calculate Precision@K."""
    if k <= 0:
        return 0.0
    recommended_k = recommended[:k]
    if len(recommended_k) == 0:
        return 0.0
    hits = sum(1 for item in recommended_k if item in relevant)
    return hits / len(recommended_k)


def recall_at_k(recommended: list, relevant: set, k: int) -> float:
    """Calculate Recall@K."""
    if k <= 0 or len(relevant) == 0:
        return 0.0
    recommended_k = recommended[:k]
    hits = sum(1 for item in recommended_k if item in relevant)
    return hits / len(relevant)


def dcg_at_k(recommended: list, relevant: set, k: int) -> float:
    """Calculate Discounted Cumulative Gain@K (binary relevance)."""
    if k <= 0:
        return 0.0
    recommended_k = recommended[:k]
    dcg = 0.0
    for i, item in enumerate(recommended_k):
        if item in relevant:
            dcg += 1.0 / np.log2(i + 2)
    return dcg


def ndcg_at_k(recommended: list, relevant: set, k: int) -> float:
    """Calculate Normalized DCG@K (binary relevance)."""
    if k <= 0 or len(relevant) == 0:
        return 0.0
    dcg = dcg_at_k(recommended, relevant, k)
    # Ideal DCG: put all relevant items first
    ideal_recommended = list(relevant)[:k]
    idcg = dcg_at_k(ideal_recommended, relevant, k)
    if idcg == 0.0:
        return 0.0
    return dcg / idcg


def coverage(recommended_all: list[list], catalog: set) -> float:
    """Calculate catalog coverage: fraction of catalog items that appear in recommendations."""
    if not catalog:
        return 0.0
    recommended_set = set()
    for recs in recommended_all:
        for item in recs:
            recommended_set.add(item)
    return len(recommended_set & catalog) / len(catalog)


def evaluate_user(
    recommender,
    user_id: int,
    test_items: set,
    train_items: set | None = None,
    k: int = 10,
) -> dict[str, float]:
    """Evaluate recommendations for a single user.

    Note: train_items is passed for API compatibility but not used to exclude
    in evaluation - the recommender is responsible for excluding train items.
    """
    try:
        recs = recommender.recommend_for_user(user_id, top_n=k)
        rec_ids = [int(r.movie_id) for r in recs]
    except Exception:
        return {"precision@k": 0.0, "recall@k": 0.0, "ndcg@k": 0.0}

    prec = precision_at_k(rec_ids, test_items, k)
    rec = recall_at_k(rec_ids, test_items, k)
    ndcg = ndcg_at_k(rec_ids, test_items, k)
    return {"precision@k": prec, "recall@k": rec, "ndcg@k": ndcg}


def train_test_split_temporal(
    ratings_df: pd.DataFrame, test_ratio: float = 0.2
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Temporal split: for each user, hold out their latest ratings as test.

    This prevents leakage by ensuring test interactions occur after train interactions.
    """
    if "timestamp" not in ratings_df.columns:
        raise ValueError("timestamp column required for temporal split")
    if "userId" not in ratings_df.columns or "movieId" not in ratings_df.columns:
        raise ValueError("userId and movieId columns required")

    train_list = []
    test_list = []
    for user_id, user_df in ratings_df.groupby("userId"):
        if len(user_df) == 0:
            continue
        user_df_sorted = user_df.sort_values("timestamp")
        n_test = max(1, int(len(user_df_sorted) * test_ratio))
        # Ensure we don't put everything in test
        if n_test >= len(user_df_sorted):
            n_test = max(1, len(user_df_sorted) // 5)
        train_list.append(user_df_sorted.iloc[:-n_test])
        test_list.append(user_df_sorted.iloc[-n_test:])

    if not train_list or not test_list:
        raise ValueError("Insufficient data for temporal split")

    train_df = pd.concat(train_list, ignore_index=True)
    test_df = pd.concat(test_list, ignore_index=True)
    return train_df, test_df
