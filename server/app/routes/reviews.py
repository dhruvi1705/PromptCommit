from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.prompt import Prompt
from app.models.prompt_version import PromptVersion
from app.models.prompt_share import PromptShare
from app.models.prompt_comment import PromptComment
from app.models.notification import Notification
from app.models.user import User
from app.schemas.review import RequestReviewRequest, ReviewActionRequest, ReviewStatusResponse
from app.utils.dependencies import get_current_user

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.prompt import Prompt
from app.models.prompt_version import PromptVersion
from app.models.prompt_share import PromptShare
from app.models.prompt_comment import PromptComment
from app.models.notification import Notification
from app.models.user import User
from app.schemas.review import RequestReviewRequest, ReviewActionRequest, ReviewStatusResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/prompts/{prompt_id}/versions/{version_id}", tags=["Review & Approval Workflow"])

def format_datetime_str(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%b %d, %Y %I:%M %p")

def verify_prompt_and_version(prompt_id: str, version_id: str, current_user: User, db: Session) -> tuple[Prompt, PromptVersion, str]:
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    version = db.query(PromptVersion).filter(
        PromptVersion.id == version_id,
        PromptVersion.prompt_id == prompt.id
    ).first()
    if not version:
        # Try version_number
        version = db.query(PromptVersion).filter(
            PromptVersion.version_number == version_id,
            PromptVersion.prompt_id == prompt.id
        ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Prompt version not found.")

    if prompt.user_id == current_user.id:
        return prompt, version, "Owner"

    clean_email = current_user.email.strip().lower()
    share = db.query(PromptShare).filter(
        PromptShare.prompt_id == prompt.id,
        func.lower(func.trim(PromptShare.shared_with_email)) == clean_email
    ).first()

    if not share:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to access or review this prompt.")

    raw_role = share.role or "Reviewer"
    if "Editor" in raw_role:
        role = "Editor"
    elif "View" in raw_role:
        role = "Viewer"
    elif "Reviewer" in raw_role:
        role = "Reviewer"
    else:
        role = "Reviewer"

    return prompt, version, role

@router.get("/review", response_model=ReviewStatusResponse)
@router.get("/review/status", response_model=ReviewStatusResponse)
@router.get("/review-status", response_model=ReviewStatusResponse)
def get_version_review_status(
    prompt_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current review status and details for a prompt version."""
    prompt, version, user_role = verify_prompt_and_version(prompt_id, version_id, current_user, db)

    return {
        "versionId": version.id,
        "versionNumber": version.version_number,
        "reviewStatus": version.review_status or "DRAFT",
        "reviewerName": version.reviewer_name,
        "reviewerEmail": version.reviewer_email,
        "reviewMessage": version.review_message,
        "reviewFeedback": version.review_feedback,
        "reviewRequestedAt": format_datetime_str(version.review_requested_at),
        "reviewedAt": format_datetime_str(version.reviewed_at)
    }

@router.post("/review/request", response_model=ReviewStatusResponse)
@router.post("/review/request-review", response_model=ReviewStatusResponse)
@router.post("/request-review", response_model=ReviewStatusResponse)
def request_version_review(
    prompt_id: str,
    version_id: str,
    data: RequestReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Owner, Editor, or Reviewer requests review for a prompt version."""
    prompt, version, user_role = verify_prompt_and_version(prompt_id, version_id, current_user, db)

    if user_role == "Viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers do not have permission to request reviews."
        )

    now = datetime.now(timezone.utc)
    raw_email = (data.reviewer_email or "").strip().lower()

    reviewer_user = None
    reviewer_name = None
    if raw_email:
        reviewer_user = db.query(User).filter(func.lower(User.email) == raw_email).first()
        reviewer_name = reviewer_user.name if reviewer_user else raw_email.split("@")[0].title()
    else:
        # Default: if user is not owner, designate prompt owner as reviewer
        if prompt.user_id != current_user.id:
            reviewer_user = prompt.user
            reviewer_name = prompt.user.name if prompt.user else "Owner"
            raw_email = prompt.user.email if prompt.user else ""

    version.review_status = "IN_REVIEW"
    version.reviewer_id = reviewer_user.id if reviewer_user else None
    version.reviewer_name = reviewer_name
    version.reviewer_email = raw_email or None
    version.review_message = data.message.strip() if data.message else None
    version.review_requested_at = now
    version.reviewed_at = None
    version.review_feedback = None

    # Send Notification to designated reviewer if user account exists
    if reviewer_user and reviewer_user.id != current_user.id:
        msg_suffix = f': "{data.message.strip()}"' if data.message and data.message.strip() else ""
        notif = Notification(
            user_id=reviewer_user.id,
            sender_id=current_user.id,
            title="Review Requested",
            message=f"{current_user.name} requested a review for {prompt.title} {version.version_number}{msg_suffix}",
            type="REVIEW_REQUESTED",
            action_url="/app/prompts"
        )
        db.add(notif)
    elif prompt.user_id != current_user.id:
        # Notify owner if collaborator requested review without specifying email
        notif = Notification(
            user_id=prompt.user_id,
            sender_id=current_user.id,
            title="Review Requested",
            message=f"{current_user.name} requested a review for {prompt.title} {version.version_number}",
            type="REVIEW_REQUESTED",
            action_url="/app/prompts"
        )
        db.add(notif)

    # Add discussion comment logging the review request
    req_desc = f"Requested review" + (f" from {reviewer_name} ({raw_email})" if raw_email else "")
    if data.message and data.message.strip():
        req_desc += f': "{data.message.strip()}"'
    else:
        req_desc += "."

    req_comment = PromptComment(
        prompt_id=prompt.id,
        user_id=current_user.id,
        user_name=current_user.name or "Author",
        user_email=current_user.email.lower(),
        user_role=user_role,
        version_tag=version.version_number,
        content=req_desc,
        likes_count=0
    )
    db.add(req_comment)

    db.commit()
    db.refresh(version)

    return {
        "versionId": version.id,
        "versionNumber": version.version_number,
        "reviewStatus": version.review_status,
        "reviewerName": version.reviewer_name,
        "reviewerEmail": version.reviewer_email,
        "reviewMessage": version.review_message,
        "reviewFeedback": version.review_feedback,
        "reviewRequestedAt": format_datetime_str(version.review_requested_at),
        "reviewedAt": format_datetime_str(version.reviewed_at)
    }

@router.post("/review/action", response_model=ReviewStatusResponse)
@router.post("/review/review-action", response_model=ReviewStatusResponse)
@router.post("/review-action", response_model=ReviewStatusResponse)
def submit_review_action(
    prompt_id: str,
    version_id: str,
    data: ReviewActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reviewer, Editor, or Owner approves or requests changes for a prompt version."""
    prompt, version, user_role = verify_prompt_and_version(prompt_id, version_id, current_user, db)

    # Strict RBAC: Viewer cannot approve or request changes!
    if user_role == "Viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers do not have permission to approve or request changes."
        )

    action_clean = data.action.strip().lower()
    if action_clean not in ["approve", "approved", "request_changes", "request-changes", "changes_requested"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'request_changes'.")

    is_approve = "approve" in action_clean

    raw_feedback = data.comment or data.feedback
    if not is_approve and not (raw_feedback and raw_feedback.strip()):
        raise HTTPException(status_code=400, detail="A comment is required when requesting changes.")

    now = datetime.now(timezone.utc)
    new_status = "APPROVED" if is_approve else "CHANGES_REQUESTED"
    feedback_text = raw_feedback.strip() if raw_feedback else ("Approved version." if is_approve else "Changes requested.")

    version.review_status = new_status
    version.reviewed_at = now
    version.review_feedback = feedback_text
    version.reviewer_name = current_user.name
    version.reviewer_email = current_user.email

    # Notify prompt owner if reviewer is not the owner
    if prompt.user_id != current_user.id:
        action_verb = "approved" if is_approve else "requested changes to"
        notif = Notification(
            user_id=prompt.user_id,
            sender_id=current_user.id,
            title=f"Review {'Approved' if is_approve else 'Changes Requested'}",
            message=f"{current_user.name} {action_verb} {prompt.title} {version.version_number}: \"{feedback_text[:80]}\"",
            type="REVIEW_COMPLETED",
            action_url="/app/prompts"
        )
        db.add(notif)

    # Post a comment to the prompt discussion thread documenting the review verdict
    verdict_comment = PromptComment(
        prompt_id=prompt.id,
        user_id=current_user.id,
        user_name=current_user.name,
        user_email=current_user.email.lower(),
        user_role=user_role,
        version_tag=version.version_number,
        content=f"{'Approved version' if is_approve else 'Changes requested'}: {feedback_text}",
        likes_count=0
    )
    db.add(verdict_comment)

    db.commit()
    db.refresh(version)

    return {
        "versionId": version.id,
        "versionNumber": version.version_number,
        "reviewStatus": version.review_status,
        "reviewerName": version.reviewer_name,
        "reviewerEmail": version.reviewer_email,
        "reviewMessage": version.review_message,
        "reviewFeedback": version.review_feedback,
        "reviewRequestedAt": format_datetime_str(version.review_requested_at),
        "reviewedAt": format_datetime_str(version.reviewed_at)
    }
