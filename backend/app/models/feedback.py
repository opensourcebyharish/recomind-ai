"""SQLAlchemy models for user feedback."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class UserMovieRating(Base):
    """User rating for a movie (1-5 scale as per documentation)."""

    __tablename__ = "user_movie_ratings"
    __table_args__ = (UniqueConstraint("user_id", "movie_id", name="uq_user_movie_rating"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    movie_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    catalog: Mapped[str] = mapped_column(String(16), nullable=False, default="local", server_default=text("'local'"))
    rating: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class UserMovieFeedback(Base):
    """Like/dislike feedback for movies."""

    __tablename__ = "user_movie_feedback"
    __table_args__ = (UniqueConstraint("user_id", "movie_id", name="uq_user_movie_feedback"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    movie_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    feedback_type: Mapped[str] = mapped_column(String, nullable=False)  # "like" or "dislike"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class RecommendationInteraction(Base):
    """Optional interaction events with recommendations."""

    __tablename__ = "recommendation_interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    movie_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    interaction_type: Mapped[str] = mapped_column(String, nullable=False)  # "click", "view"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
