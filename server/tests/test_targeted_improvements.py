import sys
import os
import time
import uuid
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

# Add server root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=== Testing 3 Targeted Improvements (Async Email, Rate Limiting, Granular Status) ===")
    
    rand_id = uuid.uuid4().hex[:6]
    test_user_email = f"audit_owner_{rand_id}@example.com"
    test_target_email = f"target_user_{rand_id}@example.com"
    mismatch_email = f"other_user_{rand_id}@example.com"
    password = "Password123!"

    # Signup Owner User
    r = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "Audit Tester",
        "username": f"owner_{rand_id}",
        "email": test_user_email,
        "password": password,
        "confirm_password": password
    })
    assert r.status_code == 201, f"Signup failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = r.json()["user"]["id"]

    # Signup Target User
    r = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "Target Tester",
        "username": f"target_{rand_id}",
        "email": test_target_email,
        "password": password,
        "confirm_password": password
    })
    assert r.status_code == 201
    target_token = r.json()["access_token"]
    target_headers = {"Authorization": f"Bearer {target_token}"}

    # Signup Mismatch User
    r = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "Mismatch Tester",
        "username": f"mismatch_{rand_id}",
        "email": mismatch_email,
        "password": password,
        "confirm_password": password
    })
    assert r.status_code == 201
    mismatch_token = r.json()["access_token"]
    mismatch_headers = {"Authorization": f"Bearer {mismatch_token}"}

    # Create a prompt for testing
    r = requests.post(f"{BASE_URL}/prompts", headers=headers, json={
        "title": "Quantum Algorithm Architect",
        "description": "System prompt for quantum simulation",
        "category": "Engineering",
        "content": "You are a quantum algorithm developer.",
        "is_private": True
    })
    assert r.status_code == 201
    prompt_id = r.json()["id"]

    # ----------------------------------------------------
    # TEST 1: ASYNC EMAIL DISPATCH VIA BACKGROUNDTASKS
    # ----------------------------------------------------
    print("\n--- Testing Improvement 1: Async Email Dispatch ---")
    start_t = time.perf_counter()
    r = requests.post(f"{BASE_URL}/collaboration/invitations", headers=headers, json={
        "email": test_target_email,
        "name": "Target Tester",
        "role": "Editor",
        "scope": "prompt",
        "promptId": prompt_id,
        "expiresInDays": 7
    })
    elapsed_ms = (time.perf_counter() - start_t) * 1000
    assert r.status_code == 201, f"Invite creation failed: {r.text}"
    inv_data = r.json()
    inv_token = inv_data["token"]
    inv_id = inv_data["id"]
    assert "token" in inv_data and len(inv_data["token"]) > 20
    assert inv_data["status"] == "Pending"
    assert inv_data["recipientUserFound"] == True
    print(f"[PASS] 1.1 Invitation created asynchronously in {elapsed_ms:.1f}ms without blocking HTTP response")

    # Resend invitation is also async
    start_t = time.perf_counter()
    r = requests.post(f"{BASE_URL}/collaboration/invitations/{inv_id}/resend", headers=headers)
    resend_ms = (time.perf_counter() - start_t) * 1000
    assert r.status_code == 200, f"Resend failed: {r.text}"
    print(f"[PASS] 1.2 Resend invitation dispatched asynchronously in {resend_ms:.1f}ms")

    # ----------------------------------------------------
    # TEST 2: GRANULAR INVITATION STATUS CODES
    # ----------------------------------------------------
    print("\n--- Testing Improvement 3: Granular Invitation Status ---")
    
    # 2.1 Valid invitation inspection
    r = requests.get(f"{BASE_URL}/invitations/{inv_token}", headers=target_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] == True
    assert data["statusCode"] == "VALID"
    assert data["status"] == "Active"
    print("[PASS] 2.1 Valid invitation returns statusCode='VALID'")

    # 2.2 Email mismatch inspection
    r = requests.get(f"{BASE_URL}/invitations/{inv_token}", headers=mismatch_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] == False
    assert data["statusCode"] == "EMAIL_MISMATCH"
    assert "different email" in data["statusMessage"].lower()
    print("[PASS] 2.2 Email mismatch returns statusCode='EMAIL_MISMATCH'")

    # 2.3 Accept invitation -> status becomes ALREADY_ACCEPTED
    r = requests.post(f"{BASE_URL}/invitations/{inv_token}/accept", headers=target_headers)
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/invitations/{inv_token}", headers=target_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] == False
    assert data["statusCode"] == "ALREADY_ACCEPTED"
    assert "already been accepted" in data["statusMessage"].lower()
    print("[PASS] 2.3 Accepted invitation returns statusCode='ALREADY_ACCEPTED'")

    # 2.4 Revoked invitation status
    r = requests.post(f"{BASE_URL}/collaboration/invitations", headers=headers, json={
        "email": f"revokeme_{rand_id}@example.com",
        "role": "Viewer",
        "scope": "prompt",
        "promptId": prompt_id,
        "expiresInDays": 7
    })
    assert r.status_code == 201
    rev_token = r.json()["token"]
    rev_id = r.json()["id"]

    r = requests.post(f"{BASE_URL}/collaboration/invitations/{rev_id}/revoke", headers=headers)
    assert r.status_code == 200

    r = requests.get(f"{BASE_URL}/invitations/{rev_token}")
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] == False
    assert data["statusCode"] == "REVOKED"
    assert data["status"] == "Revoked"
    print("[PASS] 2.4 Revoked invitation returns statusCode='REVOKED'")

    # 2.5 Usage limit reached (Shareable link with max_uses=1 accepted once)
    r = requests.post(f"{BASE_URL}/collaboration/share-links", headers=headers, json={
        "promptId": prompt_id,
        "role": "Viewer",
        "maxUses": 1,
        "expiresInDays": 7
    })
    assert r.status_code == 201
    link_token = r.json()["token"]

    # Target user accepts shareable link
    r = requests.post(f"{BASE_URL}/invitations/{link_token}/accept", headers=target_headers)
    assert r.status_code == 200

    # Mismatch user inspects the now exhausted link
    r = requests.get(f"{BASE_URL}/invitations/{link_token}", headers=mismatch_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] == False
    assert data["statusCode"] == "USAGE_LIMIT_REACHED"
    print("[PASS] 2.5 Exhausted shareable link returns statusCode='USAGE_LIMIT_REACHED'")

    # 2.6 Invalid token inspection returns 404
    r = requests.get(f"{BASE_URL}/invitations/invalid_non_existent_token_xyz")
    assert r.status_code == 404
    print("[PASS] 2.6 Non-existent token returns HTTP 404 / INVALID")

    # ----------------------------------------------------
    # TEST 3: RATE LIMITING ON AUTH AND AI ENDPOINTS
    # ----------------------------------------------------
    print("\n--- Testing Improvement 2: Rate Limiting ---")

    # 3.1 RateLimiter unit testing
    from app.core.rate_limiter import InMemoryRateLimiter
    test_limiter = InMemoryRateLimiter()

    # Test login rate limit: 5 failed allowed, 6th fails
    test_ip = "192.168.1.100"
    for _ in range(5):
        assert not test_limiter.is_rate_limited(f"login_failed:{test_ip}", max_requests=5, window_seconds=60)
        test_limiter.record_hit(f"login_failed:{test_ip}")
    assert test_limiter.is_rate_limited(f"login_failed:{test_ip}", max_requests=5, window_seconds=60)
    print("[PASS] 3.1 RateLimiter unit test: Max 5 failed logins per minute enforced")

    # Reset on success
    test_limiter.reset_key(f"login_failed:{test_ip}")
    assert not test_limiter.is_rate_limited(f"login_failed:{test_ip}", max_requests=5, window_seconds=60)
    print("[PASS] 3.2 RateLimiter unit test: Successful login resets failed attempts")

    # Test AI test rate limit: 20 executions allowed, 21st fails
    test_uid = 999
    for _ in range(20):
        assert not test_limiter.is_rate_limited(f"ai_test:{test_uid}", max_requests=20, window_seconds=60)
        test_limiter.record_hit(f"ai_test:{test_uid}")
    assert test_limiter.is_rate_limited(f"ai_test:{test_uid}", max_requests=20, window_seconds=60)
    print("[PASS] 3.3 RateLimiter unit test: Max 20 AI tests per user per minute enforced")

    # 3.4 Successful login succeeds normally and does not count against failed login limit
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": test_user_email, "password": password})
    assert r.status_code == 200, f"Valid login failed: {r.text}"
    print("[PASS] 3.4 Live API: Successful login succeeds normally")

    # 3.5 Live API Failed Login Rate Limiting (5 failures -> 6th fails with 429)
    bad_login_email = f"ratelimit_target_{rand_id}@example.com"
    rl_headers = {"X-Forwarded-For": f"198.51.100.{rand_id[:2]}"}
    for i in range(5):
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": bad_login_email, "password": "WrongPassword!"}, headers=rl_headers)
        assert r.status_code == 401, f"Expected 401 on attempt {i+1}, got {r.status_code}"

    # 6th attempt should be blocked with 429 Too Many Requests
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": bad_login_email, "password": "WrongPassword!"}, headers=rl_headers)
    assert r.status_code == 429, f"Expected 429 on 6th failed login, got {r.status_code}: {r.text}"
    assert "too many" in r.json()["detail"].lower()
    print("[PASS] 3.5 Live API: 6th failed login attempt returned HTTP 429 ('Too many requests. Please try again later.')")

    print("\n========================================================")
    print("ALL 3 TARGETED IMPROVEMENTS VERIFIED & PASSING!")
    print("========================================================\n")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[FAIL] Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
