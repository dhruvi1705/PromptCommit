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
        user = db.query(User).filter(User.email == "test_prompt_gen@example.com").first()
        if not user:
            user = User(
                email="test_prompt_gen@example.com",
                username="aiprompttester",
                name="AI Tester",
                password_hash=hash_password("password123")
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token(subject=user.id)
        return token
    finally:
        db.close()

def test_prompt_generation_empty_input():
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/api/prompts/generate", json={
        "title": "",
        "description": "",
        "category": "Coding",
        "provider": "Google Gemini",
        "model": "gemini-3.6-flash"
    }, headers=headers)

    assert response.status_code == 400
    assert "Please enter a Prompt Title or Description" in response.json()["detail"]

def test_prompt_generation_unauthorized():
    client = TestClient(app)
    response = client.post("/api/prompts/generate", json={
        "title": "Make UI beautiful",
        "description": "Improve design"
    })
    assert response.status_code in [401, 403]

def test_prompt_generation_test1_mke_ui_lok():
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/api/prompts/generate", json={
        "title": "ui",
        "description": "mke the ui lok beautiful",
        "category": "Frontend",
        "provider": "Google Gemini",
        "model": "gemini-3.6-flash"
    }, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert "title" in data
    assert "prompt" in data
    assert data["provider"] == "Google Gemini"
    assert data["status"] in ["success", "unconfigured", "error"]

def test_prompt_generation_all_providers():
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    models_to_test = [
        ("Google Gemini", "gemini-3.6-flash"),
        ("Google Gemini", "gemini-3.7-flash"),
        ("Google Gemini", "gemini-3.8-flash"),
        ("Groq", "openai/gpt-oss-20b"),
        ("OpenRouter", "openrouter/free"),
        ("Mistral AI", "mistral-small-latest")
    ]

    for provider, model in models_to_test:
        response = client.post("/api/prompts/generate", json={
            "title": "Button Component",
            "description": "make button blue",
            "category": "Frontend",
            "provider": provider,
            "model": model
        }, headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["provider"] == provider
        assert data["model"] == model

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
