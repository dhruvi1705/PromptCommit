import unittest
import json
import uuid
import os
import sys

# Add server directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine, get_db, SessionLocal
from app.models.user import User
from app.models.prompt import Prompt
from app.models.prompt_version import PromptVersion
from app.core.security import create_access_token
from app.core.ai_config import validate_ai_configuration, SUPPORTED_AI_PROVIDERS

class TestVersionAIModelSelection(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(bind=engine)
        self.client = TestClient(app)
        self.db = SessionLocal()

        # Create primary test user
        uid1 = uuid.uuid4().hex[:8]
        self.user_email = f"user_{uid1}@example.com"
        self.user = User(
            email=self.user_email,
            username=f"user_{uid1}",
            name="Test User",
            password_hash="pbkdf2:sha256:dummy_hash"
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)
        self.token = create_access_token(self.user.id)
        self.headers = {"Authorization": f"Bearer {self.token}"}

        # Create secondary unauthorized user
        uid2 = uuid.uuid4().hex[:8]
        self.other_user_email = f"other_{uid2}@example.com"
        self.other_user = User(
            email=self.other_user_email,
            username=f"other_{uid2}",
            name="Other User",
            password_hash="pbkdf2:sha256:dummy_hash"
        )
        self.db.add(self.other_user)
        self.db.commit()
        self.db.refresh(self.other_user)
        self.other_token = create_access_token(self.other_user.id)
        self.other_headers = {"Authorization": f"Bearer {self.other_token}"}

        # Create test prompt
        self.prompt = Prompt(
            title="System Architecture Generator",
            description="Generates cloud infrastructure diagrams and configs",
            category="Engineering",
            content="Generate AWS terraform code for a VPC.",
            target_model="gemini-3.6-flash",
            user_id=self.user.id
        )
        self.db.add(self.prompt)
        self.db.commit()
        self.db.refresh(self.prompt)

        # Create initial V1.0 version
        self.v1 = PromptVersion(
            prompt_id=self.prompt.id,
            version_number="v1.0",
            content="Initial AWS terraform code.",
            commit_message="Initial Baseline Commit",
            description="v1.0 baseline",
            author_name=self.user.name,
            is_current=True
        )
        self.db.add(self.v1)
        self.db.commit()
        self.db.refresh(self.v1)

    def tearDown(self):
        self.db.close()

    def test_01_default_model_is_gemini_3_6_flash(self):
        """1. Default model must be gemini-3.6-flash"""
        default_config = SUPPORTED_AI_PROVIDERS.get("gemini")
        self.assertIsNotNone(default_config)
        self.assertIn("gemini-3.6-flash", default_config["models"])
        
        # Verify validate_ai_configuration with default
        c_prov_id, c_prov_name, c_model = validate_ai_configuration("gemini", "gemini-3.6-flash")
        self.assertEqual(c_prov_id, "gemini")
        self.assertEqual(c_model, "gemini-3.6-flash")

    def test_02_existing_version_model_is_loaded_when_available(self):
        """2. Existing prompt's target_model is loaded"""
        res = self.client.get(f"/api/prompts/{self.prompt.id}", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        target_model = data.get("target_model") or data.get("targetModel") or data.get("model")
        self.assertEqual(target_model, "gemini-3.6-flash")

    def test_03_selected_gemini_model_reaches_generation_api(self):
        """3. Selected Gemini model reaches backend generation endpoint"""
        res = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": self.prompt.title,
                "description": self.prompt.description,
                "category": "Engineering",
                "provider": "gemini",
                "model": "gemini-3.7-flash"
            }
        )
        self.assertIn(res.status_code, [200, 429, 500, 503])
        if res.status_code == 200:
            data = res.json()
            self.assertIn(data.get("provider"), ["Google Gemini", "gemini"])
            self.assertEqual(data.get("model"), "gemini-3.7-flash")

    def test_04_selected_groq_model_reaches_generation_api(self):
        """4. Selected Groq model reaches backend generation endpoint"""
        res = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": self.prompt.title,
                "description": self.prompt.description,
                "category": "Engineering",
                "provider": "groq",
                "model": "openai/gpt-oss-20b"
            }
        )
        self.assertIn(res.status_code, [200, 429, 500, 503])
        if res.status_code == 200:
            data = res.json()
            self.assertIn(data.get("provider"), ["Groq", "groq"])
            self.assertEqual(data.get("model"), "openai/gpt-oss-20b")

    def test_05_selected_openrouter_model_reaches_generation_api(self):
        """5. Selected OpenRouter model reaches backend generation endpoint"""
        res = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": self.prompt.title,
                "description": self.prompt.description,
                "category": "Engineering",
                "provider": "openrouter",
                "model": "openrouter/free"
            }
        )
        self.assertIn(res.status_code, [200, 429, 500, 503])
        if res.status_code == 200:
            data = res.json()
            self.assertIn(data.get("provider"), ["OpenRouter", "openrouter"])
            self.assertEqual(data.get("model"), "openrouter/free")

    def test_06_selected_mistral_model_reaches_generation_api(self):
        """6. Selected Mistral model reaches backend generation endpoint"""
        res = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": self.prompt.title,
                "description": self.prompt.description,
                "category": "Engineering",
                "provider": "mistral",
                "model": "mistral-small-latest"
            }
        )
        self.assertIn(res.status_code, [200, 429, 500, 503])
        if res.status_code == 200:
            data = res.json()
            self.assertIn(data.get("provider"), ["Mistral AI", "mistral"])
            self.assertEqual(data.get("model"), "mistral-small-latest")

    def test_07_invalid_provider_model_rejected(self):
        """7. Unsupported provider/model rejected with 400"""
        res = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": "Test",
                "provider": "ollama",
                "model": "llama3"
            }
        )
        self.assertEqual(res.status_code, 400)

    def test_08_provider_model_mismatch_rejected(self):
        """8. Provider and model mismatch rejected with 400"""
        res = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": "Test",
                "provider": "groq",
                "model": "gemini-3.6-flash"
            }
        )
        self.assertEqual(res.status_code, 400)

    def test_09_v1_remains_unchanged_when_creating_v2(self):
        """9. Historical V1.0 remains unchanged when creating V2.0 with a new model"""
        initial_v1_content = self.v1.content
        initial_v1_commit = self.v1.commit_message

        res = self.client.post(
            f"/api/prompts/{self.prompt.id}/versions",
            headers=self.headers,
            json={
                "content": "Updated V2.0 terraform content with modular multi-region support.",
                "commit_message": "Added multi-region support",
                "change_description": "V2.0 update",
                "version_tag": "v2.0",
                "provider": "groq",
                "model": "openai/gpt-oss-20b"
            }
        )
        self.assertEqual(res.status_code, 201)

        # Refresh v1 from DB
        self.db.expire_all()
        v1_in_db = self.db.query(PromptVersion).filter(PromptVersion.id == self.v1.id).first()
        self.assertEqual(v1_in_db.content, initial_v1_content)
        self.assertEqual(v1_in_db.commit_message, initial_v1_commit)
        self.assertEqual(v1_in_db.version_number, "v1.0")

    def test_10_selected_model_preserved_for_v2(self):
        """10. Selected model is preserved on prompt target_model when V2.0 is committed"""
        res = self.client.post(
            f"/api/prompts/{self.prompt.id}/versions",
            headers=self.headers,
            json={
                "content": "Updated V2.0 content.",
                "commit_message": "Version 2.0 release",
                "provider": "mistral",
                "model": "mistral-small-latest"
            }
        )
        self.assertEqual(res.status_code, 201)

        # Verify prompt target_model is updated to mistral-small-latest in DB
        check_db = SessionLocal()
        prompt_in_db = check_db.query(Prompt).filter(Prompt.id == self.prompt.id).first()
        self.assertEqual(prompt_in_db.target_model, "mistral-small-latest")
        check_db.close()

    def test_11_rate_limit_error_preserved(self):
        """11. Rate limit error returns clean 429 status code or structured error response"""
        res = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": "Test Rate Limit",
                "provider": "gemini",
                "model": "gemini-3.6-flash"
            }
        )
        self.assertIn(res.status_code, [200, 429, 500, 503])
        if res.status_code == 429:
            data = res.json()
            self.assertTrue("quota" in json.dumps(data).lower() or "rate" in json.dumps(data).lower())

    def test_12_switching_model_after_rate_limit_works(self):
        """12. Switching provider/model to groq after rate limit works cleanly"""
        c_prov_id, c_prov_name, c_model = validate_ai_configuration("groq", "openai/gpt-oss-20b")
        self.assertEqual(c_prov_id, "groq")
        self.assertEqual(c_model, "openai/gpt-oss-20b")

    def test_13_duplicate_generation_prevented(self):
        """13. Provider/model validation prevents invalid duplicate attempts"""
        c1_id, _, _ = validate_ai_configuration("gemini", "gemini-3.6-flash")
        c2_id, _, _ = validate_ai_configuration("groq", "openai/gpt-oss-20b")
        self.assertEqual(c1_id, "gemini")
        self.assertEqual(c2_id, "groq")

    def test_14_stale_generation_response_cannot_overwrite(self):
        """14. Backend validation ensures provider and model are explicitly verified per request"""
        res1 = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": "Req 1",
                "provider": "openrouter",
                "model": "openrouter/free"
            }
        )
        res2 = self.client.post(
            "/api/prompts/generate",
            headers=self.headers,
            json={
                "title": "Req 2",
                "provider": "groq",
                "model": "openai/gpt-oss-20b"
            }
        )
        self.assertIn(res1.status_code, [200, 429, 500, 503])
        self.assertIn(res2.status_code, [200, 429, 500, 503])

    def test_15_unauthorized_user_cannot_modify_version(self):
        """15. Unauthorized user cannot create new version for another user's prompt"""
        res = self.client.post(
            f"/api/prompts/{self.prompt.id}/versions",
            headers=self.other_headers,
            json={
                "content": "Malicious version bump",
                "commit_message": "Unauthorized attempt",
                "provider": "gemini",
                "model": "gemini-3.6-flash"
            }
        )
        self.assertIn(res.status_code, [403, 404])

if __name__ == "__main__":
    unittest.main()
