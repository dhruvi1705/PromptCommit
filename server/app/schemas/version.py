from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class VersionCreate(BaseModel):
    version_tag: Optional[str] = None
    version_number: Optional[str] = None
    commit_message: Optional[str] = None
    commitMessage: Optional[str] = None
    description: Optional[str] = ""
    diff_notes: Optional[str] = ""
    content: str = Field(..., min_length=1)
    provider: Optional[str] = None
    model: Optional[str] = None
    target_model: Optional[str] = None
    targetModel: Optional[str] = None

class VersionResponse(BaseModel):
    id: str
    prompt_id: str
    version: str
    commitMessage: str
    description: Optional[str] = ""
    diffNotes: Optional[str] = ""
    content: str
    author: Optional[str] = "Author"
    isCurrent: bool = False
    model: Optional[str] = "gemini-3.6-flash"
    targetModel: Optional[str] = "gemini-3.6-flash"
    timestamp: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
