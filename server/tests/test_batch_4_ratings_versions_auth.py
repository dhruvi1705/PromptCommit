"""
Test Suite for Batch 4:
- Problems 31 & 32: Ratings and empty states (null rating for unrated prompts, real averages)
- Problem 33: Version author metadata derived from authenticated user
- Problems 34 & 35: Date formatting and status vs timestamp separation
- Problems 36, 37, 38, 39, 40: JWT auth, 401 vs 403 handling, logout endpoint
"""

import time
import uuid
import pytest
import requests

BASE_URL = "http://localhost:8000/api"

def register_user(name_prefix="User"):
    ts = int(time.time() * 1000) % 100000
    rand = uuid.uuid4().hex[:6]
    email = f"b4_{rand}_{ts}@promptcommit.dev"
    username = f"u4_{rand}_{ts}"
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


def test_new_prompt_rating_is_null_and_unrated():
    """Verify newly created prompts have rating=None and ratingCount=0, not fake 5.0"""
    user, headers, _ = register_user("Tester")
    
    # Create prompt
    prompt_payload = {
        "title": "Unrated Test Prompt",
        "content": "You are a helpful coding assistant.",
        "category": "Coding"
    }
    r = requests.post(f"{BASE_URL}/prompts", json=prompt_payload, headers=headers)
    assert r.status_code == 200 or r.status_code == 201
    created = r.json()
    assert created["rating"] is None, f"Expected rating to be None for new prompt, got {created['rating']}"
    assert created["ratingCount"] == 0, f"Expected ratingCount to be 0 for new prompt, got {created['ratingCount']}"


def test_prompt_rating_calculation_and_running_average():
    """Verify rating updates compute honest averages without starting from fake 5.0"""
    user, headers, _ = register_user("Rater")
    
    # Create prompt
    r = requests.post(f"{BASE_URL}/prompts", json={"title": "Rateable Prompt", "content": "Assistant prompt"}, headers=headers)
    prompt_id = r.json()["id"]

    # 1. Rate with 4.0
    r_rate1 = requests.post(f"{BASE_URL}/prompts/{prompt_id}/rate?rating=4.0", headers=headers)
    assert r_rate1.status_code == 200
    res1 = r_rate1.json()
    assert res1["rating"] == 4.0
    assert res1["ratingCount"] == 1

    # 2. Rate with 2.0 -> average of 4.0 and 2.0 = 3.0
    r_rate2 = requests.post(f"{BASE_URL}/prompts/{prompt_id}/rate?rating=2.0", headers=headers)
    assert r_rate2.status_code == 200
    res2 = r_rate2.json()
    assert res2["rating"] == 3.0
    assert res2["ratingCount"] == 2

    # Fetch prompt via GET
    r_get = requests.get(f"{BASE_URL}/prompts/{prompt_id}", headers=headers)
    assert r_get.status_code == 200
    fetched = r_get.json()
    assert fetched["rating"] == 3.0
    assert fetched["ratingCount"] == 2


def test_analytics_avg_rating_empty_state_and_with_ratings():
    """Verify Analytics service returns avgPromptRating=None when no prompts are rated"""
    user, headers, _ = register_user("AnalyticUser")
    
    # 1. New user with no rated prompts
    requests.post(f"{BASE_URL}/prompts", json={"title": "Prompt 1", "content": "C1"}, headers=headers)
    requests.post(f"{BASE_URL}/prompts", json={"title": "Prompt 2", "content": "C2"}, headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    assert r_an.status_code == 200
    an_data = r_an.json()
    assert an_data["avgPromptRating"] is None, f"Expected None for unrated prompts in analytics, got {an_data['avgPromptRating']}"

    # 2. Rate one prompt with 4.5
    r_prompts = requests.get(f"{BASE_URL}/prompts", headers=headers)
    p_id = r_prompts.json()[0]["id"]
    requests.post(f"{BASE_URL}/prompts/{p_id}/rate?rating=4.5", headers=headers)

    r_an2 = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    an_data2 = r_an2.json()
    assert an_data2["avgPromptRating"] == 4.5


def test_version_author_tracks_authenticated_creator():
    """Verify version author matches the authenticated user and does NOT fall back to 'Aanshi'"""
    user_a, headers_a, _ = register_user("Alice")
    user_b, headers_b, _ = register_user("Bob")

    # Alice creates prompt
    r_create = requests.post(f"{BASE_URL}/prompts", json={"title": "Versioned Prompt", "content": "Initial instructions"}, headers=headers_a)
    p_data = r_create.json()
    prompt_id = p_data["id"]

    # Initial version author must be Alice's name, not Aanshi
    assert len(p_data["versions"]) >= 1
    assert p_data["versions"][0]["author"] == user_a["name"]
    assert "Aanshi" not in p_data["versions"][0]["author"]

    # Share prompt with Bob as Editor
    requests.post(f"{BASE_URL}/prompts/{prompt_id}/share", json={"email": user_b["email"], "role": "Editor"}, headers=headers_a)

    # Bob creates v2.0
    v2_payload = {
        "version_tag": "v2.0",
        "commit_message": "Bob's refinement",
        "content": "Bob's updated instructions"
    }
    r_v2 = requests.post(f"{BASE_URL}/prompts/{prompt_id}/versions", json=v2_payload, headers=headers_b)
    assert r_v2.status_code == 201
    v2_data = r_v2.json()
    assert v2_data["author"] == user_b["name"]
    assert "Aanshi" not in v2_data["author"]


def test_auth_token_validation_and_401_vs_403():
    """Verify 401 is returned for invalid tokens and 403 for unauthorized resource access"""
    # 1. Invalid JWT returns 401
    bad_headers = {"Authorization": "Bearer invalid_garbage_token_12345"}
    r_bad = requests.get(f"{BASE_URL}/prompts", headers=bad_headers)
    assert r_bad.status_code == 401

    # 2. Missing JWT returns 401
    r_none = requests.get(f"{BASE_URL}/prompts")
    assert r_none.status_code == 401

    # 3. Valid user creating a prompt, and another user attempting forbidden operations
    user_a, headers_a, _ = register_user("UserA")
    user_b, headers_b, _ = register_user("UserB")

    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Private User A Prompt", "content": "Secret"}, headers=headers_a)
    prompt_id = r_p.json()["id"]

    # Share with User B as Viewer (Read Only)
    requests.post(f"{BASE_URL}/prompts/{prompt_id}/share", json={"email": user_b["email"], "role": "Viewer"}, headers=headers_a)

    # User B tries to create version -> 403 Forbidden
    r_forbidden = requests.post(
        f"{BASE_URL}/prompts/{prompt_id}/versions",
        json={"version_tag": "v2.0", "commit_message": "Hacking", "content": "Hacked"},
        headers=headers_b
    )
    assert r_forbidden.status_code == 403, f"Expected 403 for Viewer attempting to create version, got {r_forbidden.status_code}"


def test_logout_endpoint():
    """Verify /auth/logout endpoint is functional and returns clean response"""
    user, headers, _ = register_user("LogoutUser")
    r = requests.post(f"{BASE_URL}/auth/logout", headers=headers)
    assert r.status_code == 200
    assert r.json().get("success") is True


if __name__ == "__main__":
    pytest.main(["-v", __file__])
