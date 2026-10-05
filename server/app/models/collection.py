from datetime import datetime, timezone
import uuid
from typing import List, Union
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_col_id() -> str:
    return f"col_{uuid.uuid4().hex[:12]}"

collection_prompts = Table(
    "collection_prompts",
    Base.metadata,
    Column("collection_id", String(64), ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
    Column("prompt_id", String(64), ForeignKey("prompts.id", ondelete="CASCADE"), primary_key=True)
)

class Collection(Base):
    __tablename__ = "collections"

    id = Column(String(64), primary_key=True, default=generate_col_id)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    icon = Column(String(50), default="FolderKanban")
    color = Column(String(50), default="blue")
    default_tags = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="collections")
    prompts = relationship("Prompt", secondary=collection_prompts, back_populates="collections")

    @property
    def default_tags_list(self) -> List[str]:
        if not self.default_tags:
            return []
        return [t.strip().replace("#", "") for t in self.default_tags.split(",") if t.strip()]

    @default_tags_list.setter
    def default_tags_list(self, tags: Union[List[str], str, None]):
        if isinstance(tags, list):
            self.default_tags = ", ".join([str(t).strip().replace("#", "") for t in tags if str(t).strip()])
        elif isinstance(tags, str):
            self.default_tags = tags.strip()
        else:
            self.default_tags = ""
