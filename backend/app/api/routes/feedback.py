"""Feedback API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.database.session import get_db
from app.models.feedback import RecommendationInteraction, UserMovieFeedback, UserMovieRating
from app.schemas.feedback import (
    FeedbackRequest,
    FeedbackResponse,
    InteractionResponse,
    InteractionRequest,
    RatingRequest,
    RatingResponse,
    UserFeedbackHistoryResponse,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/rating", response_model=RatingResponse, summary="Rate a movie")
def submit_rating(request: RatingRequest, db: Annotated[Session, Depends(get_db)]) -> RatingResponse:
    """Submit or update a movie rating (1-5 scale)."""
    # Check for existing rating
    stmt = select(UserMovieRating).where(
        UserMovieRating.user_id == request.user_id,
        UserMovieRating.catalog == request.catalog,
        UserMovieRating.movie_id == request.movie_id,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    if existing:
        existing.rating = request.rating
        db.commit()
        db.refresh(existing)
        return RatingResponse(
            id=existing.id,
            user_id=existing.user_id,
            movie_id=existing.movie_id,
            catalog=existing.catalog,
            rating=existing.rating,
            created_at=existing.created_at,
            updated_at=existing.updated_at,
        )
    else:
        rating = UserMovieRating(
            user_id=request.user_id,
            movie_id=request.movie_id,
            catalog=request.catalog,
            rating=request.rating,
        )
        db.add(rating)
        try:
            db.commit()
            db.refresh(rating)
            return RatingResponse(
                id=rating.id,
                user_id=rating.user_id,
                movie_id=rating.movie_id,
                catalog=rating.catalog,
                rating=rating.rating,
                created_at=rating.created_at,
                updated_at=rating.updated_at,
            )
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Failed to save rating") from None


@router.post("/like", response_model=FeedbackResponse, summary="Like a movie")
def like_movie(request: FeedbackRequest, db: Annotated[Session, Depends(get_db)]) -> FeedbackResponse:
    """Like a movie (updates if already exists)."""
    if request.feedback_type != "like":
        raise HTTPException(status_code=422, detail="Use feedback_type='like'")

    stmt = select(UserMovieFeedback).where(
        UserMovieFeedback.user_id == request.user_id,
        UserMovieFeedback.movie_id == request.movie_id,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    if existing:
        existing.feedback_type = "like"
        db.commit()
        db.refresh(existing)
        return FeedbackResponse(
            id=existing.id,
            user_id=existing.user_id,
            movie_id=existing.movie_id,
            feedback_type=existing.feedback_type,
            created_at=existing.created_at,
            updated_at=existing.updated_at,
        )
    else:
        feedback = UserMovieFeedback(
            user_id=request.user_id,
            movie_id=request.movie_id,
            feedback_type="like",
        )
        db.add(feedback)
        try:
            db.commit()
            db.refresh(feedback)
            return FeedbackResponse(
                id=feedback.id,
                user_id=feedback.user_id,
                movie_id=feedback.movie_id,
                feedback_type=feedback.feedback_type,
                created_at=feedback.created_at,
                updated_at=feedback.updated_at,
            )
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Failed to save feedback") from None


@router.post("/dislike", response_model=FeedbackResponse, summary="Dislike a movie")
def dislike_movie(request: FeedbackRequest, db: Annotated[Session, Depends(get_db)]) -> FeedbackResponse:
    """Dislike a movie (updates if already exists)."""
    if request.feedback_type != "dislike":
        raise HTTPException(status_code=422, detail="Use feedback_type='dislike'")

    stmt = select(UserMovieFeedback).where(
        UserMovieFeedback.user_id == request.user_id,
        UserMovieFeedback.movie_id == request.movie_id,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    if existing:
        existing.feedback_type = "dislike"
        db.commit()
        db.refresh(existing)
        return FeedbackResponse(
            id=existing.id,
            user_id=existing.user_id,
            movie_id=existing.movie_id,
            feedback_type=existing.feedback_type,
            created_at=existing.created_at,
            updated_at=existing.updated_at,
        )
    else:
        feedback = UserMovieFeedback(
            user_id=request.user_id,
            movie_id=request.movie_id,
            feedback_type="dislike",
        )
        db.add(feedback)
        try:
            db.commit()
            db.refresh(feedback)
            return FeedbackResponse(
                id=feedback.id,
                user_id=feedback.user_id,
                movie_id=feedback.movie_id,
                feedback_type=feedback.feedback_type,
                created_at=feedback.created_at,
                updated_at=feedback.updated_at,
            )
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Failed to save feedback") from None


@router.post("/interaction", response_model=InteractionResponse, summary="Record a recommendation impression or movie-detail open")
def record_interaction(
    request: InteractionRequest, db: Annotated[Session, Depends(get_db)]
) -> InteractionResponse:
    """Persist an observed recommendation impression or movie-detail open.

    These events are activity history only; they do not currently affect ranking.
    """
    interaction = RecommendationInteraction(
        user_id=request.user_id,
        movie_id=request.movie_id,
        interaction_type=request.interaction_type,
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return InteractionResponse(
        id=interaction.id,
        movie_id=interaction.movie_id,
        interaction_type=interaction.interaction_type,
        created_at=interaction.created_at,
    )


@router.get("/history/{user_id}", response_model=UserFeedbackHistoryResponse, summary="Get user feedback history")
def get_user_history(user_id: str, db: Annotated[Session, Depends(get_db)]) -> UserFeedbackHistoryResponse:
    """Retrieve all feedback for a user."""
    ratings_stmt = select(UserMovieRating).where(UserMovieRating.user_id == user_id)
    ratings = db.execute(ratings_stmt).scalars().all()

    feedback_stmt = select(UserMovieFeedback).where(UserMovieFeedback.user_id == user_id)
    feedback = db.execute(feedback_stmt).scalars().all()

    interactions_stmt = select(RecommendationInteraction).where(RecommendationInteraction.user_id == user_id)
    interactions = db.execute(interactions_stmt).scalars().all()

    return UserFeedbackHistoryResponse(
        user_id=user_id,
        ratings=[
            RatingResponse(
                id=r.id,
                user_id=r.user_id,
                movie_id=r.movie_id,
                catalog=r.catalog,
                rating=r.rating,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in ratings
        ],
        feedback=[
            FeedbackResponse(
                id=f.id,
                user_id=f.user_id,
                movie_id=f.movie_id,
                feedback_type=f.feedback_type,
                created_at=f.created_at,
                updated_at=f.updated_at,
            )
            for f in feedback
        ],
        interactions=[{"id": i.id, "movie_id": i.movie_id, "interaction_type": i.interaction_type, "created_at": i.created_at.isoformat()} for i in interactions],
    )
