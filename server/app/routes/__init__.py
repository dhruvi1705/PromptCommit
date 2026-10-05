from fastapi import APIRouter
from app.routes.health import router as health_router
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.prompts import router as prompts_router
from app.routes.versions import router as versions_router
from app.routes.collections import router as collections_router
from app.routes.favorites import router as favorites_router
from app.routes.tests import router as tests_router
from app.routes.analytics import router as analytics_router
from app.routes.collaboration import router as collaboration_router
from app.routes.invitations import router as invitations_router
from app.routes.notifications import router as notifications_router
from app.routes.comments import router as comments_router
from app.routes.reviews import router as reviews_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(prompts_router)
api_router.include_router(versions_router)
api_router.include_router(collections_router)
api_router.include_router(favorites_router)
api_router.include_router(tests_router)
api_router.include_router(analytics_router)
api_router.include_router(collaboration_router)
api_router.include_router(invitations_router)
api_router.include_router(notifications_router)
api_router.include_router(comments_router)
api_router.include_router(reviews_router)

__all__ = ["api_router"]

