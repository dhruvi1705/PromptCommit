from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.collaboration_invitation import CollaborationInvitation
from app.models.prompt import Prompt
from app.models.prompt_share import PromptShare
from app.models.prompt_version import PromptVersion
from app.models.prompt_comment import PromptComment
from app.models.user import User
from app.models.notification import Notification
from app.core.config import settings
from app.services.email_service import send_collaboration_invitation
from app.schemas.collaboration import (
    CreateEmailInviteRequest,
    CreateShareLinkRequest,
    UpdateMemberRoleRequest,
    InvitationItemResponse,
    CollaboratorMemberItem,
    CollaborationOverviewResponse
)
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/collaboration", tags=["Collaboration"])

def format_datetime_str(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%b %d, %Y %I:%M %p")

def calculate_expiration(days: Optional[int]) -> datetime:
    now = datetime.now(timezone.utc)
    if days is None or days <= 0:
        # "Never" -> 100 years in future
        return now + timedelta(days=36500)
    return now + timedelta(days=days)

@router.post("/invitations", response_model=InvitationItemResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(
    data: CreateEmailInviteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a targeted email invitation for a prompt or entire workspace."""
    clean_email = str(data.email).strip().lower()
    if clean_email == current_user.email.strip().lower():
        raise HTTPException(status_code=400, detail="You cannot invite your own email address.")

    role = data.role.strip() if data.role else "Reviewer"
    # Accept canonical roles and legacy variants; always normalize to canonical
    if role not in ["Viewer", "Reviewer", "Editor", "View Only", "Prompt Reviewer", "Prompt Editor"]:
        role = "Reviewer"

    # Normalize to canonical role names
    if "Editor" in role:
        role = "Editor"
    elif "View" in role:
        role = "Viewer"
    elif "Reviewer" in role:
        role = "Reviewer"
    else:
        role = "Reviewer"

    raw_prompt_id = data.prompt_id or data.promptId
    prompt_id = str(raw_prompt_id).strip() if raw_prompt_id and str(raw_prompt_id).strip() else None
    prompt_title = "All Workspace Prompts"

    if prompt_id:
        p = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.user_id == current_user.id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Prompt not found or access denied.")
        prompt_title = p.title

    exp_days = data.expiration_days if data.expiration_days is not None else data.expiresInDays
    expires_at = calculate_expiration(exp_days)

    # Deactivate existing pending email invites for the same prompt & email
    db.query(CollaborationInvitation).filter(
        CollaborationInvitation.inviter_id == current_user.id,
        CollaborationInvitation.invited_email == clean_email,
        CollaborationInvitation.prompt_id == prompt_id,
        CollaborationInvitation.is_active == True
    ).update({"is_active": False, "revoked_at": datetime.now(timezone.utc)})

    new_inv = CollaborationInvitation(
        inviter_id=current_user.id,
        prompt_id=prompt_id,
        scope="prompt" if prompt_id else "workspace",
        role=role,
        invited_email=clean_email,
        invited_name=data.name.strip() if data.name else None,
        expires_at=expires_at,
        is_active=True,
        max_uses=1,
        use_count=0
    )
    db.add(new_inv)
    db.flush()

    # 1. In-App Notification if recipient already has an account
    recipient_user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    recipient_user_found = False
    if recipient_user:
        recipient_user_found = True
        notif = Notification(
            user_id=recipient_user.id,
            sender_id=current_user.id,
            title="New Collaboration Invitation",
            message=f"{current_user.name} invited you to collaborate on {prompt_title} as {role}.",
            type="COLLABORATION_INVITATION",
            action_url=f"/invite/{new_inv.token}",
            invitation_id=new_inv.id
        )
        db.add(notif)

    # 2. Schedule asynchronous email delivery via Resend in background
    frontend_base = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    full_invite_url = f"{frontend_base}/invite/{new_inv.token}"

    background_tasks.add_task(
        send_collaboration_invitation,
        recipient_email=clean_email,
        inviter_name=current_user.name,
        prompt_name=prompt_title,
        role=role,
        invitation_url=full_invite_url,
        expiration_str=f"{exp_days} days" if exp_days else "No expiration",
        invitation_id=new_inv.id
    )

    db.commit()
    db.refresh(new_inv)

    return {
        "id": new_inv.id,
        "token": new_inv.token,
        "inviteUrl": full_invite_url,
        "type": "email",
        "recipientEmail": new_inv.invited_email,
        "recipientName": new_inv.invited_name,
        "promptId": new_inv.prompt_id,
        "promptTitle": prompt_title,
        "scope": new_inv.scope,
        "role": new_inv.role,
        "expiresAt": format_datetime_str(new_inv.expires_at),
        "createdAt": format_datetime_str(new_inv.created_at),
        "status": "Pending",
        "useCount": new_inv.use_count,
        "maxUses": new_inv.max_uses,
        "emailSent": True if settings.RESEND_API_KEY else False,
        "emailError": None,
        "recipientUserFound": recipient_user_found
    }

@router.post("/invitations/{invitation_id}/resend")
def resend_invitation(
    invitation_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resend email invitation and notification for an active pending invitation."""
    inv = db.query(CollaborationInvitation).filter(
        CollaborationInvitation.id == invitation_id,
        CollaborationInvitation.inviter_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    if not inv.is_active or inv.revoked_at:
        raise HTTPException(status_code=400, detail="Cannot resend a revoked or inactive invitation.")

    now = datetime.now(timezone.utc)
    expires_at = inv.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now:
        raise HTTPException(status_code=400, detail="Cannot resend an expired invitation. Please create a new invitation.")

    recipient_email = inv.invited_email
    if not recipient_email:
        raise HTTPException(status_code=400, detail="Cannot resend an open share link.")

    prompt_title = "All Workspace Prompts"
    if inv.prompt_id:
        p = db.query(Prompt).filter(Prompt.id == inv.prompt_id).first()
        if p:
            prompt_title = p.title

    recipient_user = db.query(User).filter(func.lower(User.email) == recipient_email.lower()).first()
    recipient_user_found = False
    if recipient_user:
        recipient_user_found = True
        notif = Notification(
            user_id=recipient_user.id,
            sender_id=current_user.id,
            title="Collaboration Invitation (Reminder)",
            message=f"{current_user.name} sent you a reminder to collaborate on {prompt_title} as {inv.role}.",
            type="COLLABORATION_INVITATION",
            action_url=f"/invite/{inv.token}",
            invitation_id=inv.id
        )
        db.add(notif)
        db.commit()

    frontend_base = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    full_invite_url = f"{frontend_base}/invite/{inv.token}"

    background_tasks.add_task(
        send_collaboration_invitation,
        recipient_email=recipient_email,
        inviter_name=current_user.name,
        prompt_name=prompt_title,
        role=inv.role,
        invitation_url=full_invite_url,
        expiration_str=format_datetime_str(inv.expires_at) or "7 days",
        invitation_id=inv.id
    )

    return {
        "success": True,
        "message": "Invitation resent successfully.",
        "emailSent": True if settings.RESEND_API_KEY else False,
        "emailError": None,
        "recipientUserFound": recipient_user_found,
        "inviteUrl": full_invite_url
    }

@router.post("/share-links", response_model=InvitationItemResponse, status_code=status.HTTP_201_CREATED)
def create_share_link(
    data: CreateShareLinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a shareable link that any authenticated collaborator can accept."""
    role = data.role.strip() if data.role else "Reviewer"
    if "Editor" in role:
        role = "Editor"
    elif "Viewer" in role or "View Only" in role:
        role = "Viewer"
    else:
        role = "Reviewer"

    raw_prompt_id = data.prompt_id or data.promptId
    prompt_id = str(raw_prompt_id).strip() if raw_prompt_id and str(raw_prompt_id).strip() else None
    prompt_title = "All Workspace Prompts"

    if prompt_id:
        p = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.user_id == current_user.id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Prompt not found or access denied.")
        prompt_title = p.title

    exp_days = data.expiration_days if data.expiration_days is not None else data.expiresInDays
    expires_at = calculate_expiration(exp_days)
    max_uses = data.max_uses if data.max_uses is not None else data.maxUses

    new_inv = CollaborationInvitation(
        inviter_id=current_user.id,
        prompt_id=prompt_id,
        scope="prompt" if prompt_id else "workspace",
        role=role,
        invited_email=None,
        invited_name=None,
        expires_at=expires_at,
        is_active=True,
        max_uses=max_uses,
        use_count=0
    )
    db.add(new_inv)
    db.commit()
    db.refresh(new_inv)

    return {
        "id": new_inv.id,
        "token": new_inv.token,
        "inviteUrl": f"/invite/{new_inv.token}",
        "type": "link",
        "recipientEmail": None,
        "recipientName": None,
        "promptId": new_inv.prompt_id,
        "promptTitle": prompt_title,
        "scope": new_inv.scope,
        "role": new_inv.role,
        "expiresAt": format_datetime_str(new_inv.expires_at),
        "createdAt": format_datetime_str(new_inv.created_at),
        "status": "Active",
        "useCount": new_inv.use_count,
        "maxUses": new_inv.max_uses
    }

@router.get("/invitations", response_model=List[InvitationItemResponse])
def list_owner_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all invitations (email invites & active links) created by current user."""
    invitations = db.query(CollaborationInvitation).filter(
        CollaborationInvitation.inviter_id == current_user.id
    ).order_by(CollaborationInvitation.created_at.desc()).all()

    now = datetime.now(timezone.utc)
    results = []

    for inv in invitations:
        expires_at = inv.expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        is_expired = expires_at is not None and expires_at < now
        is_exhausted = inv.max_uses is not None and inv.use_count >= inv.max_uses
        is_accepted = inv.accepted_at is not None or (inv.invited_email is not None and inv.use_count > 0)

        if inv.revoked_at:
            status_text = "Revoked"
        elif is_accepted:
            status_text = "Accepted"
        elif not inv.is_active:
            status_text = "Revoked"
        elif is_expired:
            status_text = "Expired"
        elif is_exhausted:
            status_text = "Accepted" if inv.invited_email else "Limit Reached"
        else:
            status_text = "Pending" if inv.invited_email else "Active"

        prompt_title = "All Workspace Prompts"
        if inv.prompt_id:
            p = db.query(Prompt).filter(Prompt.id == inv.prompt_id).first()
            if p:
                prompt_title = p.title

        results.append({
            "id": inv.id,
            "token": inv.token,
            "inviteUrl": f"/invite/{inv.token}",
            "type": "email" if inv.invited_email else "link",
            "recipientEmail": inv.invited_email,
            "recipientName": inv.invited_name,
            "promptId": inv.prompt_id,
            "promptTitle": prompt_title,
            "scope": inv.scope,
            "role": inv.role,
            "expiresAt": format_datetime_str(inv.expires_at),
            "createdAt": format_datetime_str(inv.created_at),
            "status": status_text,
            "useCount": inv.use_count,
            "maxUses": inv.max_uses
        })

    return results

@router.post("/invitations/{invitation_id}/revoke")
def revoke_invitation(
    invitation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke an active invitation or collaboration link."""
    inv = db.query(CollaborationInvitation).filter(
        CollaborationInvitation.id == invitation_id,
        CollaborationInvitation.inviter_id == current_user.id
    ).first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    inv.is_active = False
    inv.revoked_at = datetime.now(timezone.utc)
    db.commit()

    return {"success": True, "message": "Invitation link revoked successfully."}

@router.get("/members", response_model=List[CollaboratorMemberItem])
def list_workspace_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all active collaborators across current user's prompts, with Owner first."""
    # 1. Add Owner
    owner_item = {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": "Owner",
        "avatar": current_user.avatar or current_user.name[:2].upper(),
        "avatarBg": "from-blue-600 to-indigo-600",
        "status": "Active",
        "promptsCount": db.query(Prompt).filter(Prompt.user_id == current_user.id).count(),
        "sharedPrompts": [],
        "joinedAt": format_datetime_str(current_user.created_at) or "Workspace Creator"
    }

    # 2. Find all prompt shares under current user's prompts
    user_prompts = db.query(Prompt).filter(Prompt.user_id == current_user.id).all()
    user_prompt_ids = [p.id for p in user_prompts]

    if not user_prompt_ids:
        return [owner_item]

    shares = db.query(PromptShare).filter(
        PromptShare.prompt_id.in_(user_prompt_ids)
    ).order_by(PromptShare.created_at.desc()).all()

    # Aggregate by collaborator email
    collaborators_map: Dict[str, Dict[str, Any]] = {}
    for s in shares:
        email = s.shared_with_email.lower()
        if email not in collaborators_map:
            collaborators_map[email] = {
                "id": s.id,
                "email": s.shared_with_email,
                "name": s.shared_with_name or email.split("@")[0],
                "role": s.role or "Reviewer",
                "avatar": s.shared_with_name[:2].upper() if s.shared_with_name else "CO",
                "avatarBg": "from-blue-500 to-cyan-600",
                "status": "Active",
                "promptsCount": 0,
                "sharedPrompts": [],
                "joinedAt": format_datetime_str(s.created_at) or "Date unavailable"
            }

        p = next((p for p in user_prompts if p.id == s.prompt_id), None)
        if p:
            collaborators_map[email]["promptsCount"] += 1
            collaborators_map[email]["sharedPrompts"].append({
                "promptId": p.id,
                "title": p.title,
                "role": s.role,
                "category": p.category
            })

    return [owner_item] + list(collaborators_map.values())

@router.put("/members/{email}/role")
def update_collaborator_role(
    email: str,
    data: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update role for a collaborator across all prompts owned by current user."""
    clean_email = email.strip().lower()
    target_role = data.role.strip()

    if target_role not in ["Viewer", "Reviewer", "Editor"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be Viewer, Reviewer, or Editor.")

    user_prompts = db.query(Prompt).filter(Prompt.user_id == current_user.id).all()
    user_prompt_ids = [p.id for p in user_prompts]

    shares = db.query(PromptShare).filter(
        PromptShare.prompt_id.in_(user_prompt_ids),
        PromptShare.shared_with_email == clean_email
    ).all()

    if not shares:
        raise HTTPException(status_code=404, detail="Collaborator not found in your workspace.")

    for s in shares:
        s.role = target_role

    db.commit()

    return {"success": True, "message": f"Updated role to {target_role} for {clean_email}."}

@router.delete("/members/{email}")
def remove_collaborator_access(
    email: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke all prompt access for a collaborator from the current user's workspace."""
    clean_email = email.strip().lower()

    user_prompts = db.query(Prompt).filter(Prompt.user_id == current_user.id).all()
    user_prompt_ids = [p.id for p in user_prompts]

    shares = db.query(PromptShare).filter(
        PromptShare.prompt_id.in_(user_prompt_ids),
        PromptShare.shared_with_email == clean_email
    ).all()

    if not shares:
        raise HTTPException(status_code=404, detail="Collaborator not found.")

    for s in shares:
        db.delete(s)

    db.commit()

    return {"success": True, "message": f"Revoked all access for {clean_email}."}

@router.delete("/members/{email}/prompts/{prompt_id}")
def remove_collaborator_from_prompt(
    email: str,
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke collaborator access for a single specific prompt."""
    clean_email = email.strip().lower()
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.user_id == current_user.id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found or you are not the owner.")

    share = db.query(PromptShare).filter(
        PromptShare.prompt_id == prompt_id,
        func.lower(PromptShare.shared_with_email) == clean_email
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Collaborator not found on this prompt.")

    db.delete(share)
    db.commit()

    return {"success": True, "message": f"Removed access to '{prompt.title}' for {clean_email}."}

@router.put("/members/{email}/prompts/{prompt_id}/role")
def update_collaborator_prompt_role(
    email: str,
    prompt_id: str,
    data: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update collaborator role for a specific prompt."""
    clean_email = email.strip().lower()
    target_role = data.role.strip()
    if target_role not in ["Viewer", "Reviewer", "Editor"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be Viewer, Reviewer, or Editor.")

    prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.user_id == current_user.id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found or you are not the owner.")

    share = db.query(PromptShare).filter(
        PromptShare.prompt_id == prompt_id,
        func.lower(PromptShare.shared_with_email) == clean_email
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Collaborator not found on this prompt.")

    share.role = target_role
    db.commit()

    return {"success": True, "message": f"Updated role on '{prompt.title}' to {target_role} for {clean_email}."}

@router.get("/prompts/{prompt_id}/collaborators")
def get_prompt_collaborators(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all collaborators on a specific prompt if user has access."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    is_owner = prompt.user_id == current_user.id
    if not is_owner:
        user_share = db.query(PromptShare).filter(
            PromptShare.prompt_id == prompt_id,
            func.lower(PromptShare.shared_with_email) == current_user.email.lower()
        ).first()
        if not user_share:
            raise HTTPException(status_code=404, detail="Prompt not found or access denied.")

    # Owner details
    owner_user = prompt.user
    owner_dict = {
        "id": owner_user.id if owner_user else "owner",
        "email": owner_user.email if owner_user else "",
        "name": owner_user.name if owner_user else "Prompt Owner",
        "role": "Owner",
        "avatar": (owner_user.name[:2] if owner_user and owner_user.name else "OW").upper(),
        "avatarBg": "from-blue-600 to-indigo-600",
        "status": "Active",
        "isOwner": True
    }

    shares = db.query(PromptShare).filter(PromptShare.prompt_id == prompt_id).all()
    collaborators = [owner_dict]
    for s in shares:
        collaborators.append({
            "id": s.id,
            "email": s.shared_with_email,
            "name": s.shared_with_name or s.shared_with_email.split("@")[0],
            "role": s.role or "Reviewer",
            "avatar": (s.shared_with_name[:2] if s.shared_with_name else "CO").upper(),
            "avatarBg": "from-blue-500 to-cyan-600",
            "status": "Active",
            "sharedAt": format_datetime_str(s.created_at),
            "isOwner": False
        })

    return {
        "promptId": prompt.id,
        "promptTitle": prompt.title,
        "collaboratorsCount": len(shares),
        "totalParticipants": len(collaborators),
        "collaborators": collaborators
    }

@router.get("/activity")
def get_collaboration_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve real authenticated activity timeline across user's owned and shared prompts."""
    # Find all prompt IDs owned by or shared with current user
    owned_prompts = db.query(Prompt).filter(Prompt.user_id == current_user.id).all()
    owned_prompt_ids = [p.id for p in owned_prompts]
    prompt_map = {p.id: p for p in owned_prompts}

    shared_shares = db.query(PromptShare).filter(
        func.lower(PromptShare.shared_with_email) == current_user.email.lower()
    ).all()
    shared_prompt_ids = [s.prompt_id for s in shared_shares]

    for sp in db.query(Prompt).filter(Prompt.id.in_(shared_prompt_ids)).all():
        prompt_map[sp.id] = sp

    all_relevant_prompt_ids = list(set(owned_prompt_ids + shared_prompt_ids))

    activities = []

    # 1. Shares created on owned prompts
    if owned_prompt_ids:
        all_shares = db.query(PromptShare).filter(
            PromptShare.prompt_id.in_(owned_prompt_ids)
        ).order_by(PromptShare.created_at.desc()).limit(20).all()

        for s in all_shares:
            p = prompt_map.get(s.prompt_id)
            p_title = p.title if p else "Prompt"
            activities.append({
                "id": f"act_share_{s.id}",
                "type": "share",
                "title": f"Access granted to {s.shared_with_name or s.shared_with_email}",
                "description": f"Granted {s.role} access to \"{p_title}\"",
                "userName": current_user.name,
                "userEmail": current_user.email,
                "promptId": s.prompt_id,
                "promptTitle": p_title,
                "role": s.role,
                "timestamp": format_datetime_str(s.created_at) or "Date unavailable",
                "rawDate": s.created_at or datetime.fromtimestamp(0, tz=timezone.utc)
            })

    # 2. Version commits and reviews on relevant prompts
    if all_relevant_prompt_ids:
        versions = db.query(PromptVersion).filter(
            PromptVersion.prompt_id.in_(all_relevant_prompt_ids)
        ).order_by(PromptVersion.created_at.desc()).limit(30).all()

        for v in versions:
            p = prompt_map.get(v.prompt_id)
            p_title = p.title if p else "Prompt"
            activities.append({
                "id": f"act_ver_{v.id}",
                "type": "version",
                "title": f"Created version {v.version_number}",
                "description": f"{v.author_name} committed {v.version_number}: \"{v.commit_message}\"",
                "userName": v.author_name,
                "userEmail": "",
                "promptId": v.prompt_id,
                "promptTitle": p_title,
                "versionTag": v.version_number,
                "timestamp": format_datetime_str(v.created_at) or "Date unavailable",
                "rawDate": v.created_at or datetime.fromtimestamp(0, tz=timezone.utc)
            })

            # Check if there is review activity on this version
            if v.review_status in ["IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"]:
                review_act_type = "review"
                if v.review_status == "IN_REVIEW":
                    review_title = f"Review requested for {v.version_number}"
                    review_desc = f"Review requested from {v.reviewer_name or 'collaborator'} for \"{p_title}\""
                    dt = v.review_requested_at or v.created_at
                elif v.review_status == "APPROVED":
                    review_title = f"Approved {v.version_number}"
                    review_desc = f"{v.reviewer_name or 'Reviewer'} approved \"{p_title}\" {v.version_number}"
                    dt = v.reviewed_at or v.created_at
                else: # CHANGES_REQUESTED
                    review_title = f"Requested changes on {v.version_number}"
                    review_desc = f"{v.reviewer_name or 'Reviewer'} requested changes on \"{p_title}\": \"{v.review_feedback or ''}\""
                    dt = v.reviewed_at or v.created_at

                activities.append({
                    "id": f"act_rev_{v.id}_{v.review_status}",
                    "type": "review",
                    "title": review_title,
                    "description": review_desc,
                    "userName": v.reviewer_name or "Reviewer",
                    "userEmail": v.reviewer_email or "",
                    "promptId": v.prompt_id,
                    "promptTitle": p_title,
                    "versionTag": v.version_number,
                    "status": v.review_status,
                    "timestamp": format_datetime_str(dt) or "Date unavailable",
                    "rawDate": dt or datetime.fromtimestamp(0, tz=timezone.utc)
                })

        # 3. Comments on relevant prompts
        comments = db.query(PromptComment).filter(
            PromptComment.prompt_id.in_(all_relevant_prompt_ids)
        ).order_by(PromptComment.created_at.desc()).limit(30).all()

        for c in comments:
            p = prompt_map.get(c.prompt_id)
            p_title = p.title if p else "Prompt"
            ver_suffix = f" on {c.version_tag}" if c.version_tag else ""
            activities.append({
                "id": f"act_cmt_{c.id}",
                "type": "comment",
                "title": f"Comment added{ver_suffix}",
                "description": f"{c.user_name}: \"{c.content[:100]}{'...' if len(c.content) > 100 else ''}\"",
                "userName": c.user_name,
                "userEmail": c.user_email,
                "promptId": c.prompt_id,
                "promptTitle": p_title,
                "versionTag": c.version_tag,
                "role": c.user_role,
                "timestamp": format_datetime_str(c.created_at) or "Date unavailable",
                "rawDate": c.created_at or datetime.fromtimestamp(0, tz=timezone.utc)
            })

    # Sort all activities descending by date
    activities.sort(key=lambda a: a["rawDate"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    # Clean rawDate from final output
    cleaned_activities = []
    for act in activities[:50]:
        act_copy = dict(act)
        act_copy.pop("rawDate", None)
        cleaned_activities.append(act_copy)

    return cleaned_activities

@router.get("/overview", response_model=CollaborationOverviewResponse)
def get_collaboration_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get high-level collaboration statistics for dashboard cards."""
    user_prompts = db.query(Prompt).filter(Prompt.user_id == current_user.id).all()
    user_prompt_ids = [p.id for p in user_prompts]

    collaborator_emails = set()
    if user_prompt_ids:
        shares = db.query(PromptShare.shared_with_email).filter(
            PromptShare.prompt_id.in_(user_prompt_ids)
        ).distinct().all()
        collaborator_emails = {s[0].lower() for s in shares}

    # Count shared with me prompts
    shared_with_me_count = db.query(func.count(PromptShare.id)).filter(
        PromptShare.shared_with_email == current_user.email.lower()
    ).scalar() or 0

    # Count active invitations and links authoritatively
    now = datetime.now(timezone.utc)
    all_invites = db.query(CollaborationInvitation).filter(
        CollaborationInvitation.inviter_id == current_user.id
    ).all()

    pending_invites = 0
    active_links = 0

    for inv in all_invites:
        expires_at = inv.expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        is_expired = expires_at is not None and expires_at < now
        is_exhausted = inv.max_uses is not None and inv.use_count >= inv.max_uses
        is_accepted = inv.accepted_at is not None or (inv.invited_email is not None and inv.use_count > 0)
        is_revoked = inv.revoked_at is not None or not inv.is_active

        if is_revoked or is_expired or is_exhausted or is_accepted:
            continue

        if inv.invited_email:
            pending_invites += 1
        else:
            active_links += 1

    return {
        "membersCount": 1 + len(collaborator_emails),
        "sharedPromptsCount": shared_with_me_count,
        "pendingInvitesCount": pending_invites,
        "activeLinksCount": active_links
    }


