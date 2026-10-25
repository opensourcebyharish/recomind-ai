"""Hybrid recommendation service combining content-based and collaborative filtering."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.database.session import get_db
from app.models.feedback import UserMovieFeedback, UserMovieRating
from app.schemas.hybrid import HybridRecommendationItem, HybridRecommendationResponse
from app.services.recommender_service import get_recommender
from ml.data.preprocess import MovieDataError

logger = get_logger(__name__)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/personalized", response_model=HybridRecommendationResponse)
def get_personalized_recommendations(
    user_id: str = Query(..., description="Application feedback ID; not a MovieLens user ID (no authentication)"),
    top_n: int = Query(10, ge=1, le=50),
    db: Annotated[Session, Depends(get_db)] = None,
) -> HybridRecommendationResponse:
    """Recommend within the local catalog using feedback for this application ID.

    MovieLens has a separate user and item identity space. Until an explicit
    identity link and catalog crosswalk exist, this endpoint never reads or
    combines MovieLens candidates.
    """
    try:
        recommender = get_recommender()
    except MovieDataError as exc:
        logger.error("Recommendation dataset unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Local recommendation catalog is unavailable") from exc
    except Exception as exc:
        logger.exception("Failed to initialize content recommendation engine")
        raise HTTPException(status_code=500, detail="Failed to initialize recommendation engine") from exc

    # Only IDs present in the local content dataset can affect these results.
    # TMDB-prefixed and MovieLens numeric IDs remain outside this catalog.
    local_movie_ids = set(recommender.movies["movie_id"].astype(str))
    ratings_stmt = select(UserMovieRating).where(UserMovieRating.user_id == user_id)
    ratings = {
        str(r.movie_id): r.rating
        for r in db.execute(ratings_stmt).scalars().all()
        if r.catalog == "local" and str(r.movie_id) in local_movie_ids
    }

    feedback_stmt = select(UserMovieFeedback).where(UserMovieFeedback.user_id == user_id)
    feedback = {
        str(f.movie_id): f.feedback_type
        for f in db.execute(feedback_stmt).scalars().all()
        if str(f.movie_id) in local_movie_ids
    }

    liked_ids = set()
    disliked_ids = set()
    for mid, ftype in feedback.items():
        if ftype == "like":
            liked_ids.add(mid)
        elif ftype == "dislike":
            disliked_ids.add(mid)

    # Add high ratings to likes
    for mid, rating in ratings.items():
        if rating >= 4.0:
            liked_ids.add(mid)

    # Add low ratings to dislikes
    for mid, rating in ratings.items():
        if rating <= 2.0:
            disliked_ids.add(mid)

    all_seen = liked_ids | disliked_ids | set(ratings)
    liked_ids -= disliked_ids

    if liked_ids:
        try:
            recs = recommender.recommend_from_liked(
                sorted(liked_ids),
                top_n=top_n,
                exclude_rated_by_user=sorted(all_seen),
            )
        except (MovieDataError, ValueError) as exc:
            logger.warning("Could not generate feedback-based content recommendations: %s", exc)
            raise HTTPException(status_code=422, detail="Saved feedback could not be used with the local catalog") from exc

        items = [
            HybridRecommendationItem(
                movie_id=r.movie_id,
                title=r.title,
                genres=r.genres,
                release_year=r.release_year,
                vote_average=r.vote_average,
                score=r.similarity_score,
                explanation=f"Content match from your local catalog feedback: {r.explanation}",
                source="content",
            )
            for r in recs
        ]
        return HybridRecommendationResponse(
            user_id=user_id,
            catalog="local",
            count=len(items),
            recommendations=items,
            strategy="content_based_feedback",
        )

    # No usable positive local feedback: choose a seen-safe seed by catalog
    # rating, release year, title, then ID; the metadata fallback is not personal.
    seed_id = recommender.select_metadata_seed(exclude_ids=all_seen)
    if seed_id is None:
        return HybridRecommendationResponse(
            user_id=user_id,
            catalog="local",
            count=0,
            recommendations=[],
            strategy="metadata_seeded_content_fallback",
        )

    seed_title = recommender.get_movie_by_id(seed_id)["title"]
    recs = recommender.recommend_similar(
        seed_id,
        top_n=top_n,
        exclude_rated_by_user=all_seen,
    )
    items = [
        HybridRecommendationItem(
            movie_id=r.movie_id,
            title=r.title,
            genres=r.genres,
            release_year=r.release_year,
            vote_average=r.vote_average,
            score=r.similarity_score,
            explanation=(
                f"Cold-start content fallback: seed selected by catalog rating, then release year "
                f"({seed_title}); no personal history was used. {r.explanation}"
            ),
            source="content",
        )
        for r in recs
    ]
    return HybridRecommendationResponse(
        user_id=user_id,
        catalog="local",
        count=len(items),
        recommendations=items,
        strategy="metadata_seeded_content_fallback",
    )
