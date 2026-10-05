from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.collaboration_invitation import CollaborationInvitation
from app.models.prompt import Prompt
from app.models.prompt_share import PromptShare
from app.models.user import User
from app.models.notification import Notification
from app.schemas.collaboration import InvitationPublicResponse
from app.utils.dependencies import get_current_user, get_optional_current_user

router = APIRouter(prefix="/invitations", tags=["Collaboration Invitations"])

def format_datetime_str(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%b %d, %Y %I:%M %p")

@router.get("/{token}", response_model=InvitationPublicResponse)
def get_invitation_by_token(
    token: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Public endpoint to inspect an invitation before accepting."""
    inv = db.query(CollaborationInvitation).filter(CollaborationInvitation.token == token.strip()).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or link is invalid.")

    now = datetime.now(timezone.utc)
    # Ensure expires_at is timezone-aware for comparison
    expires_at = inv.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    is_expired = expires_at is not None and expires_at < now
    is_exhausted = inv.max_uses is not None and inv.use_count >= inv.max_uses
    formatted_exp = format_datetime_str(inv.expires_at)
    is_email_invite = bool(inv.invited_email)
    is_email_accepted = is_email_invite and (inv.accepted_at is not None or inv.use_count > 0)

    # Determine display status and granular status code
    if is_email_accepted:
        status_text = "Accepted"
        status_code = "ACCEPTED"
        status_message = "This invitation has already been accepted."
    elif is_exhausted or (not is_email_invite and inv.max_uses and inv.use_count >= inv.max_uses):
        status_text = "Limit Reached"
        status_code = "USAGE_LIMIT_REACHED"
        status_message = "This invitation link has reached its usage limit."
    elif inv.revoked_at or not inv.is_active:
        status_text = "Revoked"
        status_code = "REVOKED"
        status_message = "This invitation was revoked by the workspace owner."
    elif is_expired:
        status_text = "Expired"
        status_code = "EXPIRED"
        status_message = f"This invitation expired on {formatted_exp}." if formatted_exp else "This invitation has expired."
    elif current_user and inv.invited_email and current_user.email.strip().lower() != inv.invited_email.strip().lower():
        status_text = "Email Mismatch"
        status_code = "EMAIL_MISMATCH"
        status_message = "This invitation was sent to a different email address."
    else:
        status_text = "Active"
        status_code = "ACTIVE"
        status_message = "Valid invitation."

    prompt_title = "All Workspace Prompts"
    prompt_category = "Workspace"
    if inv.prompt_id:
        p = db.query(Prompt).filter(Prompt.id == inv.prompt_id).first()
        if p:
            prompt_title = p.title
            prompt_category = p.category or "General"
        else:
            prompt_title = "Deleted Prompt"

    inviter_name = inv.inviter.name if inv.inviter else "Workspace Owner"
    inviter_email = inv.inviter.email if inv.inviter else ""

    is_owner = current_user is not None and current_user.id == inv.inviter_id
    is_valid = (status_code == "ACTIVE")

    return {
        "token": inv.token,
        "valid": is_valid,
        "inviterName": inviter_name,
        "inviterEmail": inviter_email,
        "promptId": inv.prompt_id,
        "promptTitle": prompt_title,
        "promptCategory": prompt_category,
        "scope": inv.scope,
        "role": inv.role,
        "invitedEmail": inv.invited_email,
        "expiresAt": formatted_exp,
        "isExpired": is_expired,
        "isActive": is_valid,
        "isOwner": is_owner,
        "status": status_text,
        "statusCode": status_code,
        "statusMessage": status_message
    }

@router.post("/{token}/accept")
def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Authenticated endpoint to accept an invitation and grant PromptShare access."""
    inv = db.query(CollaborationInvitation).filter(CollaborationInvitation.token == token.strip()).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or link is invalid.")

    # 1. Check explicit revocation first
    if inv.revoked_at:
        raise HTTPException(status_code=400, detail="This invitation link has been revoked by the workspace owner.")

    # 2. Check expiration
    now = datetime.now(timezone.utc)
    expires_at = inv.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at and expires_at < now:
        inv.is_active = False
        db.commit()
        raise HTTPException(status_code=400, detail="This invitation has expired.")

    # 3. Check if single-use email invitation has already been accepted
    if inv.invited_email and (inv.accepted_at is not None or inv.use_count > 0):
        raise HTTPException(status_code=400, detail="This invitation has already been accepted.")

    # 4. Check if multi-use link or open share link has reached its maximum usage limit
    if inv.max_uses and inv.use_count >= inv.max_uses:
        inv.is_active = False
        db.commit()
        raise HTTPException(status_code=400, detail="This invitation link has reached its usage limit.")

    # 5. Check if deactivated otherwise
    if not inv.is_active:
        raise HTTPException(status_code=400, detail="This invitation link has been revoked by the workspace owner.")

    # 6. Workspace owner cannot accept own invitation
    if current_user.id == inv.inviter_id:
        raise HTTPException(status_code=400, detail="You are the owner of this workspace and already have full access.")

    # 7. Email restriction verification
    if inv.invited_email:
        if current_user.email.strip().lower() != inv.invited_email.strip().lower():
            raise HTTPException(
                status_code=403,
                detail=f"This invitation was sent to {inv.invited_email}. Please switch to that account to accept."
            )

    # Grant PromptShare access
    target_role = inv.role or "Reviewer"
    recipient_email = current_user.email.strip().lower()
    recipient_name = current_user.name.strip() or recipient_email.split("@")[0]

    prompts_to_share = []
    if inv.prompt_id:
        p = db.query(Prompt).filter(Prompt.id == inv.prompt_id, Prompt.user_id == inv.inviter_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="The prompt associated with this invitation no longer exists.")
        prompts_to_share.append(p)
    else:
        # Workspace scope: grant access to all inviter's prompts
        prompts_to_share = db.query(Prompt).filter(Prompt.user_id == inv.inviter_id).all()

    for p in prompts_to_share:
        existing_share = db.query(PromptShare).filter(
            PromptShare.prompt_id == p.id,
            PromptShare.shared_with_email == recipient_email
        ).first()

        if existing_share:
            existing_share.role = target_role
            existing_share.shared_with_name = recipient_name
        else:
            new_share = PromptShare(
                prompt_id=p.id,
                shared_with_email=recipient_email,
                shared_with_name=recipient_name,
                role=target_role
            )
            db.add(new_share)

    # Update invitation usage tracking
    inv.use_count += 1
    inv.accepted_at = now
    inv.accepted_by = current_user.id

    if inv.max_uses and inv.use_count >= inv.max_uses:
        inv.is_active = False

    # Mark existing notification for recipient as read
    db.query(Notification).filter(
        Notification.invitation_id == inv.id,
        Notification.user_id == current_user.id
    ).update({"is_read": True, "read_at": now})

    # Create notification for inviter
    prompt_desc = f"prompt '{prompts_to_share[0].title}'" if len(prompts_to_share) == 1 else "workspace prompts"
    accept_notif = Notification(
        user_id=inv.inviter_id,
        sender_id=current_user.id,
        title="Invitation Accepted",
        message=f"{current_user.name} accepted your invitation to collaborate on {prompt_desc} as {target_role}.",
        type="INVITATION_ACCEPTED",
        action_url="/app/collaboration",
        invitation_id=inv.id
    )
    db.add(accept_notif)

    db.commit()

    return {
        "success": True,
        "message": f"Successfully joined {inv.inviter.name}'s prompt workspace as {target_role}!",
        "role": target_role,
        "promptId": inv.prompt_id,
        "promptsGranted": len(prompts_to_share)
    }

@router.post("/{token}/decline")
def decline_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Decline an invitation and notify the inviter."""
    inv = db.query(CollaborationInvitation).filter(CollaborationInvitation.token == token.strip()).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    # 1. Owner cannot decline own invitation
    if current_user.id == inv.inviter_id:
        raise HTTPException(status_code=400, detail="You are the owner of this workspace and cannot decline your own invitation.")

    # 2. Cannot decline an already accepted invitation
    if inv.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot decline an already accepted invitation.")

    # 3. Check email restriction
    if inv.invited_email:
        if current_user.email.strip().lower() != inv.invited_email.strip().lower():
            raise HTTPException(
                status_code=403,
                detail=f"This invitation was sent to {inv.invited_email}. Please switch to that account to decline."
            )

    # 4. Deactivate invitation & mark recipient notification as read
    now = datetime.now(timezone.utc)
    inv.is_active = False

    print(
        "[DECLINE DEBUG]",
        "invitation=", inv.id,
        "inviter=", inv.inviter_id,
        "decliner=", current_user.id
    )

    db.query(Notification).filter(
        Notification.invitation_id == inv.id,
        Notification.user_id == current_user.id
    ).update({"is_read": True, "read_at": now})

    # 5. Create in-app notification for sender (inviter_id) with duplicate prevention
    existing_decline_notif = db.query(Notification).filter(
        Notification.invitation_id == inv.id,
        Notification.type == "COLLABORATION_INVITATION_DECLINED",
        Notification.user_id == inv.inviter_id
    ).first()

    if not existing_decline_notif:
        recipient_name = current_user.name.strip() if current_user.name else (inv.invited_name or inv.invited_email or "A user")
        prompt_desc = "workspace prompts"
        if inv.prompt_id:
            p = db.query(Prompt).filter(Prompt.id == inv.prompt_id).first()
            if p:
                prompt_desc = f"prompt '{p.title}'"

        decline_notif = Notification(
            user_id=inv.inviter_id,
            sender_id=current_user.id,
            title="Invitation Declined",
            message=f"{recipient_name} declined your collaboration invitation for {prompt_desc}.",
            type="COLLABORATION_INVITATION_DECLINED",
            action_url="/app/collaboration",
            invitation_id=inv.id
        )
        db.add(decline_notif)
        db.flush()
        print(
            "[DECLINE NOTIFICATION DEBUG]",
            decline_notif.id,
            decline_notif.user_id,
            decline_notif.sender_id,
            decline_notif.type
        )

    db.commit()

    return {
        "success": True,
        "message": "Invitation declined."
    }
