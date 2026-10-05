from typing import Optional
from pydantic import BaseModel, Field, model_validator

class CommentCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    version_tag: Optional[str] = None
    versionTag: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_version(cls, data):
        if isinstance(data, dict):
            if not data.get("version_tag") and data.get("versionTag"):
                data["version_tag"] = data["versionTag"]
        return data

class CommentResponse(BaseModel):
    id: str
    promptId: str
    userId: str
    userName: str
    userEmail: str
    userRole: str
    versionTag: Optional[str] = None
    content: str
    likesCount: int
    createdAt: str
    canDelete: bool = False
