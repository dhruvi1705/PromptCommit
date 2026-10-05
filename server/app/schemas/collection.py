from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = "Curated prompt collection."
    icon: Optional[str] = "FolderKanban"
    color: Optional[str] = "blue"
    defaultTags: Optional[List[str]] = []

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    defaultTags: Optional[List[str]] = None

class CollectionResponse(BaseModel):
    id: str
    userId: str
    name: str
    description: str
    icon: str
    color: str
    defaultTags: List[str] = []
    promptCount: int = 0
    promptsCount: Optional[int] = 0
    gradient: Optional[str] = "from-blue-500/20 to-indigo-500/10"
    border: Optional[str] = "border-blue-500/30"
    createdAt: Optional[str] = None

    class Config:
        from_attributes = True
