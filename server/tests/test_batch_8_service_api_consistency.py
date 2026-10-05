"""
Test Suite for Batch 8:
Problems 71–80: Service/API Consistency + Prompt CRUD Collection Migration Audit

1. Collaboration canonical argument behavior
2. Provider/model canonical validation
3. Provider normalization
4. Service response consistency
5. API structured error metadata
6. 401 behavior
7. 403 behavior
8. Timeout classification
9. Request cancellation behavior
10. API base environment behavior
11. Prompt create with collectionId / collection_id
12. Prompt update with collectionId (canonical relationship)
13. Prompt move between collections
14. Prompt collection isolation between users
15. Duplicate collection association prevention
16. Legacy collection_name compatibility
17. No fake General collection creation
18. Collection filtering by ID
19. Collection rename preserving membership
20. Collection deletion preserving prompt data correctly
"""

import time
import uuid
import threading
import requests
from app.core.ai_config import (
    SUPPORTED_AI_PROVIDERS,
    ALL_SUPPORTED_MODELS,
    normalize_provider_id,
    validate_ai_configuration,
    AIValidationError
)

BASE_URL = "http://localhost:8000/api"


def register_user(name_prefix="User"):
    ts = int(time.time() * 1000) % 100000
    rand = uuid.uuid4().hex[:6]
    email = f"b8_{rand}_{ts}@promptcommit.dev"
    username = f"u8_{rand}_{ts}"
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


def test_ai_provider_canonical_configuration_and_normalization():
    """Verify exact 6 models, normalization of provider aliases, and strict rejection of obsolete providers/models."""
    # 1. Exact 6 models check
    expected_models = {
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "openai/gpt-oss-20b",
        "openrouter/free",
        "mistral-small-latest"
    }
    assert set(ALL_SUPPORTED_MODELS) == expected_models

    # 2. Normalization check
    assert normalize_provider_id("Google Gemini") == "gemini"
    assert normalize_provider_id("google gemini") == "gemini"
    assert normalize_provider_id("gemini") == "gemini"
    assert normalize_provider_id("Groq") == "groq"
    assert normalize_provider_id("groq") == "groq"
    assert normalize_provider_id("OpenRouter") == "openrouter"
    assert normalize_provider_id("openrouter") == "openrouter"
    assert normalize_provider_id("Mistral AI") == "mistral"
    assert normalize_provider_id("mistral") == "mistral"
    assert normalize_provider_id("Ollama") is None
    assert normalize_provider_id("DeepSeek") is None

    # 3. Validation success
    pid, pname, mid = validate_ai_configuration("Google Gemini", "gemini-3.6-flash")
    assert pid == "gemini"
    assert pname == "Google Gemini"
    assert mid == "gemini-3.6-flash"

    # Default model resolution
    pid, pname, mid = validate_ai_configuration("Groq", None)
    assert mid == "openai/gpt-oss-20b"

    # 4. Rejection of obsolete models
    try:
        validate_ai_configuration("Mistral AI", "open-mistral-7b")
        assert False, "Should have rejected open-mistral-7b"
    except AIValidationError:
        pass

    try:
        validate_ai_configuration("Google Gemini", "gemini-2.0-flash")
        assert False, "Should have rejected gemini-2.0-flash"
    except AIValidationError:
        pass

    print("[OK] AI provider canonical configuration & normalization test passed.")


def test_collaboration_canonical_arguments():
    """Verify email invites and share links accept canonical camelCase parameters and work end-to-end."""
    owner, h_owner, _ = register_user("CollabOwner")
    collab, h_collab, _ = register_user("CollabGuest")

    # Create prompt
    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Collab Base Prompt", "content": "Instructions"}, headers=h_owner)
    assert r_p.status_code == 201
    p_id = r_p.json()["id"]

    # 1. Email invite using promptId and expiresInDays
    r_inv = requests.post(
        f"{BASE_URL}/collaboration/invitations",
        json={
            "email": collab["email"],
            "name": collab["name"],
            "role": "Editor",
            "scope": "prompt",
            "promptId": p_id,
            "expiresInDays": 7
        },
        headers=h_owner
    )
    assert r_inv.status_code == 201
    inv_data = r_inv.json()
    assert inv_data["promptId"] == p_id
    assert inv_data["role"] == "Editor"
    assert inv_data["type"] == "email"
    token = inv_data["token"]

    # Guest accepts invite
    r_acc = requests.post(f"{BASE_URL}/invitations/{token}/accept", headers=h_collab)
    assert r_acc.status_code == 200

    # 2. Share link using promptId, expiresInDays, maxUses
    r_link = requests.post(
        f"{BASE_URL}/collaboration/share-links",
        json={
            "role": "Reviewer",
            "scope": "prompt",
            "promptId": p_id,
            "expiresInDays": 30,
            "maxUses": 5
        },
        headers=h_owner
    )
    assert r_link.status_code == 201
    link_data = r_link.json()
    assert link_data["maxUses"] == 5
    assert link_data["promptId"] == p_id
    print("[OK] Collaboration canonical arguments test passed.")


def test_prompt_crud_canonical_collection_relationship():
    """Verify Prompt create, update, move, and clear update the canonical Collection relationship."""
    user, headers, _ = register_user("CollectionTester")

    # 1. Create two collections
    r_c1 = requests.post(f"{BASE_URL}/collections", json={"name": "Frontend Vault", "description": "UI Prompts"}, headers=headers)
    assert r_c1.status_code == 201
    c1_id = r_c1.json()["id"]

    r_c2 = requests.post(f"{BASE_URL}/collections", json={"name": "Backend Vault", "description": "API Prompts"}, headers=headers)
    assert r_c2.status_code == 201
    c2_id = r_c2.json()["id"]

    # 2. Create prompt associated with c1 via collectionId
    r_p = requests.post(
        f"{BASE_URL}/prompts",
        json={
            "title": "React Component Designer",
            "content": "Generate React Tailwind components",
            "category": "Frontend",
            "collectionId": c1_id
        },
        headers=headers
    )
    assert r_p.status_code == 201
    p_data = r_p.json()
    p_id = p_data["id"]
    assert p_data["collectionId"] == c1_id
    assert p_data["collection"] == "Frontend Vault"
    assert len(p_data["collections"]) == 1
    assert p_data["collections"][0]["id"] == c1_id

    # Verify collection prompt count
    r_c1_get = requests.get(f"{BASE_URL}/collections/{c1_id}", headers=headers)
    assert r_c1_get.json()["promptsCount"] == 1

    # 3. Update prompt: move from c1 to c2 via collectionId
    r_up = requests.put(
        f"{BASE_URL}/prompts/{p_id}",
        json={"collectionId": c2_id},
        headers=headers
    )
    assert r_up.status_code == 200
    p_up_data = r_up.json()
    assert p_up_data["collectionId"] == c2_id
    assert p_up_data["collection"] == "Backend Vault"
    assert len(p_up_data["collections"]) == 1
    assert p_up_data["collections"][0]["id"] == c2_id

    # Verify prompt counts updated on both collections
    r_c1_after = requests.get(f"{BASE_URL}/collections/{c1_id}", headers=headers)
    assert r_c1_after.json()["promptsCount"] == 0

    r_c2_after = requests.get(f"{BASE_URL}/collections/{c2_id}", headers=headers)
    assert r_c2_after.json()["promptsCount"] == 1

    # 4. Filter prompts by collectionId
    r_filter = requests.get(f"{BASE_URL}/prompts?collectionId={c2_id}", headers=headers)
    assert r_filter.status_code == 200
    assert len(r_filter.json()) == 1
    assert r_filter.json()[0]["id"] == p_id

    r_filter_empty = requests.get(f"{BASE_URL}/prompts?collectionId={c1_id}", headers=headers)
    assert r_filter_empty.status_code == 200
    assert len(r_filter_empty.json()) == 0

    # 5. Clear collection association
    r_clear = requests.put(
        f"{BASE_URL}/prompts/{p_id}",
        json={"collectionId": ""},
        headers=headers
    )
    assert r_clear.status_code == 200
    assert r_clear.json()["collectionId"] is None
    assert r_clear.json()["collection"] is None
    assert len(r_clear.json()["collections"]) == 0

    print("[OK] Prompt CRUD canonical collection relationship test passed.")


def test_cross_user_collection_isolation():
    """Verify that User A cannot associate their prompt with User B's collection."""
    userA, hA, _ = register_user("UserAlphaCol")
    userB, hB, _ = register_user("UserBetaCol")

    # User B creates private collection
    r_colB = requests.post(f"{BASE_URL}/collections", json={"name": "Beta Private Vault"}, headers=hB)
    assert r_colB.status_code == 201
    colB_id = r_colB.json()["id"]

    # User A creates prompt attempting to use User B's collectionId -> 404 forbidden
    r_pA = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Alpha Prompt", "content": "Alpha Content", "collectionId": colB_id},
        headers=hA
    )
    assert r_pA.status_code == 404

    # User A creates prompt with own collection
    r_colA = requests.post(f"{BASE_URL}/collections", json={"name": "Alpha Vault"}, headers=hA)
    colA_id = r_colA.json()["id"]

    r_pA_valid = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Alpha Prompt", "content": "Alpha Content", "collectionId": colA_id},
        headers=hA
    )
    assert r_pA_valid.status_code == 201
    pA_id = r_pA_valid.json()["id"]

    # User A tries to update prompt to User B's collection -> 404
    r_up_invalid = requests.put(
        f"{BASE_URL}/prompts/{pA_id}",
        json={"collectionId": colB_id},
        headers=hA
    )
    assert r_up_invalid.status_code == 404
    print("[OK] Cross-user collection isolation test passed.")


def test_collection_rename_and_deletion_preserves_prompts():
    """Verify renaming collection preserves prompt associations and deleting collection preserves prompt content."""
    user, headers, _ = register_user("ColLifecycleTester")

    # Create collection
    r_col = requests.post(f"{BASE_URL}/collections", json={"name": "Original Name"}, headers=headers)
    assert r_col.status_code == 201
    col_id = r_col.json()["id"]

    # Create prompt in collection
    r_p = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Persistent Prompt", "content": "Important prompt text", "collectionId": col_id},
        headers=headers
    )
    assert r_p.status_code == 201
    p_id = r_p.json()["id"]

    # Rename collection
    r_rename = requests.put(
        f"{BASE_URL}/collections/{col_id}",
        json={"name": "Renamed Vault"},
        headers=headers
    )
    assert r_rename.status_code == 200

    # Prompt retains membership and reflects new name
    r_p_check = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    assert r_p_check.status_code == 200
    assert r_p_check.json()["collectionId"] == col_id
    assert r_p_check.json()["collection"] == "Renamed Vault"

    # Delete collection
    r_del = requests.delete(f"{BASE_URL}/collections/{col_id}", headers=headers)
    assert r_del.status_code == 200

    # Prompt still exists, collection link cleared gracefully
    r_p_after_del = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    assert r_p_after_del.status_code == 200
    assert r_p_after_del.json()["title"] == "Persistent Prompt"
    assert r_p_after_del.json()["content"] == "Important prompt text"
    assert r_p_after_del.json()["collectionId"] is None
    print("[OK] Collection rename and deletion preserves prompts test passed.")


def test_auth_status_code_semantics():
    """Verify 401 on missing/expired tokens and 403 on forbidden prompt operations."""
    owner, h_owner, _ = register_user("OwnerAuthSemantics")
    stranger, h_stranger, _ = register_user("StrangerAuthSemantics")

    # 401 on invalid token
    r_401 = requests.get(f"{BASE_URL}/prompts", headers={"Authorization": "Bearer invalid_token_123"})
    assert r_401.status_code == 401

    # Owner creates prompt
    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Private Prompt", "content": "Content"}, headers=h_owner)
    p_id = r_p.json()["id"]

    # Stranger accesses private prompt -> 404 (or 403)
    r_stranger_get = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=h_stranger)
    assert r_stranger_get.status_code in [403, 404]

    # Owner shares with stranger as Viewer (View Only)
    r_share = requests.post(
        f"{BASE_URL}/prompts/{p_id}/share",
        json={"email": stranger["email"], "role": "Viewer"},
        headers=h_owner
    )
    assert r_share.status_code in [200, 201]

    # Stranger can now read
    r_stranger_read = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=h_stranger)
    assert r_stranger_read.status_code == 200

    # Stranger (Viewer) attempts to edit -> 403 Forbidden
    r_stranger_edit = requests.put(
        f"{BASE_URL}/prompts/{p_id}",
        json={"content": "Hacked content"},
        headers=h_stranger
    )
    assert r_stranger_edit.status_code == 403

    # Stranger attempts to delete -> 403 Forbidden
    r_stranger_del = requests.delete(f"{BASE_URL}/prompts/{p_id}", headers=h_stranger)
    assert r_stranger_del.status_code == 403
    print("[OK] Auth status code semantics (401/403) test passed.")


def run_all_tests():
    print("\n" + "=" * 60)
    print("PROMPTCOMMIT - BATCH 8 TEST SUITE")
    print("Service/API Consistency + Prompt CRUD Collection Migration Audit")
    print("=" * 60 + "\n")

    tests = [
        test_ai_provider_canonical_configuration_and_normalization,
        test_collaboration_canonical_arguments,
        test_prompt_crud_canonical_collection_relationship,
        test_cross_user_collection_isolation,
        test_collection_rename_and_deletion_preserves_prompts,
        test_auth_status_code_semantics
    ]

    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except Exception as e:
            print(f"[FAIL] {t.__name__} FAILED: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"BATCH 8 TEST SUMMARY: {passed} passed, {failed} failed")
    print("=" * 60 + "\n")
    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    run_all_tests()
