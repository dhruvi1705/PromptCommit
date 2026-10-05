import io
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

# Ensure app is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.models.user import User
from app.core.security import create_access_token, hash_password
from app.services.multimedia_processor import MultimediaProcessor, MultimediaValidationError, MultimodalNotSupportedError
from app.services.ai_service import ai_service

# Isolated in-memory SQLite database for unit testing
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

class TestMultimediaPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=test_engine)
        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()

    def setUp(self):
        self.db = TestingSessionLocal()
        self.db.query(User).delete()
        self.db.commit()

        # Create primary test user
        self.user_password = "Password123!"
        self.user = User(
            name="Multimedia Tester",
            username="multimedia_user",
            email="multimedia_user@example.com",
            password_hash=hash_password(self.user_password)
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

        # Create second user for isolation test
        self.other_user = User(
            name="Other User",
            username="other_user",
            email="other_user@example.com",
            password_hash=hash_password(self.user_password)
        )
        self.db.add(self.other_user)
        self.db.commit()
        self.db.refresh(self.other_user)

        self.token = create_access_token(self.user.id)
        self.headers = {"Authorization": f"Bearer {self.token}"}

        self.other_token = create_access_token(self.other_user.id)
        self.other_headers = {"Authorization": f"Bearer {self.other_token}"}

    def tearDown(self):
        self.db.close()

    # 1. Text-only request works
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_01_text_only_request(self, mock_run):
        mock_run.return_value = {
            "status": "success",
            "output_text": "REST API explanation response",
            "response_time_ms": 120,
            "error": None
        }

        resp = self.client.post(
            "/api/tests",
            json={
                "prompt_content": "Explain REST APIs",
                "input_text": "What is REST API?",
                "provider": "gemini",
                "model": "gemini-3.6-flash"
            },
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("REST API explanation", data["outputText"])

        # Verify ai_service received text without multimedia attachment
        mock_run.assert_called_once()
        k = mock_run.call_args.kwargs
        self.assertIn("REST APIs", k["prompt_text"])
        self.assertIsNone(k.get("multimedia"))

    # 2 & 3 & 4. Image upload reaches backend, image bytes reach AI service, image MIME reaches AI service
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_02_image_upload_reaches_ai_service_with_content(self, mock_run):
        mock_run.return_value = {
            "status": "success",
            "output_text": "The image displays a blue line chart dashboard.",
            "response_time_ms": 210,
            "error": None
        }

        fake_image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        files = {
            "file": ("test_chart.png", fake_image_bytes, "image/png")
        }
        form_data = {
            "prompt_content": "Describe what is visible in this image.",
            "input_type": "image",
            "provider": "gemini",
            "model": "gemini-3.6-flash"
        }

        resp = self.client.post(
            "/api/tests",
            data=form_data,
            files=files,
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)

        # Verify AI service received actual image content bytes and MIME type
        mock_run.assert_called_once()
        k = mock_run.call_args.kwargs
        multimedia = k.get("multimedia")
        self.assertIsNotNone(multimedia)
        self.assertEqual(multimedia.input_type, "image")
        self.assertEqual(multimedia.raw_bytes, fake_image_bytes)
        self.assertEqual(multimedia.mime_type, "image/png")
        self.assertEqual(multimedia.filename, "test_chart.png")

    # 5 & 6. PDF actual content reaches processing layer & AI input
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_03_pdf_content_reaches_ai_input(self, mock_run):
        mock_run.return_value = {
            "status": "success",
            "output_text": "The PDF topic is Transformer architecture.",
            "response_time_ms": 310,
            "error": None
        }

        sample_pdf = b"%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\nstartxref\n0\n%%EOF"
        files = {
            "file": ("paper.pdf", sample_pdf, "application/pdf")
        }
        form_data = {
            "prompt_content": "What is the main topic of this PDF?",
            "input_type": "pdf",
            "provider": "gemini",
            "model": "gemini-3.6-flash"
        }

        resp = self.client.post(
            "/api/tests",
            data=form_data,
            files=files,
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)

        mock_run.assert_called_once()
        multimedia = mock_run.call_args.kwargs.get("multimedia")
        self.assertIsNotNone(multimedia)
        self.assertEqual(multimedia.input_type, "pdf")
        self.assertEqual(multimedia.raw_bytes, sample_pdf)
        self.assertEqual(multimedia.filename, "paper.pdf")

    # 7. Code content reaches AI service
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_04_code_content_reaches_ai_service(self, mock_run):
        mock_run.return_value = {
            "status": "success",
            "output_text": "This function adds two numbers a and b.",
            "response_time_ms": 150,
            "error": None
        }

        code_text = "def add(a, b):\n    return a + b"
        resp = self.client.post(
            "/api/tests",
            json={
                "prompt_content": "Explain this code.",
                "input_type": "code",
                "code_snippet": code_text,
                "code_language": "python",
                "provider": "gemini",
                "model": "gemini-3.6-flash"
            },
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)

        mock_run.assert_called_once()
        multimedia = mock_run.call_args.kwargs.get("multimedia")
        self.assertIsNotNone(multimedia)
        self.assertEqual(multimedia.input_type, "code")
        self.assertEqual(multimedia.text_content, code_text)
        self.assertEqual(multimedia.language, "python")

    # 8 & 9. Filename alone or Object URL alone is NEVER treated as content
    def test_05_filename_alone_is_not_treated_as_content(self):
        resp = self.client.post(
            "/api/tests",
            json={
                "prompt_content": "Analyze file",
                "input_type": "image",
                "filename": "fake_preview.png"
            },
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("No file content received", resp.json()["detail"])

    def test_06_object_url_alone_is_not_treated_as_content(self):
        resp = self.client.post(
            "/api/tests",
            json={
                "prompt_content": "Analyze image",
                "input_type": "image",
                "input_text": "blob:http://localhost:5173/1234-5678"
            },
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 400)

    # 10. Unsupported MIME rejected
    def test_07_unsupported_mime_rejected(self):
        fake_exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00"
        files = {
            "file": ("malicious.exe", fake_exe_bytes, "application/x-msdownload")
        }
        form_data = {
            "prompt_content": "Inspect file",
            "input_type": "image"
        }
        resp = self.client.post(
            "/api/tests",
            data=form_data,
            files=files,
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Unsupported image MIME type", resp.json()["detail"])

    # 11. Empty file rejected
    def test_08_empty_file_rejected(self):
        empty_bytes = b""
        files = {
            "file": ("empty.png", empty_bytes, "image/png")
        }
        form_data = {
            "prompt_content": "Check image",
            "input_type": "image"
        }
        resp = self.client.post(
            "/api/tests",
            data=form_data,
            files=files,
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("empty", resp.json()["detail"].lower())

    # 12. Oversized file rejected
    def test_09_oversized_file_rejected(self):
        large_bytes = b"0" * (11 * 1024 * 1024)  # 11 MB
        files = {
            "file": ("huge.png", large_bytes, "image/png")
        }
        form_data = {
            "prompt_content": "Check image",
            "input_type": "image"
        }
        resp = self.client.post(
            "/api/tests",
            data=form_data,
            files=files,
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("exceeds", resp.json()["detail"].lower())

    # 13 & 14. Replace attachment uses newest file
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_10_replace_attachment_uses_newest_file(self, mock_run):
        mock_run.return_value = {"status": "success", "output_text": "OK", "response_time_ms": 100}

        img_a = b"IMAGE_A_BYTES_12345"
        img_b = b"IMAGE_B_BYTES_67890"

        # Upload Image A
        resp_a = self.client.post(
            "/api/tests",
            data={"prompt_content": "Analyze", "input_type": "image"},
            files={"file": ("img_a.png", img_a, "image/png")},
            headers=self.headers
        )
        self.assertEqual(resp_a.status_code, 201)
        self.assertEqual(mock_run.call_args.kwargs["multimedia"].raw_bytes, img_a)

        mock_run.reset_mock()

        # Replace with Image B
        resp_b = self.client.post(
            "/api/tests",
            data={"prompt_content": "Analyze", "input_type": "image"},
            files={"file": ("img_b.png", img_b, "image/png")},
            headers=self.headers
        )
        self.assertEqual(resp_b.status_code, 201)
        self.assertEqual(mock_run.call_args.kwargs["multimedia"].raw_bytes, img_b)

    # 15, 16, 17. Text + Image, Text + PDF, Text + Code all reach provider
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_11_text_and_multimedia_both_reach_provider(self, mock_run):
        mock_run.return_value = {"status": "success", "output_text": "OK", "response_time_ms": 100}

        img_bytes = b"IMAGE_BYTES"
        resp = self.client.post(
            "/api/tests",
            data={
                "prompt_content": "System prompt text",
                "input_text": "User specific query about UI layout",
                "input_type": "image"
            },
            files={"file": ("ui.png", img_bytes, "image/png")},
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)
        k = mock_run.call_args.kwargs
        self.assertEqual(k["prompt_text"], "System prompt text")
        self.assertEqual(k["input_text"], "User specific query about UI layout")
        self.assertEqual(k["multimedia"].raw_bytes, img_bytes)

    # 18. Unsupported provider/model returns structured error
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_12_unsupported_multimodal_provider_returns_structured_error(self, mock_run):
        mock_run.return_value = {
            "status": "error",
            "output_text": "",
            "response_time_ms": 50,
            "error": "The selected model (openai/gpt-oss-20b) under provider 'groq' does not support 'image' input attachments.",
            "error_code": "MULTIMODAL_NOT_SUPPORTED",
            "provider": "Groq",
            "model": "openai/gpt-oss-20b"
        }

        resp = self.client.post(
            "/api/tests",
            data={
                "prompt_content": "Describe image",
                "input_type": "image",
                "provider": "groq",
                "model": "openai/gpt-oss-20b"
            },
            files={"file": ("photo.png", b"IMAGE_DATA", "image/png")},
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["status"], "error")
        self.assertEqual(data["code"], "MULTIMODAL_NOT_SUPPORTED")
        self.assertIn("does not support 'image'", data["errorMessage"])

    # 19. User isolation
    def test_13_user_isolation(self):
        with patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = {"status": "success", "output_text": "User 1 response", "response_time_ms": 100}

            resp1 = self.client.post(
                "/api/tests",
                json={"prompt_content": "User 1 test", "input_text": "Query 1"},
                headers=self.headers
            )
            self.assertEqual(resp1.status_code, 201)

            # List tests for User 2 -> User 2 should NOT see User 1's test
            resp2_list = self.client.get("/api/tests", headers=self.other_headers)
            self.assertEqual(resp2_list.status_code, 200)
            u2_tests = resp2_list.json()
            u1_test_ids = [t["id"] for t in u2_tests if t["id"] == resp1.json()["id"]]
            self.assertEqual(len(u1_test_ids), 0)

    # 20 & 21 & 22 & 23 & 24. Edge cases & No attachment request still works
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_14_no_attachment_request_still_works(self, mock_run):
        mock_run.return_value = {"status": "success", "output_text": "Simple output", "response_time_ms": 80}

        resp = self.client.post(
            "/api/tests",
            json={"prompt_content": "Simple text prompt", "provider": "gemini", "model": "gemini-3.6-flash"},
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["status"], "success")
        self.assertIsNone(mock_run.call_args.kwargs.get("multimedia"))

    def test_15_multimedia_metadata_safe_logging(self):
        media = MultimediaProcessor.validate_and_create(
            input_type="image",
            filename="secret_photo.png",
            mime_type="image/png",
            raw_bytes=b"SECRET_BYTES_12345"
        )
        log_dict = media.safe_log_dict()
        self.assertEqual(log_dict["input_type"], "image")
        self.assertEqual(log_dict["filename"], "secret_photo.png")
        self.assertEqual(log_dict["file_size_bytes"], 18)
        self.assertTrue(log_dict["content_received"])
        self.assertNotIn("SECRET_BYTES_12345", str(log_dict))
        self.assertNotIn("raw_bytes", log_dict)

    # 16. /api/tests/run endpoint with FormData
    @patch("app.routes.tests.ai_service.run_prompt", new_callable=AsyncMock)
    def test_16_api_tests_run_formdata_endpoint(self, mock_run):
        mock_run.return_value = {
            "status": "success",
            "output_text": "Image described via /api/tests/run",
            "response_time_ms": 150,
            "error": None
        }
        fake_img = b"\x89PNG\r\n\x1a\nFakeImageData"
        resp = self.client.post(
            "/api/tests/run",
            data={
                "prompt_content": "describe the image",
                "input_type": "image",
                "provider": "gemini",
                "model": "gemini-3.6-flash"
            },
            files={"file": ("test.png", fake_img, "image/png")},
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["status"], "success")
        self.assertEqual(mock_run.call_args.kwargs["multimedia"].raw_bytes, fake_img)

    # 17. Non-dict JSON body returns 400 Bad Request
    def test_17_non_dict_json_body_returns_400(self):
        resp = self.client.post(
            "/api/tests",
            content="\"just_a_string\"",
            headers={**self.headers, "Content-Type": "application/json"}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("JSON dictionary", resp.json()["detail"])

    # 18. Capability matrix verification for all 6 models
    def test_18_verify_capability_all_models(self):
        # Gemini models support text, image, pdf, code
        for m in ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"]:
            MultimediaProcessor.verify_capability("gemini", m, "text")
            MultimediaProcessor.verify_capability("gemini", m, "image")
            MultimediaProcessor.verify_capability("gemini", m, "pdf")
            MultimediaProcessor.verify_capability("gemini", m, "code")

        # OpenRouter free supports text, image, pdf, code
        MultimediaProcessor.verify_capability("openrouter", "openrouter/free", "text")
        MultimediaProcessor.verify_capability("openrouter", "openrouter/free", "image")
        MultimediaProcessor.verify_capability("openrouter", "openrouter/free", "pdf")
        MultimediaProcessor.verify_capability("openrouter", "openrouter/free", "code")

        # Mistral small supports text, image, pdf, code
        MultimediaProcessor.verify_capability("mistral", "mistral-small-latest", "text")
        MultimediaProcessor.verify_capability("mistral", "mistral-small-latest", "image")
        MultimediaProcessor.verify_capability("mistral", "mistral-small-latest", "pdf")
        MultimediaProcessor.verify_capability("mistral", "mistral-small-latest", "code")

        # Groq supports text, pdf, code but NOT image
        MultimediaProcessor.verify_capability("groq", "openai/gpt-oss-20b", "text")
        MultimediaProcessor.verify_capability("groq", "openai/gpt-oss-20b", "pdf")
        MultimediaProcessor.verify_capability("groq", "openai/gpt-oss-20b", "code")
        with self.assertRaises(MultimodalNotSupportedError):
            MultimediaProcessor.verify_capability("groq", "openai/gpt-oss-20b", "image")

    # 19. Real Image Test - OpenRouter Free receives actual base64 data URL payload
    async def _test_openrouter_image_transport_async(self):
        import base64
        import httpx
        # Valid 1x1 PNG image
        real_png_bytes = bytes([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
            0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
            0x42, 0x60, 0x82
        ])
        expected_b64 = base64.b64encode(real_png_bytes).decode("utf-8")
        expected_data_url = f"data:image/png;base64,{expected_b64}"

        media = MultimediaProcessor.validate_and_create(
            input_type="image",
            filename="dot.png",
            mime_type="image/png",
            raw_bytes=real_png_bytes
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "I see a 1x1 transparent dot image."}}]
        }

        captured_post_calls = []
        class MockAsyncClient:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass
            async def post(self, url, json=None, headers=None):
                captured_post_calls.append({"url": url, "json": json, "headers": headers})
                return mock_response

        with patch("app.services.ai_service.httpx.AsyncClient", MockAsyncClient), \
             patch("app.services.ai_service.settings.OPENROUTER_API_KEY", "test-openrouter-key"):
            result = await ai_service.run_prompt(
                provider="OpenRouter",
                model="openrouter/free",
                prompt_text="Analyze image",
                input_text="Describe",
                multimedia=media
            )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["output_text"], "I see a 1x1 transparent dot image.")
        self.assertEqual(len(captured_post_calls), 1)

        sent_payload = captured_post_calls[0]["json"]
        self.assertEqual(sent_payload["model"], "openrouter/free")
        messages = sent_payload["messages"]
        user_msg = next((m for m in messages if m["role"] == "user"), None)
        self.assertIsNotNone(user_msg)
        content_parts = user_msg["content"]
        self.assertTrue(isinstance(content_parts, list))

        # Verify image_url is in standard OpenAI / OpenRouter format and contains the actual image data URL
        img_part = next((p for p in content_parts if p.get("type") == "image_url"), None)
        self.assertIsNotNone(img_part)
        self.assertEqual(img_part["image_url"]["url"], expected_data_url)

    def test_19_openrouter_image_transport(self):
        import asyncio
        asyncio.run(self._test_openrouter_image_transport_async())

    # 20. Real Image Test - Mistral Small receives actual base64 data URL payload
    async def _test_mistral_image_transport_async(self):
        import base64
        import httpx
        real_png_bytes = bytes([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
            0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
            0x42, 0x60, 0x82
        ])
        expected_b64 = base64.b64encode(real_png_bytes).decode("utf-8")
        expected_data_url = f"data:image/png;base64,{expected_b64}"

        media = MultimediaProcessor.validate_and_create(
            input_type="image",
            filename="dot.png",
            mime_type="image/png",
            raw_bytes=real_png_bytes
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Mistral detected a 1x1 image."}}]
        }

        captured_post_calls = []
        class MockAsyncClient:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass
            async def post(self, url, json=None, headers=None):
                captured_post_calls.append({"url": url, "json": json, "headers": headers})
                return mock_response

        with patch("app.services.ai_service.httpx.AsyncClient", MockAsyncClient), \
             patch("app.services.ai_service.settings.MISTRAL_API_KEY", "test-mistral-key"):
            result = await ai_service.run_prompt(
                provider="Mistral AI",
                model="mistral-small-latest",
                prompt_text="Analyze image",
                input_text="Describe",
                multimedia=media
            )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["output_text"], "Mistral detected a 1x1 image.")
        self.assertEqual(len(captured_post_calls), 1)

        sent_payload = captured_post_calls[0]["json"]
        self.assertEqual(sent_payload["model"], "mistral-small-latest")
        messages = sent_payload["messages"]
        user_msg = next((m for m in messages if m["role"] == "user"), None)
        self.assertIsNotNone(user_msg)
        content_parts = user_msg["content"]
        self.assertTrue(isinstance(content_parts, list))

        img_part = next((p for p in content_parts if p.get("type") == "image_url"), None)
        self.assertIsNotNone(img_part)
        self.assertEqual(img_part["image_url"]["url"], expected_data_url)

    def test_20_mistral_image_transport(self):
        import asyncio
        asyncio.run(self._test_mistral_image_transport_async())

    # 21. Real Image Test - Gemini models receive actual raw image bytes Part
    async def _test_gemini_image_transport_async(self):
        real_png_bytes = bytes([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
            0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
            0x42, 0x60, 0x82
        ])

        media = MultimediaProcessor.validate_and_create(
            input_type="image",
            filename="dot.png",
            mime_type="image/png",
            raw_bytes=real_png_bytes
        )

        for gemini_model in ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"]:
            mock_client = MagicMock()
            mock_interaction = MagicMock()
            mock_interaction.output_text = f"Gemini {gemini_model} sees the image."
            mock_client.interactions.create.return_value = mock_interaction

            with patch("app.services.ai_service.genai.Client", return_value=mock_client), \
                 patch("app.services.ai_service.settings.GEMINI_API_KEY", "test-gemini-key"):
                res = await ai_service.run_prompt(
                    provider="Google Gemini",
                    model=gemini_model,
                    prompt_text="Examine image",
                    input_text="What is this?",
                    multimedia=media
                )

            self.assertEqual(res["status"], "success")
            self.assertEqual(res["output_text"], f"Gemini {gemini_model} sees the image.")
            mock_client.interactions.create.assert_called_once()
            call_kwargs = mock_client.interactions.create.call_args.kwargs
            self.assertEqual(call_kwargs["model"], gemini_model)
            payload = call_kwargs["input"]
            self.assertTrue(isinstance(payload, list))
            # Second item is types.Part with data and mime_type
            part = payload[1]
            self.assertIsNotNone(part)

    def test_21_gemini_image_transport(self):
        import asyncio
        asyncio.run(self._test_gemini_image_transport_async())

    # 22. Real Image Test - Groq GPT-OSS 20B image request is cleanly rejected
    async def _test_groq_image_rejection_async(self):
        real_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        media = MultimediaProcessor.validate_and_create(
            input_type="image",
            filename="dot.png",
            mime_type="image/png",
            raw_bytes=real_png_bytes
        )
        res = await ai_service.run_prompt(
            provider="Groq",
            model="openai/gpt-oss-20b",
            prompt_text="Examine image",
            input_text="What is this?",
            multimedia=media
        )
        self.assertEqual(res["status"], "error")
        self.assertEqual(res["error_code"], "MULTIMODAL_NOT_SUPPORTED")
        self.assertIn("does not support 'image'", res["error"])

    def test_22_groq_image_rejection(self):
        import asyncio
        asyncio.run(self._test_groq_image_rejection_async())

    # 23. Provider API 400 error returns structured error
    async def _test_provider_api_error_handling_async(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {"error": {"message": "Selected free model does not support multimodal vision."}}
        mock_resp.text = "Bad Request"

        class MockClient400:
            def __init__(self, *args, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, exc_type, exc_val, exc_tb): pass
            async def post(self, url, json=None, headers=None): return mock_resp

        media = MultimediaProcessor.validate_and_create(
            input_type="image",
            filename="dot.png",
            mime_type="image/png",
            raw_bytes=b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        )

        with patch("app.services.ai_service.httpx.AsyncClient", MockClient400), \
             patch("app.services.ai_service.settings.OPENROUTER_API_KEY", "test-key"):
            res = await ai_service.run_prompt(
                provider="OpenRouter",
                model="openrouter/free",
                prompt_text="Check",
                input_text="Describe",
                multimedia=media
            )
        self.assertEqual(res["status"], "error")
        self.assertIn("OpenRouter API error", res["error"])

    def test_23_provider_api_error_handling(self):
        import asyncio
        asyncio.run(self._test_provider_api_error_handling_async())


if __name__ == "__main__":
    unittest.main()

