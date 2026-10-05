from typing import Optional, List, Union
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.version import VersionResponse

class CollectionItemResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "FolderKanban"
    color: Optional[str] = "blue"

    class Config:
        from_attributes = True

class PromptCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    content: str = Field(..., min_length=1)
    category: Optional[str] = "Coding"
    collectionId: Optional[str] = None
    collection_id: Optional[str] = None
    collection: Optional[str] = None
    targetModel: Optional[str] = "gemini-3.6-flash"
    target_model: Optional[str] = None
    tags: Optional[Union[List[str], str]] = []
    isPrivate: Optional[bool] = True
    is_private: Optional[bool] = None

class PromptUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    collectionId: Optional[str] = None
    collection_id: Optional[str] = None
    collection: Optional[str] = None
    targetModel: Optional[str] = None
    target_model: Optional[str] = None
    tags: Optional[Union[List[str], str]] = None
    isPrivate: Optional[bool] = None
    is_private: Optional[bool] = None
    rating: Optional[float] = None

class PromptShareRequest(BaseModel):
    email: str = Field(..., min_length=3)
    role: Optional[str] = "Reviewer"
    name: Optional[str] = None

class PromptShareResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    avatar: str
    sharedAt: str

class PromptResponse(BaseModel):
    id: str
    userId: str
    title: str
    description: str
    content: str
    category: str
    collectionId: Optional[str] = None
    collection: Optional[str] = None
    collections: List[CollectionItemResponse] = []
    targetModel: str
    version: str
    rating: Optional[float] = None
    ratingCount: int = 0
    testCount: int = 0
    avgLatencyMs: int = 180
    isPrivate: bool
    isFavorite: bool
    tags: List[str]
    createdAt: str
    updatedAt: str
    shareLink: str
    sharedWith: List[PromptShareResponse] = []
    versions: List[VersionResponse] = []

    class Config:
        from_attributes = True

class PromptGenerateRequest(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = "Software Engineering"
    provider: Optional[str] = "Google Gemini"
    model: Optional[str] = "gemini-3.6-flash"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024

class PromptGenerateResponse(BaseModel):
    title: str
    prompt: str
    provider: str
    model: str
    status: str
    errorMessage: Optional[str] = None

class MetricEvaluation(BaseModel):
    clarity: int = Field(default=0, ge=0, le=100)
    specificity: int = Field(default=0, ge=0, le=100)
    completeness: int = Field(default=0, ge=0, le=100)
    structure: int = Field(default=0, ge=0, le=100)
    efficiency: int = Field(default=0, ge=0, le=100)
    overall: int = Field(default=0, ge=0, le=100)
    strengths: List[str] = []
    weaknesses: List[str] = []
    recommendations: List[str] = []

class ComparisonSummary(BaseModel):
    improvements: List[str] = []
    regressions: List[str] = []
    summary: str = ""

class PromptCompareRequest(BaseModel):
    promptAContent: str = Field(..., min_length=1)
    promptBContent: str = Field(..., min_length=1)
    promptATitle: Optional[str] = "Version A"
    promptBTitle: Optional[str] = "Version B"
    provider: Optional[str] = "Google Gemini"
    model: Optional[str] = "gemini-3.6-flash"

class PromptCompareResponse(BaseModel):
    versionA: MetricEvaluation
    versionB: MetricEvaluation
    comparison: ComparisonSummary
    provider: str
    model: str
    status: str
    errorMessage: Optional[str] = None


