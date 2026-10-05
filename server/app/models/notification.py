from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_notification_id() -> str:
    return f"notif_{uuid.uuid4().hex[:12]}"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(64), primary_key=True, default=generate_notification_id)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(64), default="COLLABORATION_INVITATION", index=True)  # COLLABORATION_INVITATION, INVITATION_ACCEPTED, SYSTEM
    action_url = Column(String(255), nullable=True)  # e.g. "/invite/<token>"
    invitation_id = Column(String(64), ForeignKey("collaboration_invitations.id", ondelete="CASCADE"), nullable=True, index=True)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    read_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    sender = relationship("User", foreign_keys=[sender_id])
    invitation = relationship("CollaborationInvitation", foreign_keys=[invitation_id])
