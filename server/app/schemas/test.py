from typing import Optional
from pydantic import BaseModel, Field

class TestExecutionRequest(BaseModel):
    prompt_id: Optional[str] = None
    prompt_content: Optional[str] = None
    input_text: Optional[str] = Field(default="")
    provider: str = Field(default="gemini")
    model: str = Field(default="gemini-3.6-flash")
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024

    # Multimedia attachments (Image, PDF, Code, Text)
    input_type: Optional[str] = Field(default="text")
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_content_b64: Optional[str] = None
    code_snippet: Optional[str] = None
    code_language: Optional[str] = None

class TestResponse(BaseModel):
    id: str
    promptId: Optional[str] = None
    provider: str
    model: str
    inputText: Optional[str] = ""
    outputText: str
    responseTimeMs: int
    status: str  # 'success' | 'error' | 'unconfigured'
    code: Optional[str] = None
    errorMessage: Optional[str] = None
    createdAt: str

    class Config:
        from_attributes = True
