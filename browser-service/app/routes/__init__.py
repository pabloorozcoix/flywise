"""Route aggregation — includes all endpoint routers."""

from fastapi import APIRouter

from app.routes.health import router as health_router
from app.routes.search import router as search_router
from app.routes.websocket import router as websocket_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(search_router)
api_router.include_router(websocket_router)
