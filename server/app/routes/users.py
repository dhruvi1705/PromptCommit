from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserUpdateRequest
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.put("/profile")
def update_profile(
    data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.name is not None and data.name.strip():
        current_user.name = data.name.strip()
        names = current_user.name.split()
        current_user.avatar = "".join([n[0] for n in names[:2]]).upper()

    if data.email is not None and data.email.strip():
        clean_email = data.email.strip().lower()
        if clean_email != current_user.email:
            existing = db.query(User).filter(User.email == clean_email).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email already exists."
                )
            current_user.email = clean_email

    if data.role is not None:
        current_user.role = data.role.strip()
    if data.bio is not None:
        current_user.bio = data.bio.strip()
    if data.theme is not None:
        current_user.theme = data.theme.strip()

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "avatar": current_user.avatar,
            "bio": current_user.bio,
            "theme": current_user.theme,
            "notifications": True,
            "autoSave": True
        }
    }
