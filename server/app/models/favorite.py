from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_fav_id() -> str:
    return f"fav_{uuid.uuid4().hex[:12]}"

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(String(64), primary_key=True, default=generate_fav_id)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt_id = Column(String(64), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "prompt_id", name="uq_user_prompt_favorite"),
    )

    # Relationships
    user = relationship("User", back_populates="favorites")
    prompt = relationship("Prompt", back_populates="favorites")
