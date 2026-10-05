from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Float, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.collection import collection_prompts

def generate_prompt_id() -> str:
    return f"p_{uuid.uuid4().hex[:12]}"

class PromptTag(Base):
    __tablename__ = "prompt_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prompt_id = Column(String(64), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False, index=True)
    tag = Column(String(100), nullable=False, index=True)

    prompt = relationship("Prompt", back_populates="tags_rel")

class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(String(64), primary_key=True, default=generate_prompt_id)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    content = Column(Text, nullable=False)
    category = Column(String(100), default="Coding", index=True)
    collection_name = Column(String(100), default=None)
    target_model = Column(String(100), default="gemini-3.6-flash")
    version = Column(String(30), default="v1.0")
    rating = Column(Float, nullable=True, default=None)
    rating_count = Column(Integer, default=0)
    test_count = Column(Integer, default=0)
    avg_latency_ms = Column(Integer, default=180)
    is_private = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="prompts")
    tags_rel = relationship("PromptTag", back_populates="prompt", cascade="all, delete-orphan")
    versions = relationship("PromptVersion", back_populates="prompt", cascade="all, delete-orphan", order_by="desc(PromptVersion.created_at)")
    favorites = relationship("Favorite", back_populates="prompt", cascade="all, delete-orphan")
    tests = relationship("PromptTest", back_populates="prompt", passive_deletes=True)
    shares = relationship("PromptShare", back_populates="prompt", cascade="all, delete-orphan")
    comments = relationship("PromptComment", back_populates="prompt", cascade="all, delete-orphan", order_by="desc(PromptComment.created_at)")
    collections = relationship("Collection", secondary=collection_prompts, back_populates="prompts")

    @property
    def tags(self):
        return [t.tag for t in self.tags_rel]
