import base64
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limiter import check_ai_test_rate_limit
from app.models.prompt import Prompt
from app.models.prompt_test import PromptTest
from app.models.user import User
from app.schemas.test import TestExecutionRequest
from app.core.ai_config import validate_ai_configuration, AIValidationError
from app.services.ai_service import ai_service
from app.services.multimedia_processor import MultimediaProcessor, MultimediaValidationError, MultimodalNotSupportedError
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/tests", tags=["Prompt Testing"])


def format_datetime_str(dt):
    if not dt:
        return "Just now"
    return dt.strftime("%b %d, %Y %I:%M %p")


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/run", status_code=status.HTTP_201_CREATED)
async def execute_prompt_test(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Enforce AI test rate limit (max 20 per minute per user)
    check_ai_test_rate_limit(current_user.id)

    content_type = request.headers.get("content-type", "").lower()

    prompt_id = None
    prompt_content = None
    input_text = ""
    provider = "gemini"
    model = "gemini-3.6-flash"
    temperature = 0.7
    max_tokens = 1024

    input_type = "text"
    filename = None
    mime_type = None
    code_language = None
    code_snippet = None
    raw_bytes = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        prompt_id = form.get("prompt_id") or form.get("promptId")
        prompt_content = form.get("prompt_content") or form.get("promptContent")
        input_text = form.get("input_text") or form.get("inputText") or ""
        provider = form.get("provider") or "gemini"
        model = form.get("model") or "gemini-3.6-flash"
        
        temp_val = form.get("temperature")
        if temp_val is not None and str(temp_val).strip() != "":
            try:
                temperature = float(temp_val)
            except (ValueError, TypeError):
                temperature = 0.7
            
        max_t_val = form.get("max_tokens") or form.get("maxTokens")
        if max_t_val is not None and str(max_t_val).strip() != "":
            try:
                max_tokens = int(max_t_val)
            except (ValueError, TypeError):
                max_tokens = 1024

        input_type = form.get("input_type") or form.get("inputType") or "text"
        code_language = form.get("code_language") or form.get("codeLanguage")
        code_snippet = form.get("code_snippet") or form.get("codeSnippet")

        file_obj = form.get("file")
        if file_obj and hasattr(file_obj, "read"):
            raw_bytes = await file_obj.read()
            filename = getattr(file_obj, "filename", None)
            mime_type = getattr(file_obj, "content_type", None)

    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed request payload."
            )

        if not isinstance(body, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request body must be a valid JSON dictionary object."
            )

        try:
            data = TestExecutionRequest(**body)
        except Exception as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request body structure: {str(err)}"
            )

        prompt_id = data.prompt_id or body.get("promptId")
        prompt_content = data.prompt_content or body.get("promptContent")
        input_text = data.input_text or body.get("inputText") or ""
        provider = data.provider or body.get("provider") or "gemini"
        model = data.model or body.get("model") or "gemini-3.6-flash"
        temperature = data.temperature if data.temperature is not None else 0.7
        max_tokens = data.max_tokens or body.get("maxTokens") or 1024

        input_type = data.input_type or body.get("inputType") or "text"
        filename = data.filename or body.get("filename")
        mime_type = data.mime_type or body.get("mimeType")
        code_language = data.code_language or body.get("codeLanguage")
        code_snippet = data.code_snippet or body.get("codeSnippet")

        if data.file_content_b64:
            try:
                raw_bytes = base64.b64decode(data.file_content_b64)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid base64 encoding for file attachment."
                )

    # Validate & Process Multimedia Attachment
    multimedia = None
    if input_type and str(input_type).lower().strip() != "text":
        try:
            multimedia = MultimediaProcessor.validate_and_create(
                input_type=str(input_type),
                filename=filename,
                mime_type=mime_type,
                raw_bytes=raw_bytes,
                text_content=code_snippet if str(input_type).lower().strip() == "code" else None,
                language=code_language
            )
        except MultimediaValidationError as m_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=m_err.message
            )

    # Strictly validate AI provider and model combination
    try:
        canonical_provider_id, canonical_provider_name, target_model = validate_ai_configuration(
            provider,
            model
        )
    except AIValidationError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

    prompt_obj = None
    prompt_text = ""

    if prompt_id:
        prompt_obj = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if prompt_obj:
            is_owner = prompt_obj.user_id == current_user.id
            is_shared = False
            if not is_owner:
                from app.models.prompt_share import PromptShare
                is_shared = db.query(PromptShare).filter(
                    PromptShare.prompt_id == prompt_obj.id,
                    PromptShare.shared_with_email == current_user.email.lower()
                ).first() is not None
            
            if is_owner or is_shared:
                prompt_text = prompt_obj.content
            else:
                prompt_obj = None

    if not prompt_text and prompt_content:
        prompt_text = prompt_content

    raw_input = (input_text or "").strip()
    raw_prompt = (prompt_text or "").strip()

    if raw_input:
        effective_input = raw_input
        final_prompt_text = raw_prompt
    elif raw_prompt:
        effective_input = raw_prompt
        final_prompt_text = raw_prompt
    elif multimedia and (multimedia.raw_bytes or multimedia.text_content):
        effective_input = f"[Attached {multimedia.input_type.upper()} file: {multimedia.filename or 'asset'}]"
        final_prompt_text = raw_prompt
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a prompt or test input before running the test."
        )

    # Call AI Service abstraction
    ai_result = await ai_service.run_prompt(
        provider=canonical_provider_name,
        model=target_model,
        prompt_text=final_prompt_text,
        input_text=effective_input,
        temperature=temperature,
        max_tokens=max_tokens,
        multimedia=multimedia
    )

    test_record = PromptTest(
        prompt_id=prompt_obj.id if prompt_obj else None,
        user_id=current_user.id,
        provider=canonical_provider_name,
        model=target_model,
        input_text=input_text or (multimedia.filename if multimedia else ""),
        output_text=ai_result.get("output_text") or "",
        response_time_ms=ai_result.get("response_time_ms") or 0,
        status=ai_result.get("status") or "success"
    )
    db.add(test_record)

    if prompt_obj:
        prompt_obj.test_count = (prompt_obj.test_count or 0) + 1
        new_lat = ai_result.get("response_time_ms") or 180
        if new_lat > 0:
            prompt_obj.avg_latency_ms = round(((prompt_obj.avg_latency_ms or 180) + new_lat) / 2)

    db.commit()
    db.refresh(test_record)

    return {
        "id": test_record.id,
        "promptId": test_record.prompt_id,
        "provider": test_record.provider,
        "model": test_record.model,
        "inputText": test_record.input_text,
        "outputText": test_record.output_text,
        "responseTimeMs": test_record.response_time_ms,
        "status": test_record.status,
        "code": ai_result.get("error_code"),
        "errorMessage": ai_result.get("error"),
        "createdAt": format_datetime_str(test_record.created_at)
    }


@router.get("")
def list_user_tests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tests = db.query(PromptTest).filter(
        PromptTest.user_id == current_user.id
    ).order_by(PromptTest.created_at.desc()).limit(50).all()

    return [
        {
            "id": t.id,
            "promptId": t.prompt_id,
            "provider": t.provider,
            "model": t.model,
            "inputText": t.input_text,
            "outputText": t.output_text,
            "responseTimeMs": t.response_time_ms,
            "status": t.status,
            "createdAt": format_datetime_str(t.created_at)
        }
        for t in tests
    ]
