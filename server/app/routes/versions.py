from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.prompt import Prompt
from app.models.prompt_version import PromptVersion
from app.models.prompt_share import PromptShare
from app.models.user import User
from app.schemas.version import VersionCreate, VersionResponse
from app.core.ai_config import validate_ai_configuration, AIValidationError
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/prompts/{prompt_id}/versions", tags=["Prompt Versioning"])


def format_datetime_str(dt):
    if not dt:
        return "Date unavailable"
    return dt.strftime("%b %d, %Y %I:%M %p")


def serialize_version(v: PromptVersion) -> dict:
    target_mod = v.prompt.target_model if v.prompt else "gemini-3.6-flash"
    return {
        "id": v.id,
        "prompt_id": v.prompt_id,
        "version": v.version_number,
        "commitMessage": v.commit_message,
        "description": v.description or "",
        "diffNotes": v.diff_notes or "",
        "content": v.content,
        "author": v.author_name or "Unknown author",
        "isCurrent": v.is_current,
        "model": target_mod,
        "targetModel": target_mod,
        "timestamp": format_datetime_str(v.created_at)
    }


def verify_prompt_access(prompt_id: str, current_user: User, db: Session, require_edit: bool = False) -> Prompt:
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    is_owner = prompt.user_id == current_user.id
    if is_owner:
        return prompt

    # Check collaborator share
    share = db.query(PromptShare).filter(
        PromptShare.prompt_id == prompt.id,
        PromptShare.shared_with_email == current_user.email.lower()
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Prompt not found or access denied.")

    if require_edit:
        raw_role = share.role or "Viewer"
        if "Editor" not in raw_role and "Admin" not in raw_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You have {raw_role} access. Only Editors or the Owner can create or restore versions."
            )

    return prompt


@router.get("")
def list_versions(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt = verify_prompt_access(prompt_id, current_user, db, require_edit=False)

    versions = db.query(PromptVersion).filter(
        PromptVersion.prompt_id == prompt.id
    ).order_by(PromptVersion.created_at.desc()).all()

    return [serialize_version(v) for v in versions]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_version(
    prompt_id: str,
    data: VersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt = verify_prompt_access(prompt_id, current_user, db, require_edit=True)

    # Validate AI provider and model if provided
    req_model = data.model or data.target_model or data.targetModel
    if data.provider or req_model:
        prov = data.provider or "gemini"
        mod = req_model or "gemini-3.6-flash"
        try:
            c_prov_id, c_prov_name, canonical_mod = validate_ai_configuration(prov, mod)
            prompt.target_model = canonical_mod
        except AIValidationError as val_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(val_err)
            )

    # Calculate next version tag if not provided
    existing_count = db.query(PromptVersion).filter(PromptVersion.prompt_id == prompt.id).count()
    version_tag = data.version_tag or data.version_number or f"v{(1.0 + (existing_count * 0.1)):.1f}"
    commit_msg = (data.commit_message or data.commitMessage or "Updated version").strip()

    # Set existing versions is_current = False
    db.query(PromptVersion).filter(PromptVersion.prompt_id == prompt.id).update({"is_current": False})

    new_version = PromptVersion(
        prompt_id=prompt.id,
        version_number=version_tag,
        commit_message=commit_msg,
        description=data.description.strip() if data.description else "Iterated prompt instructions.",
        diff_notes=data.diff_notes.strip() if data.diff_notes else f"+ Incremented version to {version_tag}\n+ Updated prompt instructions",
        content=data.content.strip(),
        author_name=current_user.name or current_user.username or "Unknown author",
        is_current=True,
        review_status="DRAFT"
    )
    db.add(new_version)

    # Update prompt record
    prompt.version = version_tag
    prompt.content = data.content.strip()
    prompt.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(new_version)

    return serialize_version(new_version)


@router.get("/{version_id}")
def get_version(
    prompt_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt = verify_prompt_access(prompt_id, current_user, db, require_edit=False)

    version = db.query(PromptVersion).filter(
        PromptVersion.id == version_id,
        PromptVersion.prompt_id == prompt.id
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Version not found.")

    return serialize_version(version)


@router.post("/{version_id}/restore")
def restore_version(
    prompt_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt = verify_prompt_access(prompt_id, current_user, db, require_edit=True)

    target_ver = db.query(PromptVersion).filter(
        PromptVersion.id == version_id,
        PromptVersion.prompt_id == prompt.id
    ).first()

    if not target_ver:
        target_ver = db.query(PromptVersion).filter(
            PromptVersion.version_number == version_id,
            PromptVersion.prompt_id == prompt.id
        ).first()

    if not target_ver:
        raise HTTPException(status_code=404, detail="Target version not found.")

    # Mark only target as current
    db.query(PromptVersion).filter(PromptVersion.prompt_id == prompt.id).update({"is_current": False})
    target_ver.is_current = True

    # Update prompt content to target version
    prompt.version = target_ver.version_number
    prompt.content = target_ver.content
    prompt.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(prompt)

    return {
        "success": True,
        "message": f"Successfully restored {target_ver.version_number}.",
        "restoredVersion": serialize_version(target_ver)
    }
