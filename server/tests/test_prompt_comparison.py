import pytest
import os
import sys

# Add server directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import engine
from app.models.user import User
from app.core.security import create_access_token, hash_password
from sqlalchemy.orm import sessionmaker

TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_test_token():
    db = TestSessionLocal()
    try:
        user = db.query(User).filter(User.email == "test_prompt_compare@example.com").first()
        if not user:
            user = User(
                email="test_prompt_compare@example.com",
                username="promptcomparetester",
                name="Compare Tester",
                password_hash=hash_password("password123")
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token(subject=user.id)
        return token
    finally:
        db.close()

def test_prompt_compare_empty_input():
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/api/prompts/compare", json={
        "promptAContent": "",
        "promptBContent": "",
        "provider": "Google Gemini",
        "model": "gemini-3.6-flash"
    }, headers=headers)

    assert response.status_code in [400, 422]


def test_prompt_compare_unauthorized():
    client = TestClient(app)
    response = client.post("/api/prompts/compare", json={
        "promptAContent": "Write code.",
        "promptBContent": "Write clean python code."
    })
    assert response.status_code in [401, 403]

def test_prompt_compare_dynamic_evaluation():
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Version A: Simple rough prompt
    content_a = "Write code."
    # Version B: Highly specific and structured prompt
    content_b = (
        "You are a Senior Python Developer.\n\n"
        "Objective: Write a robust Python function `validate_email(email: str) -> dict`.\n\n"
        "Requirements:\n"
        "1. Validate standard RFC 5322 email formatting using regex.\n"
        "2. Handle empty strings, NoneType, and malformed domain names gracefully.\n"
        "3. Return a dictionary containing {'is_valid': bool, 'error': Optional[str]}.\n\n"
        "Output Format:\n"
        "- Clean, production-grade Python code block with type hints and docstrings."
    )

    response = client.post("/api/prompts/compare", json={
        "promptAContent": content_a,
        "promptBContent": content_b,
        "promptATitle": "Version 1.0",
        "promptBTitle": "Version 1.1",
        "provider": "Google Gemini",
        "model": "gemini-3.6-flash"
    }, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert "versionA" in data
    assert "versionB" in data
    assert "comparison" in data
    assert data["provider"] == "Google Gemini"
    assert data["status"] in ["success", "unconfigured", "error"]

    if data["status"] == "success":
        va = data["versionA"]
        vb = data["versionB"]
        # Verify metric score ranges
        for m in ["clarity", "specificity", "completeness", "structure", "efficiency", "overall"]:
            assert 0 <= va[m] <= 100
            assert 0 <= vb[m] <= 100

        # Verify deterministic overall score formula
        expected_overall_a = round(va["clarity"] * 0.25 + va["specificity"] * 0.25 + va["completeness"] * 0.20 + va["structure"] * 0.15 + va["efficiency"] * 0.15)
        expected_overall_b = round(vb["clarity"] * 0.25 + vb["specificity"] * 0.25 + vb["completeness"] * 0.20 + vb["structure"] * 0.15 + vb["efficiency"] * 0.15)
        assert va["overall"] == expected_overall_a
        assert vb["overall"] == expected_overall_b

        # Version B is much more specific/complete than "Write code."
        assert vb["overall"] >= va["overall"]

def test_prompt_compare_all_providers():
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    providers = [
        ("Google Gemini", "gemini-3.6-flash"),
        ("Google Gemini", "gemini-3.7-flash"),
        ("Google Gemini", "gemini-3.8-flash"),
        ("Groq", "openai/gpt-oss-20b"),
        ("OpenRouter", "openrouter/free"),
        ("Mistral AI", "mistral-small-latest")
    ]

    for provider, model in providers:
        response = client.post("/api/prompts/compare", json={
            "promptAContent": "Create a blue button in React.",
            "promptBContent": "Create a responsive accessible Blue Button component in React with hover and active states.",
            "promptATitle": "Variant A",
            "promptBTitle": "Variant B",
            "provider": provider,
            "model": model
        }, headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["provider"] == provider
        assert data["model"] == model

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
