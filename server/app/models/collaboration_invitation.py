from datetime import datetime, timezone
import uuid
import secrets
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_invitation_id() -> str:
    return f"inv_{uuid.uuid4().hex[:12]}"

def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)

class CollaborationInvitation(Base):
    __tablename__ = "collaboration_invitations"

    id = Column(String(64), primary_key=True, default=generate_invitation_id)
    token = Column(String(128), unique=True, nullable=False, index=True, default=generate_invitation_token)
    inviter_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt_id = Column(String(64), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=True, index=True)
    scope = Column(String(50), default="prompt")  # "prompt" or "workspace"
    role = Column(String(50), default="Reviewer")  # "Viewer", "Reviewer", "Editor"
    invited_email = Column(String(191), nullable=True, index=True)  # Set for targeted email, None for open link
    invited_name = Column(String(100), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    max_uses = Column(Integer, default=1)  # 1 for single-use / email, N for multi-use link
    use_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    accepted_at = Column(DateTime, nullable=True)
    accepted_by = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    # Relationships
    inviter = relationship("User", foreign_keys=[inviter_id])
    accepted_user = relationship("User", foreign_keys=[accepted_by])
    prompt = relationship("Prompt")
