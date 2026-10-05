from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.collection import Collection, collection_prompts
from app.models.prompt import Prompt
from app.models.user import User
from app.schemas.collection import CollectionCreate, CollectionUpdate, CollectionResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/collections", tags=["Collections"])

STANDARD_COLLECTION_DEFAULT_TAGS = {
    "coding": ["Code", "Coding", "Development"],
    "research": ["Research", "Analysis", "Academic"],
    "marketing": ["Marketing", "Copywriting", "Content"],
    "engineering": ["Engineering", "Architecture", "System"],
    "education": ["Education", "Tutorial", "Learning"],
    "ui design": ["Design", "UI", "UX"],
    "ui prompts": ["Design", "UI", "UX"],
    "production agents": ["Production", "Agents", "Automation"],
    "development": ["Development", "Code", "Engineering"]
}

class AddPromptBody(BaseModel):
    promptId: Optional[str] = None
    prompt_id: Optional[str] = None

def serialize_collection(col: Collection, user_id: str, db: Session) -> dict:
    # Authoritative count via the collection_prompts many-to-many relationship
    prompt_count = db.query(Prompt).join(Prompt.collections).filter(
        Collection.id == col.id,
        Prompt.user_id == user_id
    ).count()

    return {
        "id": col.id,
        "userId": col.user_id,
        "name": col.name,
        "description": col.description or "",
        "icon": col.icon or "FolderKanban",
        "color": col.color or "blue",
        "defaultTags": col.default_tags_list,
        "promptCount": prompt_count,
        "promptsCount": prompt_count,
        "gradient": f"from-{col.color or 'blue'}-500/20 to-indigo-500/10",
        "border": f"border-{col.color or 'blue'}-500/30",
        "createdAt": col.created_at.strftime("%b %d, %Y") if col.created_at else None
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_collection(
    data: CollectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_name = data.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Collection name cannot be empty.")

    existing = db.query(Collection).filter(
        Collection.user_id == current_user.id,
        Collection.name.ilike(clean_name)
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f'Collection "{clean_name}" already exists.'
        )

    # Resolve default tags
    initial_tags = []
    if data.defaultTags and len(data.defaultTags) > 0:
        initial_tags = [str(t).strip().replace("#", "") for t in data.defaultTags if str(t).strip()]
    elif clean_name.lower() in STANDARD_COLLECTION_DEFAULT_TAGS:
        initial_tags = STANDARD_COLLECTION_DEFAULT_TAGS[clean_name.lower()]
    else:
        initial_tags = [clean_name]

    new_col = Collection(
        user_id=current_user.id,
        name=clean_name,
        description=data.description.strip() if data.description else "Curated prompt collection.",
        icon=data.icon or "FolderKanban",
        color=data.color or "blue"
    )
    new_col.default_tags_list = initial_tags

    db.add(new_col)
    db.commit()
    db.refresh(new_col)

    return serialize_collection(new_col, current_user.id, db)

@router.get("")
def list_collections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cols = db.query(Collection).filter(
        Collection.user_id == current_user.id
    ).order_by(Collection.created_at.asc()).all()

    return [serialize_collection(c, current_user.id, db) for c in cols]

@router.get("/{collection_id}")
def get_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    col = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not col:
        raise HTTPException(status_code=404, detail="Collection not found or access denied.")

    return serialize_collection(col, current_user.id, db)

@router.get("/{collection_id}/prompts")
def get_collection_prompts(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    col = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not col:
        raise HTTPException(status_code=404, detail="Collection not found or access denied.")

    from app.routes.prompts import serialize_prompt
    prompts = [p for p in col.prompts if p.user_id == current_user.id]
    return [serialize_prompt(p, current_user.id, current_user.email, db) for p in prompts]

@router.put("/{collection_id}")
def update_collection(
    collection_id: str,
    data: CollectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    col = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not col:
        raise HTTPException(status_code=404, detail="Collection not found or access denied.")

    if data.name is not None and data.name.strip():
        new_name = data.name.strip()
        # Check if another collection has this name
        existing = db.query(Collection).filter(
            Collection.user_id == current_user.id,
            Collection.name.ilike(new_name),
            Collection.id != collection_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f'Collection "{new_name}" already exists.')

        col.name = new_name
        # Keep legacy compatibility field synchronized if needed
        for p in col.prompts:
            if p.user_id == current_user.id:
                p.collection_name = new_name

    if data.description is not None:
        col.description = data.description.strip()
    if data.icon is not None:
        col.icon = data.icon.strip()
    if data.color is not None:
        col.color = data.color.strip()
    if data.defaultTags is not None:
        # Update default tags without modifying existing prompts
        col.default_tags_list = data.defaultTags

    db.commit()
    db.refresh(col)
    return serialize_collection(col, current_user.id, db)

@router.delete("/{collection_id}")
def delete_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    col = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()

    if not col:
        raise HTTPException(status_code=404, detail="Collection not found or access denied.")

    # Clean legacy field on prompts that were in this collection
    for p in list(col.prompts):
        if p.user_id == current_user.id and p.collection_name == col.name:
            other_cols = [c for c in p.collections if c.id != col.id]
            p.collection_name = other_cols[0].name if other_cols else None

    # Deleting collection automatically cascades & deletes collection_prompts rows
    # Prompts themselves, categories, versions, and favorites are completely preserved.
    db.delete(col)
    db.commit()
    return {"success": True, "message": f'Collection "{col.name}" deleted.'}

@router.post("/{collection_id}/prompts/{prompt_id}")
def add_prompt_to_collection_by_path(
    collection_id: str,
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return _add_prompt_to_collection_internal(collection_id, prompt_id, current_user, db)

@router.post("/{collection_id}/prompts")
def add_prompt_to_collection_by_body(
    collection_id: str,
    body: AddPromptBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pid = body.promptId or body.prompt_id
    if not pid:
        raise HTTPException(status_code=400, detail="promptId is required.")
    return _add_prompt_to_collection_internal(collection_id, pid, current_user, db)

def _add_prompt_to_collection_internal(
    collection_id: str,
    prompt_id: str,
    current_user: User,
    db: Session
):
    col = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found or access denied.")

    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.user_id == current_user.id
    ).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found or access denied.")

    # Avoid duplicate associations
    if prompt not in col.prompts:
        col.prompts.append(prompt)
        prompt.collection_name = col.name  # Legacy compatibility sync
        db.commit()

    return {
        "success": True,
        "message": f'Added prompt "{prompt.title}" to collection "{col.name}".',
        "collection": serialize_collection(col, current_user.id, db)
    }

@router.delete("/{collection_id}/prompts/{prompt_id}")
def remove_prompt_from_collection(
    collection_id: str,
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    col = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found or access denied.")

    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.user_id == current_user.id
    ).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found or access denied.")

    if prompt in col.prompts:
        col.prompts.remove(prompt)
        # Update legacy field if it was pointing to this collection
        if prompt.collection_name == col.name:
            prompt.collection_name = prompt.collections[0].name if prompt.collections else None
        db.commit()

    return {"success": True, "message": f'Removed prompt from collection "{col.name}".'}
