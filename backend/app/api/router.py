"""Aggregate API router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import feedback, personalized, recommendations, system, tmdb

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(recommendations.router, prefix="/api")
api_router.include_router(feedback.router, prefix="/api")
api_router.include_router(tmdb.router, prefix="/api")
api_router.include_router(personalized.router, prefix="/api")
