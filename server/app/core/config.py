import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "PromptCommit API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str = Field(
        default="mysql+pymysql://root:@localhost:3306/promptcommit_db",
        env="DATABASE_URL"
    )
    
    # JWT Authentication — MUST be set via environment variable or .env file
    JWT_SECRET_KEY: str = Field(
        ...,
        env="JWT_SECRET_KEY",
        description="Required. Set a strong random secret in your .env file. Never commit real secrets."
    )
    JWT_ALGORITHM: str = Field(default="HS256", env="JWT_ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
        env="CORS_ORIGINS"
    )
    
    # AI Cloud Providers
    GEMINI_API_KEY: str = Field(default="", env="GEMINI_API_KEY")
    GROQ_API_KEY: str = Field(default="", env="GROQ_API_KEY")
    OPENROUTER_API_KEY: str = Field(default="", env="OPENROUTER_API_KEY")
    MISTRAL_API_KEY: str = Field(default="", env="MISTRAL_API_KEY")
    DEFAULT_AI_PROVIDER: str = Field(default="none", env="DEFAULT_AI_PROVIDER")

    # Google OAuth 2.0
    GOOGLE_CLIENT_ID: str = Field(default="", env="GOOGLE_CLIENT_ID")

    # Email Service (Resend)
    RESEND_API_KEY: str = Field(default="", env="RESEND_API_KEY")
    EMAIL_FROM: str = Field(default="PromptCommit <onboarding@resend.dev>", env="EMAIL_FROM")

    # Frontend Origin / Base URL
    FRONTEND_URL: str = Field(default="http://localhost:5173", env="FRONTEND_URL")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
