import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.rate_limiter import (
    check_login_rate_limit,
    record_failed_login,
    record_successful_login,
    check_signup_rate_limit
)
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, GoogleAuthRequest
from app.schemas.user import UserResponse
from app.utils.dependencies import get_current_user
from app.services.google_auth_service import google_auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

def format_user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "username": getattr(user, "username", None) or user.id,
        "email": user.email,
        "role": user.role,
        "avatar": user.avatar,
        "bio": user.bio,
        "theme": user.theme,
        "notifications": True,
        "autoSave": True,
        "createdAt": user.created_at.isoformat() if user.created_at else None
    }

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, request: Request, db: Session = Depends(get_db)):
    # Rate limit signups per IP
    check_signup_rate_limit(request)

    clean_username = data.username.strip()
    clean_email = data.email.strip().lower()

    # 1. Check if username is already taken
    existing_username = db.query(User).filter(User.username == clean_username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken. Please choose another username."
        )

    # 2. Check if email is already registered
    existing_email = db.query(User).filter(User.email == clean_email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please log in instead."
        )

    # Compute initials for avatar
    display_name = (data.name or clean_username).strip()
    names = display_name.split()
    initials = "".join([n[0] for n in names[:2]]).upper() if names else clean_username[:2].upper()

    # Create user with bcrypt password hash (confirm_password is NOT stored in DB)
    new_user = User(
        name=display_name,
        username=clean_username,
        email=clean_email,
        password_hash=hash_password(data.password),
        role=data.role or "Prompt Engineer",
        avatar=initials,
        bio=data.bio or "Private workspace user on PromptCommit.",
        theme="light"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(subject=new_user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": format_user_payload(new_user)
    }

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    # Check if IP is currently rate-limited on failed attempts
    check_login_rate_limit(request)

    clean_email = data.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    # Handle Google-only users who attempt email/password login
    if user and not user.password_hash:
        record_failed_login(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google Sign-In. Please use the 'Sign in with Google' button to log in."
        )

    # Security requirement: Generic message for failed login; do NOT reveal if email exists
    if not user or not verify_password(data.password, user.password_hash):
        record_failed_login(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Successful login clears failed attempt history for this IP
    record_successful_login(request)

    token = create_access_token(subject=user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": format_user_payload(user)
    }

@router.post("/google", response_model=TokenResponse)
def google_auth(data: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate via Google OAuth 2.0 — login, link, or auto-register."""
    # 1. Verify the Google ID token server-side
    try:
        google_info = google_auth_service.verify_google_token(data.credential)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

    google_email = google_info["email"]
    google_sub = google_info["sub"]
    google_name = google_info.get("name", "")

    # 2. Look up user by Google ID first (returning user via Google)
    user = db.query(User).filter(User.google_id == google_sub).first()

    if user:
        # Existing Google-linked user — just log them in
        token = create_access_token(subject=user.id)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": format_user_payload(user)
        }

    # 3. Check if an existing account has the same email (account linking)
    user = db.query(User).filter(User.email == google_email).first()

    if user:
        # Link Google to existing email/password account
        user.google_id = google_sub
        user.auth_provider = "both" if user.password_hash else "google"
        db.commit()
        db.refresh(user)

        token = create_access_token(subject=user.id)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": format_user_payload(user)
        }

    # 4. No existing user — auto-register a new Google user
    # Generate a unique username from the email prefix
    email_prefix = google_email.split("@")[0].replace(".", "_").replace("-", "_")
    base_username = email_prefix[:25] if len(email_prefix) > 25 else email_prefix
    candidate_username = base_username

    # Ensure username uniqueness
    while db.query(User).filter(User.username == candidate_username).first():
        candidate_username = f"{base_username}_{uuid.uuid4().hex[:5]}"

    # Compute initials for avatar
    display_name = google_name.strip() or email_prefix
    names = display_name.split()
    initials = "".join([n[0] for n in names[:2]]).upper() if names else candidate_username[:2].upper()

    new_user = User(
        name=display_name,
        username=candidate_username,
        email=google_email,
        password_hash=None,
        role="Prompt Engineer",
        avatar=initials,
        bio="Private workspace user on PromptCommit.",
        theme="light",
        google_id=google_sub,
        auth_provider="google"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(subject=new_user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": format_user_payload(new_user)
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "user": format_user_payload(current_user)
    }

@router.post("/logout")
def logout():
    return {"success": True, "message": "Logged out successfully"}
