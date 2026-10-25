"""Tests for evaluation metrics."""

from __future__ import annotations

import numpy as np

from ml.evaluation import (
    coverage,
    dcg_at_k,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    train_test_split_temporal,
)
import pandas as pd


def test_precision_at_k_basic() -> None:
    recommended = [1, 2, 3, 4, 5]
    relevant = {2, 4, 6}
    assert precision_at_k(recommended, relevant, 5) == 2 / 5
    assert precision_at_k(recommended, relevant, 2) == 0.5


def test_precision_at_k_edge_cases() -> None:
    assert precision_at_k([], {1}, 5) == 0.0
    assert precision_at_k([1, 2], {1}, 0) == 0.0


def test_recall_at_k_basic() -> None:
    recommended = [1, 2, 3, 4, 5]
    relevant = {2, 4, 6}
    assert abs(recall_at_k(recommended, relevant, 5) - 2 / 3) < 1e-6
    # For k=2, hits are 1 (item 2), relevant has 3 items, so recall = 1/3
    assert abs(recall_at_k(recommended, relevant, 2) - 1 / 3) < 1e-6


def test_recall_at_k_edge_cases() -> None:
    assert recall_at_k([1, 2], set(), 5) == 0.0
    assert recall_at_k([], {1}, 5) == 0.0


def test_ndcg_at_k_perfect_ranking() -> None:
    recommended = [1, 2, 3]
    relevant = {1, 2, 3}
    assert abs(ndcg_at_k(recommended, relevant, 3) - 1.0) < 1e-6


def test_ndcg_at_k_partial() -> None:
    recommended = [3, 1, 2]
    relevant = {1, 2}
    ndcg = ndcg_at_k(recommended, relevant, 3)
    assert 0.0 < ndcg < 1.0


def test_dcg_at_k() -> None:
    recommended = [1, 2, 3]
    relevant = {2}
    dcg = dcg_at_k(recommended, relevant, 3)
    assert dcg > 0


def test_coverage() -> None:
    recommended_all = [[1, 2, 3], [2, 4, 5]]
    catalog = {1, 2, 3, 4, 5, 6}
    cov = coverage(recommended_all, catalog)
    assert abs(cov - 5 / 6) < 1e-6


def test_temporal_split_no_leakage() -> None:
    df = pd.DataFrame({
        "userId": [1, 1, 1, 2, 2],
        "movieId": [10, 20, 30, 40, 50],
        "rating": [5, 4, 3, 5, 4],
        "timestamp": [100, 200, 300, 150, 250],
    })
    train, test = train_test_split_temporal(df, test_ratio=0.4)
    # Check no leakage: all train timestamps before test for same user
    for user_id in train["userId"].unique():
        train_max = train[train["userId"] == user_id]["timestamp"].max()
        test_min = test[test["userId"] == user_id]["timestamp"].min()
        assert train_max < test_min or len(test[test["userId"] == user_id]) == 0
