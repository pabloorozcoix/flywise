"""Browser-Use Flight Search Service — FastAPI application entry-point.

This module creates the FastAPI application instance with:
- CORS middleware for cross-origin requests
- Lifespan event for startup/shutdown
- All route registrations via the ``api_router``

Usage (uvicorn)::

    uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.logger import configure_logging, get_logger
from app.routes import api_router
from app.services import search as search_service

# Configure logging before anything else
configure_logging()

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    settings = get_settings()
    search_service.initialize(settings.max_concurrent_searches)
    logger.info(
        "Browser-Use service started "
        f"(max_concurrent_searches={settings.max_concurrent_searches})"
    )
    yield
    logger.info("Browser-Use service shutting down")


app = FastAPI(
    title="Browser-Use Flight Search Service",
    description="FastAPI wrapper around browser-use for AI-powered flight search",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development (lock down in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routes
app.include_router(api_router)
