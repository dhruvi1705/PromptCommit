from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_share_id() -> str:
    return f"shr_{uuid.uuid4().hex[:12]}"

class PromptShare(Base):
    __tablename__ = "prompt_shares"

    id = Column(String(64), primary_key=True, default=generate_share_id)
    prompt_id = Column(String(64), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False, index=True)
    shared_with_email = Column(String(191), nullable=False)
    shared_with_name = Column(String(100), default="Collaborator")
    role = Column(String(50), default="Reviewer")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    prompt = relationship("Prompt", back_populates="shares")
