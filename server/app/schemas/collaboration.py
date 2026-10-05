from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class CreateEmailInviteRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: str = Field(default="Reviewer", description="Viewer, Reviewer, or Editor")
    prompt_id: Optional[str] = None
    promptId: Optional[str] = None
    scope: Optional[str] = "workspace"
    expiration_days: Optional[int] = Field(default=7, description="1, 7, 30, or None for never")
    expiresInDays: Optional[int] = None

class CreateShareLinkRequest(BaseModel):
    role: str = Field(default="Reviewer", description="Viewer, Reviewer, or Editor")
    prompt_id: Optional[str] = None
    promptId: Optional[str] = None
    scope: Optional[str] = "workspace"
    expiration_days: Optional[int] = Field(default=7, description="1, 7, 30, or None for never")
    expiresInDays: Optional[int] = None
    max_uses: Optional[int] = Field(default=None, ge=1, le=1000)
    maxUses: Optional[int] = None

class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., description="Viewer, Reviewer, or Editor")

class InvitationPublicResponse(BaseModel):
    token: str
    valid: bool = True
    inviterName: str
    inviterEmail: str
    promptId: Optional[str] = None
    promptTitle: Optional[str] = None
    promptCategory: Optional[str] = None
    scope: str
    role: str
    invitedEmail: Optional[str] = None
    expiresAt: Optional[str] = None
    isExpired: bool
    isActive: bool
    isOwner: bool
    status: str
    statusCode: Optional[str] = "VALID"  # VALID, EXPIRED, REVOKED, ALREADY_ACCEPTED, USAGE_LIMIT_REACHED, INVALID, EMAIL_MISMATCH
    statusMessage: Optional[str] = None

class InvitationItemResponse(BaseModel):
    id: str
    token: str
    inviteUrl: str
    type: str  # "email" or "link"
    recipientEmail: Optional[str] = None
    recipientName: Optional[str] = None
    promptId: Optional[str] = None
    promptTitle: str
    scope: str
    role: str
    expiresAt: Optional[str] = None
    createdAt: str
    status: str
    useCount: int
    maxUses: Optional[int] = None
    emailSent: Optional[bool] = None
    emailError: Optional[str] = None
    recipientUserFound: Optional[bool] = None

class CollaboratorMemberItem(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatar: str
    avatarBg: str
    status: str
    promptsCount: int
    sharedPrompts: List[dict]
    joinedAt: str

class CollaborationOverviewResponse(BaseModel):
    membersCount: int
    sharedPromptsCount: int
    pendingInvitesCount: int
    activeLinksCount: int
