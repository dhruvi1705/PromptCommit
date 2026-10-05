import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

class SignupRequest(BaseModel):
    username: str = Field(..., description="Required unique username, 3-30 chars, letters/numbers/underscore only")
    email: EmailStr = Field(..., description="Required valid unique email address")
    password: str = Field(..., min_length=8, description="Required password, min 8 chars with uppercase, lowercase, number, special char")
    confirm_password: str = Field(..., description="Confirmation password matching password")
    name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = "Prompt Engineer"
    bio: Optional[str] = "Private workspace user on PromptCommit."

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("Username is required.")
        v = v.strip()
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Username must be between 3 and 30 characters.")
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username can only contain letters, numbers, and underscores.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return str(v).strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v or len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least 1 uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least 1 lowercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least 1 number.")
        if not re.search(r"[^a-zA-Z0-9]", v):
            raise ValueError("Password must contain at least 1 special character.")
        return v

    @model_validator(mode="after")
    def validate_passwords_match(self) -> "SignupRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return str(v).strip().lower()

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=1, description="Google ID token from Google Identity Services")
