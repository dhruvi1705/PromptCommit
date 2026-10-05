from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.prompt import Prompt
from app.models.prompt_share import PromptShare
from app.models.prompt_comment import PromptComment
from app.models.notification import Notification
from app.models.user import User
from app.schemas.comment import CommentCreateRequest, CommentResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/prompts/{prompt_id}/comments", tags=["Prompt Comments & Discussions"])

def format_datetime_str(dt: Optional[datetime]) -> str:
    if not dt:
        return "Date unavailable"
    return dt.strftime("%b %d, %Y %I:%M %p")

from sqlalchemy import func

def verify_prompt_member(prompt_id: str, current_user: User, db: Session) -> tuple[Prompt, str]:
    """Verify that current_user has access to the prompt and return (Prompt, role)."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    if prompt.user_id == current_user.id:
        return prompt, "Owner"

    clean_email = current_user.email.strip().lower()
    share = db.query(PromptShare).filter(
        PromptShare.prompt_id == prompt.id,
        func.lower(func.trim(PromptShare.shared_with_email)) == clean_email
    ).first()

    if not share:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to comment on this prompt.")

    raw_role = share.role or "Reviewer"
    if "Editor" in raw_role:
        role = "Editor"
    elif "View" in raw_role:
        role = "Viewer"
    elif "Reviewer" in raw_role:
        role = "Reviewer"
    else:
        role = "Reviewer"

    return prompt, role

@router.get("", response_model=List[CommentResponse])
def list_prompt_comments(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all discussion comments on a prompt."""
    prompt, user_role = verify_prompt_member(prompt_id, current_user, db)

    comments = db.query(PromptComment).filter(
        PromptComment.prompt_id == prompt.id
    ).order_by(PromptComment.created_at.asc()).all()

    results = []
    for c in comments:
        can_del = (c.user_id == current_user.id) or (prompt.user_id == current_user.id)
        results.append({
            "id": c.id,
            "promptId": c.prompt_id,
            "userId": c.user_id,
            "userName": c.user_name,
            "userEmail": c.user_email,
            "userRole": c.user_role,
            "versionTag": c.version_tag,
            "content": c.content,
            "likesCount": c.likes_count,
            "createdAt": format_datetime_str(c.created_at),
            "canDelete": can_del
        })

    return results

@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_prompt_comment(
    prompt_id: str,
    data: CommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a review discussion comment on a prompt."""
    prompt, user_role = verify_prompt_member(prompt_id, current_user, db)

    trimmed_content = data.content.strip()
    if not trimmed_content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")

    new_comment = PromptComment(
        prompt_id=prompt.id,
        user_id=current_user.id,
        user_name=current_user.name or current_user.email.split("@")[0],
        user_email=current_user.email.lower(),
        user_role=user_role,
        version_tag=data.version_tag.strip() if data.version_tag else None,
        content=trimmed_content,
        likes_count=0
    )
    db.add(new_comment)
    db.flush()

    # Create notification for prompt owner if commenter is not owner
    if prompt.user_id != current_user.id:
        v_str = f" on {data.version_tag}" if data.version_tag else ""
        notif = Notification(
            user_id=prompt.user_id,
            sender_id=current_user.id,
            title="New Comment on Prompt",
            message=f"{current_user.name} commented{v_str} on '{prompt.title}': \"{trimmed_content[:80]}\"",
            type="PROMPT_COMMENT",
            action_url="/app/prompts"
        )
        db.add(notif)

    db.commit()
    db.refresh(new_comment)

    return {
        "id": new_comment.id,
        "promptId": new_comment.prompt_id,
        "userId": new_comment.user_id,
        "userName": new_comment.user_name,
        "userEmail": new_comment.user_email,
        "userRole": new_comment.user_role,
        "versionTag": new_comment.version_tag,
        "content": new_comment.content,
        "likesCount": new_comment.likes_count,
        "createdAt": format_datetime_str(new_comment.created_at),
        "canDelete": True
    }

@router.post("/{comment_id}/like")
def like_prompt_comment(
    prompt_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Like / upvote a comment."""
    prompt, user_role = verify_prompt_member(prompt_id, current_user, db)

    comment = db.query(PromptComment).filter(
        PromptComment.id == comment_id,
        PromptComment.prompt_id == prompt.id
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")

    comment.likes_count += 1
    db.commit()

    return {"success": True, "likesCount": comment.likes_count}

@router.delete("/{comment_id}")
def delete_prompt_comment(
    prompt_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a comment (author or prompt owner only)."""
    prompt, user_role = verify_prompt_member(prompt_id, current_user, db)

    comment = db.query(PromptComment).filter(
        PromptComment.id == comment_id,
        PromptComment.prompt_id == prompt.id
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")

    if comment.user_id != current_user.id and prompt.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this comment.")

    db.delete(comment)
    db.commit()

    return {"success": True, "message": "Comment deleted."}
