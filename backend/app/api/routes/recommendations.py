"""Recommendation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.logging import get_logger
from app.schemas.recommendation import (
    RecommendationItem,
    RecommendationRequest,
    RecommendationResponse,
)
from app.services.recommender_service import (
    get_cf_recommender,
    get_dataset_path,
    get_movielens_paths,
    get_recommender,
)
from ml.data.movielens_preprocess import MovieLensDataError
from ml.data.preprocess import MovieDataError

logger = get_logger(__name__)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post(
    "",
    response_model=RecommendationResponse,
    summary="Get movie recommendations",
    description=(
        "Generate recommendations using content-based (TF-IDF + cosine similarity) "
        "or item-based collaborative filtering. Supports similar-to-a-movie, "
        "recommendations from liked movies, and user-based collaborative recommendations."
    ),
)
def get_recommendations(request: RecommendationRequest) -> RecommendationResponse:
    dataset_str = str(get_dataset_path())
    movies_path, ratings_path = get_movielens_paths()

    try:
        if request.algorithm == "collaborative":
            if request.user_id is None:
                raise HTTPException(status_code=422, detail="user_id is required for collaborative filtering")
            try:
                cf_recommender = get_cf_recommender()
            except MovieLensDataError as exc:
                logger.error("MovieLens dataset unavailable: %s", exc)
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            except Exception as exc:
                logger.exception("Failed to initialize collaborative filtering engine")
                raise HTTPException(
                    status_code=500, detail="Failed to initialize collaborative filtering engine."
                ) from exc

            try:
                recs = cf_recommender.recommend_for_user(request.user_id, top_n=request.top_n)
                items = []
                for r in recs:
                    items.append(
                        RecommendationItem(
                            movie_id=r.movie_id,
                            title=r.title,
                            genres=r.genres,
                            release_year=r.release_year,
                            vote_average=None,
                            similarity_score=None,
                            score=r.score,
                            explanation=r.explanation,
                        )
                    )
                return RecommendationResponse(
                    mode="similar",
                    algorithm="collaborative",
                    source_movie_id=None,
                    liked_movie_ids=None,
                    user_id=request.user_id,
                    catalog="movielens",
                    count=len(items),
                    recommendations=items,
                    dataset=str(movies_path),
                )
            except MovieLensDataError as exc:
                detail = str(exc)
                if "unknown userid" in detail.lower():
                    raise HTTPException(status_code=404, detail=detail) from exc
                raise HTTPException(status_code=400, detail=detail) from exc
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            except Exception:
                logger.exception("Unexpected error while generating collaborative recommendations")
                raise HTTPException(
                    status_code=500, detail="Failed to generate collaborative recommendations."
                ) from exc

        # Content-based algorithm (default)
        try:
            recommender = get_recommender()
        except MovieDataError as exc:
            logger.error("Recommendation dataset unavailable: %s", exc)
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Failed to initialize recommendation engine")
            raise HTTPException(
                status_code=500, detail="Failed to initialize recommendation engine."
            ) from exc

        try:
            if request.mode == "similar":
                if not request.movie_id:
                    raise HTTPException(
                        status_code=422, detail="movie_id is required when mode='similar'"
                    )
                recs = recommender.recommend_similar(
                    movie_id=request.movie_id,
                    top_n=request.top_n,
                    genre_preference=request.genre_preference,
                    min_vote_average=request.min_vote_average,
                    exclude_ids=request.exclude_ids,
                    exclude_rated_by_user=request.exclude_rated_by_user,
                )
                items = [RecommendationItem(**r.__dict__, score=None) for r in recs]
                return RecommendationResponse(
                    mode="similar",
                    algorithm="content",
                    source_movie_id=request.movie_id,
                    liked_movie_ids=None,
                    user_id=None,
                    catalog="local",
                    count=len(items),
                    recommendations=items,
                    dataset=dataset_str,
                )
            else:  # liked
                if not request.liked_movie_ids:
                    raise HTTPException(
                        status_code=422,
                        detail="liked_movie_ids is required when mode='liked'",
                    )
                recs = recommender.recommend_from_liked(
                    liked_movie_ids=request.liked_movie_ids,
                    top_n=request.top_n,
                    genre_preference=request.genre_preference,
                    min_vote_average=request.min_vote_average,
                    exclude_ids=request.exclude_ids,
                    exclude_rated_by_user=request.exclude_rated_by_user,
                )
                items = [RecommendationItem(**r.__dict__, score=None) for r in recs]
                return RecommendationResponse(
                    mode="liked",
                    algorithm="content",
                    source_movie_id=None,
                    liked_movie_ids=request.liked_movie_ids,
                    user_id=None,
                    catalog="local",
                    count=len(items),
                    recommendations=items,
                    dataset=dataset_str,
                )
        except HTTPException:
            raise
        except MovieDataError as exc:
            detail = str(exc)
            if "unknown movie_id" in detail.lower():
                raise HTTPException(status_code=404, detail=detail) from exc
            raise HTTPException(status_code=400, detail=detail) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=f"Unknown movie_id: {exc}") from exc
        except ValueError as exc:
            detail = str(exc)
            if "unknown movie_id" in detail.lower():
                raise HTTPException(status_code=404, detail=detail) from exc
            raise HTTPException(status_code=422, detail=detail) from exc
        except Exception:
            logger.exception("Unexpected error while generating recommendations")
            raise HTTPException(
                status_code=500, detail="Failed to generate recommendations."
            ) from exc
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in recommendations endpoint")
        raise HTTPException(status_code=500, detail="Failed to process recommendation request.")
