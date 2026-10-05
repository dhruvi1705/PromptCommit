from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsOverviewResponse, DailyActivityMetric
from app.services.analytics_service import analytics_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview", response_model=AnalyticsOverviewResponse)
def get_analytics_overview(
    days: Optional[int] = Query(7, ge=1, le=90, description="Number of days in analytics range (e.g. 7, 14, 30)"),
    range: Optional[str] = Query(None, description="Time range string (e.g. '7d', '14d', '30d')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return analytics_service.get_user_analytics(current_user.id, db, days=days or 7, time_range=range)

@router.get("/daily", response_model=List[DailyActivityMetric])
@router.get("/timeseries", response_model=List[DailyActivityMetric])
def get_analytics_timeseries(
    days: Optional[int] = Query(7, ge=1, le=90, description="Number of days in analytics range (e.g. 7, 14, 30)"),
    range: Optional[str] = Query(None, description="Time range string (e.g. '7d', '14d', '30d')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    overview = analytics_service.get_user_analytics(current_user.id, db, days=days or 7, time_range=range)
    return overview.get("dailyActivity", [])
