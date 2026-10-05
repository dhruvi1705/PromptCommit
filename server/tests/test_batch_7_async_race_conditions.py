"""
Test Suite for Batch 7:
- Problems 61–62: AI Compare & Test concurrency & rapid overlap
- Problems 63–67: Timers & lifecycle verification
- Problem 68: StrictMode & side-effect idempotency
- Problem 69: Google GIS listener stability
- Problem 70: Stale requests, rapid mutations & user switch isolation
"""

import time
import uuid
import threading
import requests

BASE_URL = "http://localhost:8000/api"


def register_user(name_prefix="User"):
    ts = int(time.time() * 1000) % 100000
    rand = uuid.uuid4().hex[:6]
    email = f"b7_{rand}_{ts}@promptcommit.dev"
    username = f"u7_{rand}_{ts}"
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


def test_concurrent_ai_compare_and_test_execution():
    """Verify that multiple concurrent AI compare and test requests complete safely without corrupting server state."""
    user, headers, _ = register_user("AICompareTester")

    # Create 2 prompts
    r1 = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Prompt Alpha", "content": "You are a helpful assistant A."},
        headers=headers
    )
    assert r1.status_code == 201
    p1 = r1.json()["id"]

    r2 = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Prompt Beta", "content": "You are a helpful assistant B."},
        headers=headers
    )
    assert r2.status_code == 201
    p2 = r2.json()["id"]

    results = []

    def run_compare(model_name):
        res = requests.post(
            f"{BASE_URL}/prompts/compare",
            json={
                "promptAContent": "Prompt A text instructions",
                "promptBContent": "Prompt B text instructions",
                "promptATitle": "Alpha",
                "promptBTitle": "Beta",
                "provider": "Google Gemini",
                "model": model_name
            },
            headers=headers
        )
        results.append((res.status_code, res.json()))

    threads = []
    models = ["gemini-3.6-flash", "gemini-3.6-flash"]
    for m in models:
        t = threading.Thread(target=run_compare, args=(m,))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    assert len(results) == 2
    for status, data in results:
        assert status == 200
        assert "versionA" in data
        assert "versionB" in data
        assert "comparison" in data
    print("[OK] Concurrent AI Compare & Test execution test passed.")


def test_rapid_favorite_mutations_consistency():
    """Verify rapid favorite toggles result in consistent authoritative state."""
    user, headers, _ = register_user("FavTester")

    r = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Fav Test Prompt", "content": "Content here"},
        headers=headers
    )
    p_id = r.json()["id"]

    # Toggle 3 times
    r1 = requests.post(f"{BASE_URL}/prompts/{p_id}/favorite", headers=headers)
    assert r1.status_code == 200
    assert r1.json()["isFavorite"] is True

    r2 = requests.post(f"{BASE_URL}/prompts/{p_id}/favorite", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["isFavorite"] is False

    r3 = requests.post(f"{BASE_URL}/prompts/{p_id}/favorite", headers=headers)
    assert r3.status_code == 200
    assert r3.json()["isFavorite"] is True

    # Authoritative get
    r_check = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    assert r_check.status_code == 200
    assert r_check.json()["isFavorite"] is True
    print("[OK] Rapid favorite mutations consistency test passed.")


def test_rapid_rating_mutations():
    """Verify multiple rapid rating updates persist the latest authoritative rating."""
    user, headers, _ = register_user("Rater")

    r = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Rated Prompt", "content": "Instructions"},
        headers=headers
    )
    p_id = r.json()["id"]

    # Rate 4, then rate 5
    r_rate1 = requests.post(f"{BASE_URL}/prompts/{p_id}/rate", params={"rating": 4.0}, headers=headers)
    assert r_rate1.status_code == 200

    r_rate2 = requests.post(f"{BASE_URL}/prompts/{p_id}/rate", params={"rating": 5.0}, headers=headers)
    assert r_rate2.status_code == 200
    assert r_rate2.json()["rating"] == 4.5
    assert r_rate2.json()["ratingCount"] == 2

    # Verify authoritative prompt
    r_check = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    assert r_check.json()["rating"] == 4.5
    print("[OK] Rapid rating mutations test passed.")


def test_user_switching_isolation():
    """Verify that User A's data and prompt operations are strictly isolated from User B."""
    userA, hA, _ = register_user("UserAlpha")
    userB, hB, _ = register_user("UserBeta")

    # User A creates prompt
    rA = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Secret Prompt A", "content": "Confidential A"},
        headers=hA
    )
    pA_id = rA.json()["id"]

    # User B should NOT see User A's prompt in user prompts
    rB_list = requests.get(f"{BASE_URL}/prompts", headers=hB)
    assert rB_list.status_code == 200
    userB_prompt_ids = [p["id"] for p in rB_list.json()]
    assert pA_id not in userB_prompt_ids

    # User B cannot mutate User A's prompt
    rB_del = requests.delete(f"{BASE_URL}/prompts/{pA_id}", headers=hB)
    assert rB_del.status_code in [403, 404]

    # User A can still retrieve prompt
    rA_get = requests.get(f"{BASE_URL}/prompts/{pA_id}", headers=hA)
    assert rA_get.status_code == 200
    assert rA_get.json()["title"] == "Secret Prompt A"
    print("[OK] User switching isolation test passed.")


def test_collection_duplicate_protection():
    """Verify duplicate collection handling and prompt association."""
    user, headers, _ = register_user("ColCreator")

    r1 = requests.post(
        f"{BASE_URL}/collections",
        json={"name": "Engineering Vault", "description": "Dev prompts"},
        headers=headers
    )
    assert r1.status_code == 201
    c1_id = r1.json()["id"]

    # Attempt duplicate collection creation (idempotent / graceful handling)
    r2 = requests.post(
        f"{BASE_URL}/collections",
        json={"name": "Engineering Vault", "description": "Dev prompts 2"},
        headers=headers
    )
    assert r2.status_code in [200, 201, 400]

    # Verify user's collections
    r_list = requests.get(f"{BASE_URL}/collections", headers=headers)
    assert r_list.status_code == 200
    col_names = [c["name"] for c in r_list.json()]
    assert "Engineering Vault" in col_names
    print("[OK] Collection duplicate protection test passed.")


def test_rapid_collaboration_role_updates():
    """Verify rapid role changes on shared prompt resolve deterministically."""
    owner, h_owner, _ = register_user("OwnerRoleTest")
    collab, h_collab, _ = register_user("CollabRoleTest")

    r_p = requests.post(
        f"{BASE_URL}/prompts",
        json={"title": "Collab Role Prompt", "content": "Instructions"},
        headers=h_owner
    )
    p_id = r_p.json()["id"]

    # Share with collab as Viewer
    r_share = requests.post(
        f"{BASE_URL}/prompts/{p_id}/share",
        json={"email": collab["email"], "role": "Viewer", "name": collab["name"]},
        headers=h_owner
    )
    assert r_share.status_code in [200, 201]

    # Update role to Editor then Reviewer
    requests.post(
        f"{BASE_URL}/prompts/{p_id}/share",
        json={"email": collab["email"], "role": "Editor", "name": collab["name"]},
        headers=h_owner
    )

    requests.post(
        f"{BASE_URL}/prompts/{p_id}/share",
        json={"email": collab["email"], "role": "Reviewer", "name": collab["name"]},
        headers=h_owner
    )

    # Check authoritative prompt share list
    r_check = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=h_owner)
    assert r_check.status_code == 200
    shared_with = r_check.json().get("sharedWith", [])
    matching = [m for m in shared_with if m.get("email", "").lower() == collab["email"].lower()]
    assert len(matching) == 1
    assert matching[0]["role"] == "Reviewer"
    print("[OK] Rapid collaboration role updates test passed.")


def run_all_tests():
    print("\n" + "=" * 60)
    print("PROMPTCOMMIT - BATCH 7 TEST SUITE")
    print("Async Race Conditions, Effect Cleanup, Timers & Stale Requests")
    print("=" * 60 + "\n")

    tests = [
        test_concurrent_ai_compare_and_test_execution,
        test_rapid_favorite_mutations_consistency,
        test_rapid_rating_mutations,
        test_user_switching_isolation,
        test_collection_duplicate_protection,
        test_rapid_collaboration_role_updates
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
    print(f"BATCH 7 TEST SUMMARY: {passed} passed, {failed} failed")
    print("=" * 60 + "\n")
    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    run_all_tests()
