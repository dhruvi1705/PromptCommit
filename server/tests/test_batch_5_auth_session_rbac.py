"""
Test Suite for Batch 5:
- Problems 41 & 42: Demo login & credentials audit
- Problems 43 & 44: Session state, token expiration (401 with expired JWT)
- Problem 45: API reliability, 401 vs 403 error separation
- Problems 46, 47, 48, 49, 50: Canonical collaboration roles, RBAC matrix enforcement, prompt-level isolation, and activity privacy
"""

import time
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests
import jwt

BASE_URL = "http://localhost:8000/api"
# JWT Secret from config for controlled token testing
JWT_SECRET_KEY = "promptcommit_super_secret_jwt_key_for_testing_only"
JWT_ALGORITHM = "HS256"


def register_user(name_prefix="User"):
    ts = int(time.time() * 1000) % 100000
    rand = uuid.uuid4().hex[:6]
    email = f"b5_{rand}_{ts}@promptcommit.dev"
    username = f"u5_{rand}_{ts}"
    full_name = f"{name_prefix} {rand.upper()}"
    payload = {
        "email": email,
        "username": username,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "name": full_name
    }
    r = requests.post(f"{BASE_URL}/auth/signup", json=payload)
    assert r.status_code == 201, f"Failed to register user: {r.text}"
    data = r.json()
    token = data["access_token"]
    user = data["user"]
    headers = {"Authorization": f"Bearer {token}"}
    return user, headers, token


def test_expired_jwt_returns_401_unauthorized():
    """Verify that an expired JWT token returns HTTP 401 Unauthorized"""
    user, _, _ = register_user("ExpiredTester")
    
    # Forge a token with exp 1 hour in the past
    past_exp = datetime.now(timezone.utc) - timedelta(hours=1)
    expired_payload = {
        "sub": user["id"],
        "exp": int(past_exp.timestamp())
    }
    expired_token = jwt.encode(expired_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    bad_headers = {"Authorization": f"Bearer {expired_token}"}
    r = requests.get(f"{BASE_URL}/auth/me", headers=bad_headers)
    assert r.status_code == 401, f"Expected 401 for expired JWT, got {r.status_code}"


def test_401_vs_403_separation():
    """Verify 401 is strictly authentication failure and 403 is authorization failure"""
    # 1. Invalid JWT -> 401
    r_unauth = requests.get(f"{BASE_URL}/prompts", headers={"Authorization": "Bearer not_a_valid_token"})
    assert r_unauth.status_code == 401

    # 2. Authenticated user without edit permission -> 403
    user_a, headers_a, _ = register_user("OwnerUser")
    user_b, headers_b, _ = register_user("ViewerUser")

    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Prompt 403 Test", "content": "Owner content"}, headers=headers_a)
    prompt_id = r_p.json()["id"]

    # Share with User B as Viewer (Read-only)
    requests.post(f"{BASE_URL}/prompts/{prompt_id}/share", json={"email": user_b["email"], "role": "Viewer"}, headers=headers_a)

    # User B attempts to edit -> 403 Forbidden
    r_edit = requests.put(f"{BASE_URL}/prompts/{prompt_id}", json={"content": "Hacked content"}, headers=headers_b)
    assert r_edit.status_code == 403, f"Expected 403 for Viewer attempting edit, got {r_edit.status_code}"

    # User B attempts to create version -> 403 Forbidden
    r_ver = requests.post(f"{BASE_URL}/prompts/{prompt_id}/versions", json={"version_tag": "v2.0", "content": "Ver 2"}, headers=headers_b)
    assert r_ver.status_code == 403, f"Expected 403 for Viewer attempting version create, got {r_ver.status_code}"


def test_rbac_editor_permissions():
    """Verify Editor role can edit content and create versions, but cannot delete prompt or invite members"""
    user_a, headers_a, _ = register_user("OwnerA")
    user_b, headers_b, _ = register_user("EditorB")

    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Editor RBAC Test", "content": "Initial code"}, headers=headers_a)
    prompt_id = r_p.json()["id"]

    # Share with User B as Editor
    requests.post(f"{BASE_URL}/prompts/{prompt_id}/share", json={"email": user_b["email"], "role": "Editor"}, headers=headers_a)

    # Editor updates content -> Success (200)
    r_edit = requests.put(f"{BASE_URL}/prompts/{prompt_id}", json={"content": "Updated by Editor B"}, headers=headers_b)
    assert r_edit.status_code == 200

    # Editor creates version -> Success (201)
    r_ver = requests.post(f"{BASE_URL}/prompts/{prompt_id}/versions", json={"version_tag": "v2.0", "commit_message": "Editor commit", "content": "Ver 2"}, headers=headers_b)
    assert r_ver.status_code == 201

    # Editor tries to delete prompt -> Forbidden / Not found (404/403)
    r_del = requests.delete(f"{BASE_URL}/prompts/{prompt_id}", headers=headers_b)
    assert r_del.status_code in [403, 404]

    # Editor tries to invite another user -> Forbidden / Not found (404/403)
    r_inv = requests.post(f"{BASE_URL}/collaboration/invitations", json={"email": "random@promptcommit.dev", "prompt_id": prompt_id, "role": "Viewer"}, headers=headers_b)
    assert r_inv.status_code in [403, 404]


def test_prompt_level_role_isolation():
    """Verify permissions on Prompt A do not bleed into Prompt B"""
    user_a, headers_a, _ = register_user("MultiOwner")
    user_b, headers_b, _ = register_user("MultiCollaborator")

    # Owner creates Prompt 1 and Prompt 2
    r_p1 = requests.post(f"{BASE_URL}/prompts", json={"title": "Prompt 1 (Viewer)", "content": "Instructions 1"}, headers=headers_a)
    p1_id = r_p1.json()["id"]

    r_p2 = requests.post(f"{BASE_URL}/prompts", json={"title": "Prompt 2 (Editor)", "content": "Instructions 2"}, headers=headers_a)
    p2_id = r_p2.json()["id"]

    # Share P1 as Viewer, P2 as Editor
    requests.post(f"{BASE_URL}/prompts/{p1_id}/share", json={"email": user_b["email"], "role": "Viewer"}, headers=headers_a)
    requests.post(f"{BASE_URL}/prompts/{p2_id}/share", json={"email": user_b["email"], "role": "Editor"}, headers=headers_a)

    # 1. User B on P1 -> Edit should fail (403)
    r_edit_p1 = requests.put(f"{BASE_URL}/prompts/{p1_id}", json={"content": "Mutating P1"}, headers=headers_b)
    assert r_edit_p1.status_code == 403

    # 2. User B on P2 -> Edit should succeed (200)
    r_edit_p2 = requests.put(f"{BASE_URL}/prompts/{p2_id}", json={"content": "Mutating P2"}, headers=headers_b)
    assert r_edit_p2.status_code == 200

    # 3. Change role on P2 to Reviewer -> P2 edit should now fail (403)
    requests.put(f"{BASE_URL}/collaboration/members/{user_b['email']}/prompts/{p2_id}/role", json={"role": "Reviewer"}, headers=headers_a)
    r_edit_p2_after = requests.put(f"{BASE_URL}/prompts/{p2_id}", json={"content": "Mutating P2 again"}, headers=headers_b)
    assert r_edit_p2_after.status_code == 403


def test_collaboration_activity_privacy():
    """Verify User C cannot see collaboration activity on private prompts between User A and User B"""
    user_a, headers_a, _ = register_user("UserA")
    user_b, headers_b, _ = register_user("UserB")
    user_c, headers_c, _ = register_user("UserC_Stranger")

    # User A creates prompt and shares with User B
    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Confidential Prompt AB", "content": "Super secret"}, headers=headers_a)
    prompt_id = r_p.json()["id"]
    requests.post(f"{BASE_URL}/prompts/{prompt_id}/share", json={"email": user_b["email"], "role": "Editor"}, headers=headers_a)

    # User A adds comment
    requests.post(f"{BASE_URL}/prompts/{prompt_id}/comments", json={"content": "Private discussion"}, headers=headers_a)

    # User C fetches activity feed
    r_act_c = requests.get(f"{BASE_URL}/collaboration/activity", headers=headers_c)
    assert r_act_c.status_code == 200
    activities_c = r_act_c.json()

    # Verify no activities reference Confidential Prompt AB
    for act in activities_c:
        assert act.get("promptId") != prompt_id, f"Privacy violation: Stranger saw activity for prompt {prompt_id}"
        assert "Confidential Prompt AB" not in act.get("title", "")
        assert "Confidential Prompt AB" not in act.get("description", "")


if __name__ == "__main__":
    pytest.main(["-v", __file__])
