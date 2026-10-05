from typing import Optional, List
from pydantic import BaseModel, Field

class NotificationItemResponse(BaseModel):
    id: str
    userId: str
    senderId: Optional[str] = None
    senderName: Optional[str] = None
    senderAvatar: Optional[str] = None
    title: str
    message: str
    type: str
    actionUrl: Optional[str] = None
    invitationId: Optional[str] = None
    isRead: bool
    createdAt: str
    timeAgo: Optional[str] = None

    class Config:
        populate_by_name = True

class NotificationListResponse(BaseModel):
    items: List[NotificationItemResponse]
    unreadCount: int
    totalCount: int
