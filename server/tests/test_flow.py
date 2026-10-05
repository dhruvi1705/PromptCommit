import requests
import json
import sys
import time
import uuid

BASE_URL = "http://127.0.0.1:8000"

# Generate unique test identifiers to avoid collisions on re-runs
UNIQUE_SUFFIX = uuid.uuid4().hex[:8]
TEST_USERNAME = f"testuser_{UNIQUE_SUFFIX}"
TEST_EMAIL = f"testuser_{UNIQUE_SUFFIX}@example.com"
TEST_PASSWORD = "Test@12345"
TEST_NAME = "Integration Test User"


def test_api():
    print("=" * 60)
    print("PromptCommit Integration Tests")
    print("=" * 60)
    passed = 0
    failed = 0

    # ── 1. Health check ──────────────────────────────────────────
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print(f"[PASS] 1. Health check: {r.json()['status']}")
    passed += 1

    # ── 2. Signup with valid data ────────────────────────────────
    r = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "username": TEST_USERNAME,
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "confirm_password": TEST_PASSWORD,
        "name": TEST_NAME
    })
    assert r.status_code == 201, f"Signup failed: {r.text}"
    token = r.json()["access_token"]
    user = r.json()["user"]
    assert user["email"] == TEST_EMAIL
    print(f"[PASS] 2. Signup: created user {user['id']} ({TEST_EMAIL})")
    passed += 1
    auth_headers = {"Authorization": f"Bearer {token}"}

    # ── 3. Duplicate signup rejection (same username) ────────────
    r = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "username": TEST_USERNAME,
        "email": f"other_{UNIQUE_SUFFIX}@example.com",
        "password": TEST_PASSWORD,
        "confirm_password": TEST_PASSWORD,
        "name": "Duplicate Username"
    })
    assert r.status_code == 400, f"Duplicate username should be rejected, got {r.status_code}: {r.text}"
    print(f"[PASS] 3. Duplicate username signup rejected: {r.json().get('detail', '')[:60]}")
    passed += 1

    # ── 4. Duplicate signup rejection (same email) ───────────────
    r = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "username": f"other_{UNIQUE_SUFFIX}",
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "confirm_password": TEST_PASSWORD,
        "name": "Duplicate Email"
    })
    assert r.status_code == 400, f"Duplicate email should be rejected, got {r.status_code}: {r.text}"
    print(f"[PASS] 4. Duplicate email signup rejected: {r.json().get('detail', '')[:60]}")
    passed += 1

    # ── 5. Login with valid credentials ──────────────────────────
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 5. Login successful, JWT token acquired")
    passed += 1

    # ── 6. Invalid login (wrong password) ────────────────────────
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": "WrongPassword@1"
    })
    assert r.status_code == 401, f"Invalid login should return 401, got {r.status_code}"
    print("[PASS] 6. Invalid login rejected with 401")
    passed += 1

    # ── 7. Get current user (authenticated request) ──────────────
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
    assert r.status_code == 200, f"Get me failed: {r.text}"
    me = r.json()["user"]
    assert me["email"] == TEST_EMAIL
    print(f"[PASS] 7. Authenticated user retrieved: {me['name']} ({me['email']})")
    passed += 1

    # ── 8. Unauthenticated request rejected ──────────────────────
    r = requests.get(f"{BASE_URL}/api/prompts")
    assert r.status_code == 401, f"Unauthenticated request should return 401, got {r.status_code}"
    print("[PASS] 8. Unauthenticated request rejected with 401")
    passed += 1

    # ── 9. Create prompt ─────────────────────────────────────────
    r = requests.post(f"{BASE_URL}/api/prompts", headers=auth_headers, json={
        "title": "FastAPI Code Generator",
        "description": "Generates clean FastAPI endpoints with Pydantic validation.",
        "content": "You are a senior Python architect. Generate FastAPI REST endpoints.",
        "category": "Coding",
        "collection": "Engineering",
        "targetModel": "gemini-3.6-flash",
        "tags": ["Python", "FastAPI", "Backend"]
    })
    assert r.status_code == 201, f"Create prompt failed: {r.text}"
    prompt = r.json()
    prompt_id = prompt["id"]
    assert prompt["title"] == "FastAPI Code Generator"
    print(f"[PASS] 9. Created prompt: {prompt['title']} (id: {prompt_id})")
    passed += 1

    # ── 10. Retrieve prompt ──────────────────────────────────────
    r = requests.get(f"{BASE_URL}/api/prompts/{prompt_id}", headers=auth_headers)
    assert r.status_code == 200, f"Get prompt failed: {r.text}"
    assert r.json()["title"] == "FastAPI Code Generator"
    print(f"[PASS] 10. Prompt retrieved: {r.json()['title']}")
    passed += 1

    # ── 11. Update prompt ────────────────────────────────────────
    r = requests.put(f"{BASE_URL}/api/prompts/{prompt_id}", headers=auth_headers, json={
        "title": "FastAPI & SQLAlchemy Code Generator",
        "description": "Updated description with SQLAlchemy support."
    })
    assert r.status_code == 200, f"Update prompt failed: {r.text}"
    assert r.json()["title"] == "FastAPI & SQLAlchemy Code Generator"
    print(f"[PASS] 11. Prompt updated to: {r.json()['title']}")
    passed += 1

    # ── 12. List prompts ─────────────────────────────────────────
    r = requests.get(f"{BASE_URL}/api/prompts", headers=auth_headers)
    assert r.status_code == 200, f"List prompts failed: {r.text}"
    assert any(p["id"] == prompt_id for p in r.json())
    print(f"[PASS] 12. Prompt listing returned {len(r.json())} prompt(s)")
    passed += 1

    # ── 13. Create prompt version ────────────────────────────────
    r = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/versions", headers=auth_headers, json={
        "version_tag": "v1.1",
        "commit_message": "Added ORM relationship specifications",
        "description": "Added constraints for SQLAlchemy foreign keys.",
        "diff_notes": "+ Added foreign key constraints",
        "content": "You are a senior Python architect. Generate FastAPI and SQLAlchemy models with relationships."
    })
    assert r.status_code == 201, f"Create version failed: {r.text}"
    ver = r.json()
    version_id = ver["id"]
    assert ver["version"] == "v1.1"
    print(f"[PASS] 13. Created version {ver['version']} with commit: '{ver['commitMessage']}'")
    passed += 1

    # ── 14. Retrieve version history ─────────────────────────────
    r = requests.get(f"{BASE_URL}/api/prompts/{prompt_id}/versions", headers=auth_headers)
    assert r.status_code == 200, f"Get versions failed: {r.text}"
    versions = r.json()
    assert len(versions) >= 2, f"Expected >= 2 versions, got {len(versions)}"
    print(f"[PASS] 14. Version history: {len(versions)} versions")
    passed += 1

    # ── 15. Restore earlier version ──────────────────────────────
    # Find v1.0 version id
    v1_0 = next((v for v in versions if v["version"] == "v1.0"), None)
    if v1_0:
        r = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/versions/{v1_0['id']}/restore", headers=auth_headers)
        assert r.status_code == 200, f"Restore version failed: {r.text}"
        assert r.json()["success"] is True
        print(f"[PASS] 15. Restored version v1.0 successfully")
        passed += 1
    else:
        print("[SKIP] 15. No v1.0 version found to restore")

    # ── 16. Create collection ────────────────────────────────────
    r = requests.post(f"{BASE_URL}/api/collections", headers=auth_headers, json={
        "name": f"Backend Architectures {UNIQUE_SUFFIX}",
        "description": "API templates and database schemas.",
        "icon": "Cpu",
        "color": "indigo"
    })
    assert r.status_code == 201, f"Create collection failed: {r.text}"
    col = r.json()
    col_id = col["id"]
    print(f"[PASS] 16. Created collection: {col['name']} (id: {col_id})")
    passed += 1

    # ── 17. List collections ─────────────────────────────────────
    r = requests.get(f"{BASE_URL}/api/collections", headers=auth_headers)
    assert r.status_code == 200, f"List collections failed: {r.text}"
    assert any(c["id"] == col_id for c in r.json())
    print(f"[PASS] 17. Collections listed: {len(r.json())} collection(s)")
    passed += 1

    # ── 18. Add prompt to collection ─────────────────────────────
    r = requests.post(f"{BASE_URL}/api/collections/{col_id}/prompts/{prompt_id}", headers=auth_headers)
    assert r.status_code == 200, f"Add prompt to collection failed: {r.text}"
    print(f"[PASS] 18. Added prompt to collection '{col['name']}'")
    passed += 1

    # ── 19. Update collection ────────────────────────────────────
    r = requests.put(f"{BASE_URL}/api/collections/{col_id}", headers=auth_headers, json={
        "description": "Updated collection description for testing."
    })
    assert r.status_code == 200, f"Update collection failed: {r.text}"
    print("[PASS] 19. Collection updated")
    passed += 1

    # ── 20. Favorite prompt ──────────────────────────────────────
    r = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/favorite", headers=auth_headers)
    assert r.status_code == 200, f"Favorite prompt failed: {r.text}"
    assert r.json()["isFavorite"] is True
    print("[PASS] 20. Favorited prompt: isFavorite = True")
    passed += 1

    # ── 21. Get favorites ────────────────────────────────────────
    r = requests.get(f"{BASE_URL}/api/favorites", headers=auth_headers)
    assert r.status_code == 200, f"Get favorites failed: {r.text}"
    favs = r.json()
    assert any(f["id"] == prompt_id for f in favs)
    print(f"[PASS] 21. Favorites retrieved: {len(favs)} favorite(s)")
    passed += 1

    # ── 22. Unfavorite prompt ────────────────────────────────────
    r = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/favorite", headers=auth_headers)
    assert r.status_code == 200, f"Unfavorite prompt failed: {r.text}"
    assert r.json()["isFavorite"] is False
    print("[PASS] 22. Unfavorited prompt: isFavorite = False")
    passed += 1

    # ── 23. Prompt test / playground ─────────────────────────────
    r = requests.post(f"{BASE_URL}/api/tests", headers=auth_headers, json={
        "prompt_id": prompt_id,
        "input_text": "Create an endpoint to register users.",
        "provider": "gemini",
        "model": "gemini-3.6-flash"
    })
    assert r.status_code == 201, f"Test execution failed: {r.text}"
    test_res = r.json()
    assert test_res["status"] in ["success", "error", "unconfigured"]
    print(f"[PASS] 23. Prompt test executed: status='{test_res['status']}', latency={test_res['responseTimeMs']}ms")
    passed += 1

    # ── 24. List tests ───────────────────────────────────────────
    r = requests.get(f"{BASE_URL}/api/tests", headers=auth_headers)
    assert r.status_code == 200, f"List tests failed: {r.text}"
    print(f"[PASS] 24. Tests listed: {len(r.json())} test(s)")
    passed += 1

    # ── 25. Analytics overview ───────────────────────────────────
    r = requests.get(f"{BASE_URL}/api/analytics/overview", headers=auth_headers)
    assert r.status_code == 200, f"Analytics failed: {r.text}"
    analytics = r.json()
    assert analytics["totalPrompts"] >= 1
    print(f"[PASS] 25. Analytics: Prompts={analytics['totalPrompts']}, Versions={analytics['totalVersions']}, Favorites={analytics['totalFavorites']}")
    passed += 1

    # ── 26. Share prompt ─────────────────────────────────────────
    r = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/share", headers=auth_headers, json={
        "email": "collaborator@example.com",
        "role": "View Only",
        "name": "Test Collaborator"
    })
    assert r.status_code == 200, f"Share prompt failed: {r.text}"
    assert r.json()["success"] is True
    print("[PASS] 26. Prompt shared with collaborator")
    passed += 1

    # ── 27. Verify shared collaborator is visible ────────────────
    r = requests.get(f"{BASE_URL}/api/prompts/{prompt_id}", headers=auth_headers)
    assert r.status_code == 200
    shared_with = r.json().get("sharedWith", [])
    assert any(s["email"] == "collaborator@example.com" for s in shared_with)
    share_id = next(s["id"] for s in shared_with if s["email"] == "collaborator@example.com")
    print(f"[PASS] 27. Shared collaborator visible in prompt data ({len(shared_with)} collaborator(s))")
    passed += 1

    # ── 28. Remove shared collaborator ───────────────────────────
    r = requests.delete(f"{BASE_URL}/api/prompts/{prompt_id}/share/{share_id}", headers=auth_headers)
    assert r.status_code == 200, f"Remove collaborator failed: {r.text}"
    print("[PASS] 28. Removed collaborator from prompt")
    passed += 1

    # ── 29. User isolation — create second user ──────────────────
    other_suffix = uuid.uuid4().hex[:8]
    r = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "username": f"otheruser_{other_suffix}",
        "email": f"otheruser_{other_suffix}@example.com",
        "password": TEST_PASSWORD,
        "confirm_password": TEST_PASSWORD,
        "name": "Other Test User"
    })
    assert r.status_code == 201, f"Second user signup failed: {r.text}"
    other_token = r.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}
    print("[PASS] 29. Created second user for isolation test")
    passed += 1

    # ── 30. User isolation — second user cannot access first user's prompt
    r = requests.get(f"{BASE_URL}/api/prompts/{prompt_id}", headers=other_headers)
    assert r.status_code == 404, f"Cross-user access should be denied, got {r.status_code}"
    print("[PASS] 30. User isolation: cross-user prompt access denied (404)")
    passed += 1

    # ── 31. User isolation — second user cannot update first user's prompt
    r = requests.put(f"{BASE_URL}/api/prompts/{prompt_id}", headers=other_headers, json={
        "title": "Hacked Title"
    })
    assert r.status_code == 404, f"Cross-user update should be denied, got {r.status_code}"
    print("[PASS] 31. User isolation: cross-user prompt update denied (404)")
    passed += 1

    # ── 32. User isolation — second user cannot delete first user's prompt
    r = requests.delete(f"{BASE_URL}/api/prompts/{prompt_id}", headers=other_headers)
    assert r.status_code == 404, f"Cross-user delete should be denied, got {r.status_code}"
    print("[PASS] 32. User isolation: cross-user prompt delete denied (404)")
    passed += 1

    # ── 33. Delete collection ────────────────────────────────────
    r = requests.delete(f"{BASE_URL}/api/collections/{col_id}", headers=auth_headers)
    assert r.status_code == 200, f"Delete collection failed: {r.text}"
    assert r.json()["success"] is True
    print("[PASS] 33. Deleted collection")
    passed += 1

    # ── 34. Delete prompt ────────────────────────────────────────
    r = requests.delete(f"{BASE_URL}/api/prompts/{prompt_id}", headers=auth_headers)
    assert r.status_code == 200, f"Delete prompt failed: {r.text}"
    assert r.json()["success"] is True
    print("[PASS] 34. Deleted prompt")
    passed += 1

    # ── 35. Verify deleted prompt is gone ────────────────────────
    r = requests.get(f"{BASE_URL}/api/prompts/{prompt_id}", headers=auth_headers)
    assert r.status_code == 404, f"Deleted prompt should not be found, got {r.status_code}"
    print("[PASS] 35. Verified deleted prompt returns 404")
    passed += 1

    # ── Summary ──────────────────────────────────────────────────
    print()
    print("=" * 60)
    print(f"ALL {passed} BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    test_api()
