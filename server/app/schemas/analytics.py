from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class CategoryMetric(BaseModel):
    name: str
    count: int
    percentage: int
    color: str
    text: str
    hex: Optional[str] = None

class ModelUsageMetric(BaseModel):
    model: str
    provider: str
    providerDisplay: str = ""
    testsCount: int
    avgLatencyMs: int

class ActivityItem(BaseModel):
    id: str
    userId: str
    type: str
    title: str
    meta: str
    time: str
    icon: str
    color: str

class DailyActivityMetric(BaseModel):
    date: str
    day: str
    tests: int
    test_count: int
    commits: int
    isToday: bool

class AnalyticsOverviewResponse(BaseModel):
    totalPrompts: int
    totalVersions: int
    totalFavorites: int
    totalTested: int
    totalCollections: int
    avgLatencyMs: int
    avgPromptRating: Optional[float] = None
    avgVersionsPerPrompt: float
    categories: List[CategoryMetric]
    modelStats: List[ModelUsageMetric]
    recentActivities: List[ActivityItem]
    dailyActivity: List[DailyActivityMetric] = []
