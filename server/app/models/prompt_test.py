from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Float
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_test_id() -> str:
    return f"tst_{uuid.uuid4().hex[:12]}"

class PromptTest(Base):
    __tablename__ = "prompt_tests"

    id = Column(String(64), primary_key=True, default=generate_test_id)
    prompt_id = Column(String(64), ForeignKey("prompts.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    input_text = Column(Text, default="")
    output_text = Column(Text, default="")
    response_time_ms = Column(Integer, default=0)
    status = Column(String(50), default="success")
    rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="tests")
    prompt = relationship("Prompt", back_populates="tests")
