from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    name: str
    username: Optional[str] = None
    email: EmailStr
    role: Optional[str] = "Prompt Engineer"
    avatar: Optional[str] = "PE"
    bio: Optional[str] = None
    theme: Optional[str] = "light"

class UserResponse(UserBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    theme: Optional[str] = None
