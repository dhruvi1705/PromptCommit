from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.favorite import Favorite
from app.models.prompt import Prompt
from app.models.user import User
from app.routes.prompts import serialize_prompt
from app.utils.dependencies import get_current_user

router = APIRouter(tags=["Favorites"])

@router.get("/favorites")
def get_user_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    favs = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
    prompt_ids = [f.prompt_id for f in favs]

    prompts = db.query(Prompt).filter(
        Prompt.id.in_(prompt_ids),
        Prompt.user_id == current_user.id
    ).order_by(Prompt.updated_at.desc()).all()

    return [serialize_prompt(p, current_user.id, db) for p in prompts]

@router.post("/prompts/{prompt_id}/favorite")
def toggle_favorite(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.user_id == current_user.id
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    existing = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.prompt_id == prompt.id
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"success": True, "isFavorite": False, "message": "Removed from favorites."}
    else:
        new_fav = Favorite(user_id=current_user.id, prompt_id=prompt.id)
        db.add(new_fav)
        db.commit()
        return {"success": True, "isFavorite": True, "message": "Added to favorites."}

@router.delete("/prompts/{prompt_id}/favorite")
def remove_favorite(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.prompt_id == prompt_id
    ).first()

    if existing:
        db.delete(existing)
        db.commit()

    return {"success": True, "isFavorite": False, "message": "Removed from favorites."}
