# pyrefly: ignore [missing-import]
import pytest_lazyfixture
import os
import sys
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token, hash_password

client = TestClient(app)

def get_auth_headers():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "generator_test@promptcommit.dev").first()
        if not user:
            user = User(
                email="generator_test@promptcommit.dev",
                username="generatortester",
                name="Generator Tester",
                password_hash=hash_password("password123")
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token(subject=user.id)
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()

def test_prompt_generator_ui_polisher_endpoint():
    """Verify that the AI prompt generator endpoint accepts natural language rough ideas and returns a valid prompt structure."""
    headers = get_auth_headers()
    payload = {
        "title": "UI Dashboard",
        "description": "Make the UI look beautiful, responsive, and modern",
        "category": "Frontend",
        "provider": "Google Gemini",
        "model": "gemini-3.6-flash",
        "temperature": 0.7,
        "max_tokens": 1024
    }
    response = client.post("/api/prompts/generate", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "title" in data
    assert "prompt" in data
    assert data["provider"] == "Google Gemini"
    assert data["model"] == "gemini-3.6-flash"
    assert data["status"] in ["success", "unconfigured", "error"]

def test_prompt_generator_login_page_intent():
    """Verify AI prompt generation for login page intent."""
    headers = get_auth_headers()
    payload = {
        "title": "Login Page",
        "description": "Make login page more professional with email/password and OAuth",
        "category": "Authentication",
        "provider": "Google Gemini",
        "model": "gemini-3.6-flash"
    }
    response = client.post("/api/prompts/generate", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["success", "unconfigured", "error"]

def test_prompt_generator_dark_mode_responsive():
    """Verify AI prompt generation for dark mode and responsive design."""
    headers = get_auth_headers()
    payload = {
        "title": "Dark Mode & Responsive",
        "description": "Add dark mode support and responsive mobile layout",
        "category": "Design",
        "provider": "Google Gemini",
        "model": "gemini-3.6-flash"
    }
    response = client.post("/api/prompts/generate", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["success", "unconfigured", "error"]

def test_prompt_generator_empty_validation():
    """Verify validation error when title and description are empty."""
    headers = get_auth_headers()
    response = client.post("/api/prompts/generate", json={"title": "", "description": ""}, headers=headers)
    assert response.status_code == 400
    assert "Please enter a Prompt Title or Description" in response.json()["detail"]

def test_prompt_generator_unauthorized():
    """Verify unauthorized rejection."""
    response = client.post("/api/prompts/generate", json={"title": "Test", "description": "Test"})
    assert response.status_code in [401, 403]

if __name__ == "__main__":
    class pytest:
        pass
    pytest.main(["-v", __file__])

