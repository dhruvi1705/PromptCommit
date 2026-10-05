from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_comment_id() -> str:
    return f"cmt_{uuid.uuid4().hex[:12]}"

class PromptComment(Base):
    __tablename__ = "prompt_comments"

    id = Column(String(64), primary_key=True, default=generate_comment_id)
    prompt_id = Column(String(64), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_name = Column(String(100), default="Collaborator")
    user_email = Column(String(255), nullable=False)
    user_role = Column(String(50), default="Reviewer")
    version_tag = Column(String(30), nullable=True)  # e.g. "v2.1"
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    prompt = relationship("Prompt", back_populates="comments")
    user = relationship("User", foreign_keys=[user_id])
