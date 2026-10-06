# pyrefly: ignore [missing-import]
import pytest
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.core.ai_config import (
    validate_ai_configuration,
    AIValidationError,
    SUPPORTED_AI_PROVIDERS,
    ALL_SUPPORTED_MODELS,
    normalize_provider_id
)
from app.services.ai_service import ai_service
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.prompt_test import PromptTest

client = TestClient(app)


def get_auth_token_for_test(user_id="user1", email="aanshi@promptcommit.dev"):
    # pyrefly: ignore [unexpected-keyword]
    return create_access_token(data={"sub": user_id, "email": email})


# ==============================================================================
# 1. SIX AUTHORITATIVE CONFIGURATIONS VALIDATION TESTS (Tests 1–6)
# ==============================================================================

def test_1_gemini_3_6_valid():
    pid, name, model = validate_ai_configuration("Google Gemini", "gemini-3.6-flash")
    assert pid == "gemini"
    assert name == "Google Gemini"
    assert model == "gemini-3.6-flash"


def test_2_gemini_3_7_valid():
    pid, name, model = validate_ai_configuration("gemini", "gemini-3.7-flash")
    assert pid == "gemini"
    assert name == "Google Gemini"
    assert model == "gemini-3.7-flash"


def test_3_gemini_3_8_valid():
    pid, name, model = validate_ai_configuration("Google", "gemini-3.8-flash")
    assert pid == "gemini"
    assert name == "Google Gemini"
    assert model == "gemini-3.8-flash"


def test_4_groq_gpt_oss_valid():
    pid, name, model = validate_ai_configuration("Groq", "openai/gpt-oss-20b")
    assert pid == "groq"
    assert name == "Groq"
    assert model == "openai/gpt-oss-20b"


def test_5_openrouter_free_valid():
    pid, name, model = validate_ai_configuration("OpenRouter", "openrouter/free")
    assert pid == "openrouter"
    assert name == "OpenRouter"
    assert model == "openrouter/free"


def test_6_mistral_small_valid():
    pid, name, model = validate_ai_configuration("Mistral AI", "mistral-small-latest")
    assert pid == "mistral"
    assert name == "Mistral AI"
    assert model == "mistral-small-latest"


# ==============================================================================
# 2. INVALID PROVIDER & MODEL REJECTIONS (Tests 7–17)
# ==============================================================================

def test_7_invalid_model_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("Google Gemini", "gemini-random-fake")
    assert "Unsupported AI model" in str(exc.value)


def test_8_invalid_provider_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("Anthropic", "claude-3-opus")
    assert "Unsupported AI provider" in str(exc.value)


def test_9_gemini_groq_mismatch_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("Google Gemini", "openai/gpt-oss-20b")
    assert "not supported by provider 'Google Gemini'" in str(exc.value)


def test_10_groq_gemini_mismatch_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("Groq", "gemini-3.6-flash")
    assert "not supported by provider 'Groq'" in str(exc.value)


def test_11_openrouter_gemini_mismatch_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("OpenRouter", "gemini-3.7-flash")
    assert "not supported by provider 'OpenRouter'" in str(exc.value)


def test_12_mistral_gemini_mismatch_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("Mistral AI", "gemini-3.6-flash")
    assert "not supported by provider 'Mistral AI'" in str(exc.value)


def test_13_open_mistral_7b_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("Mistral AI", "open-mistral-7b")
    assert "Unsupported AI model" in str(exc.value)


def test_14_deepseek_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("DeepSeek", "deepseek-chat")
    assert "Unsupported AI provider" in str(exc.value)


def test_15_ollama_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("Ollama", "llama3")
    assert "Unsupported AI provider" in str(exc.value)


def test_16_lm_studio_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("LM Studio", "local-model")
    assert "Unsupported AI provider" in str(exc.value)


def test_17_jan_ai_rejected():
    with pytest.raises(AIValidationError) as exc:
        validate_ai_configuration("Jan AI", "jan-model")
    assert "Unsupported AI provider" in str(exc.value)


import uuid

def create_test_user(name="Batch3 User"):
    suffix = uuid.uuid4().hex[:8]
    email = f"user_{suffix}@promptcommit.dev"
    username = f"u_{suffix}"
    password = "Password123!"

    res = client.post("/api/auth/signup", json={
        "email": email,
        "username": username,
        "password": password,
        "confirm_password": password,
        "name": name
    })
    assert res.status_code in [200, 201], f"Signup failed: {res.text}"
    data = res.json()
    token = data.get("access_token") or data.get("token")
    user_id = data.get("user", {}).get("id") or data.get("id")
    return {"token": token, "email": email, "id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


# ==============================================================================
# 3. NO SILENT SUBSTITUTION & API ROUTE VALIDATION (Tests 18–20)
# ==============================================================================

def test_18_backend_does_not_silently_substitute():
    # Calling run_prompt with an unsupported model returns an error result rather than silently running a fallback
    result = asyncio.run(
        ai_service.run_prompt(
            provider="Mistral AI",
            model="open-mistral-7b",
            prompt_text="Test prompt",
            input_text="Test input"
        )
    )
    assert result["status"] == "error"
    assert "Unsupported AI model" in result["error"]
    assert result["model"] == "open-mistral-7b"


def test_19_selected_model_recorded_in_test_history():
    user = create_test_user("History Tester")

    # Execute a test using valid Gemini 3.7
    resp = client.post(
        "/api/tests",
        headers=user["headers"],
        json={
            "prompt_content": "You are a test assistant.",
            "input_text": "Ping",
            "provider": "Google Gemini",
            "model": "gemini-3.7-flash",
            "temperature": 0.5,
            "max_tokens": 256
        }
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["provider"] == "Google Gemini"
    assert data["model"] == "gemini-3.7-flash"

    # Verify that in the database test record, model is precisely gemini-3.7-flash
    db = SessionLocal()
    try:
        t_record = db.query(PromptTest).filter(PromptTest.id == data["id"]).first()
        assert t_record is not None
        assert t_record.model == "gemini-3.7-flash"
        assert t_record.provider == "Google Gemini"
    finally:
        db.close()


def test_20_ai_execution_response_identifies_actual_model():
    user = create_test_user("Model Identifier User")

    # Test an invalid combination returns 400 Bad Request
    resp_invalid = client.post(
        "/api/tests",
        headers=user["headers"],
        json={
            "prompt_content": "System instructions",
            "input_text": "Sample input",
            "provider": "Groq",
            "model": "gemini-3.6-flash"
        }
    )
    assert resp_invalid.status_code == 400
    assert "not supported by provider 'Groq'" in resp_invalid.json()["detail"]

    # Test valid combination succeeds and returns exact requested model
    resp_valid = client.post(
        "/api/tests",
        headers=user["headers"],
        json={
            "prompt_content": "System instructions",
            "input_text": "Sample input",
            "provider": "Groq",
            "model": "openai/gpt-oss-20b"
        }
    )
    assert resp_valid.status_code == 201
    assert resp_valid.json()["model"] == "openai/gpt-oss-20b"
    assert resp_valid.json()["provider"] == "Groq"

