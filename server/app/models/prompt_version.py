from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_version_id() -> str:
    return f"ver_{uuid.uuid4().hex[:12]}"

class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(String(64), primary_key=True, default=generate_version_id)
    prompt_id = Column(String(64), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(String(30), nullable=False)
    commit_message = Column(String(255), nullable=False)
    description = Column(Text, default="")
    diff_notes = Column(Text, default="")
    content = Column(Text, nullable=False)
    author_name = Column(String(100), default="Unknown author")
    is_current = Column(Boolean, default=False)
    
    # Review Workflow Fields (DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED)
    review_status = Column(String(30), default="DRAFT", index=True)
    reviewer_id = Column(String(64), nullable=True)
    reviewer_name = Column(String(100), nullable=True)
    reviewer_email = Column(String(255), nullable=True)
    review_message = Column(Text, nullable=True)
    review_feedback = Column(Text, nullable=True)
    review_requested_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    prompt = relationship("Prompt", back_populates="versions")
