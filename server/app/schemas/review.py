from typing import Optional
from pydantic import BaseModel, Field, model_validator

class RequestReviewRequest(BaseModel):
    reviewer_email: Optional[str] = None
    reviewerEmail: Optional[str] = None
    message: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        if isinstance(data, dict):
            if not data.get("reviewer_email") and data.get("reviewerEmail"):
                data["reviewer_email"] = data["reviewerEmail"]
        return data

class ReviewActionRequest(BaseModel):
    action: str = Field(..., description="'approve' or 'request_changes'")
    comment: Optional[str] = None
    feedback: Optional[str] = None

class ReviewStatusResponse(BaseModel):
    versionId: str
    versionNumber: str
    reviewStatus: str  # DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED
    reviewerName: Optional[str] = None
    reviewerEmail: Optional[str] = None
    reviewMessage: Optional[str] = None
    reviewFeedback: Optional[str] = None
    reviewRequestedAt: Optional[str] = None
    reviewedAt: Optional[str] = None
