import sys
import os
import uuid
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

# Ensure server root is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=== Testing Complete Real Collaboration & Notification System ===")
    
    # 1. Create 3 distinct test users: Alice (Owner), Bob (Recipient 1), Charlie (Recipient 2)
    rand_id = uuid.uuid4().hex[:6]
    alice_email = f"alice_{rand_id}@example.com"
    bob_email = f"bob_{rand_id}@example.com"
    charlie_email = f"charlie_{rand_id}@example.com"
    password = "Password123!"

    # Signup Alice
    r = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "Alice Architect",
        "username": f"alice_{rand_id}",
        "email": alice_email,
        "password": password,
        "confirm_password": password
    })
    assert r.status_code == 201, f"Alice signup failed: {r.text}"
    alice_token = r.json()["access_token"]
    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    alice_id = r.json()["user"]["id"]

    # Signup Bob
    r = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "Bob Builder",
        "username": f"bob_{rand_id}",
        "email": bob_email,
        "password": password,
        "confirm_password": password
    })
    assert r.status_code == 201, f"Bob signup failed: {r.text}"
    bob_token = r.json()["access_token"]
    bob_headers = {"Authorization": f"Bearer {bob_token}"}
    bob_id = r.json()["user"]["id"]

    # Signup Charlie
    r = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "Charlie Reviewer",
        "username": f"charlie_{rand_id}",
        "email": charlie_email,
        "password": password,
        "confirm_password": password
    })
    assert r.status_code == 201, f"Charlie signup failed: {r.text}"
    charlie_token = r.json()["access_token"]
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    print("[PASS] 1. Created 3 isolated test users (Alice, Bob, Charlie)")

    # 2. Alice creates a prompt
    r = requests.post(f"{BASE_URL}/prompts", headers=alice_headers, json={
        "title": "Quantum AI Orchestrator",
        "description": "Multi-agent coordinator prompt",
        "category": "Engineering",
        "content": "You are a Quantum Computing AI specialist.",
        "is_private": True
    })
    assert r.status_code == 201, f"Alice prompt creation failed: {r.text}"
    prompt_id = r.json()["id"]
    print(f"[PASS] 2. Alice created prompt: '{r.json()['title']}' (ID: {prompt_id})")

    # 3. Alice sends an email invitation to Bob (existing user)
    r = requests.post(f"{BASE_URL}/collaboration/invitations", headers=alice_headers, json={
        "email": bob_email,
        "name": "Bob Builder",
        "role": "Editor",
        "scope": "prompt",
        "promptId": prompt_id,
        "expiresInDays": 7
    })
    assert r.status_code == 201, f"Invite creation failed: {r.text}"
    inv_data = r.json()
    bob_invite_token = inv_data["token"]
    bob_inv_id = inv_data["id"]
    assert inv_data["recipientUserFound"] == True, "Expected recipientUserFound to be True for Bob"
    assert "token" in inv_data and len(inv_data["token"]) > 20
    print(f"[PASS] 3. Alice invited Bob via email (Token: {bob_invite_token[:10]}..., recipientFound: True)")

    # 4. Check Bob's Notifications API
    r = requests.get(f"{BASE_URL}/notifications", headers=bob_headers)
    assert r.status_code == 200, f"Bob notifications failed: {r.text}"
    bob_notifs = r.json()
    assert bob_notifs["unreadCount"] == 1, f"Expected 1 unread notif for Bob, got {bob_notifs['unreadCount']}"
    assert len(bob_notifs["items"]) == 1
    bob_notif = bob_notifs["items"][0]
    assert bob_notif["type"] == "COLLABORATION_INVITATION"
    assert bob_notif["senderName"] == "Alice Architect"
    assert f"/invite/{bob_invite_token}" == bob_notif["actionUrl"]
    assert bob_notif["isRead"] == False
    print(f"[PASS] 4. Bob received in-app notification: '{bob_notif['title']}' with actionUrl: {bob_notif['actionUrl']}")

    # 5. Check User Isolation on Notifications
    # Charlie must have 0 notifications
    r = requests.get(f"{BASE_URL}/notifications", headers=charlie_headers)
    assert r.status_code == 200
    assert r.json()["unreadCount"] == 0 and len(r.json()["items"]) == 0
    # Alice must have 0 notifications
    r = requests.get(f"{BASE_URL}/notifications", headers=alice_headers)
    assert r.status_code == 200
    assert r.json()["unreadCount"] == 0 and len(r.json()["items"]) == 0
    print("[PASS] 5. Notification isolation verified (Charlie & Alice have 0 notifications)")

    # 6. Bob marks notification as read
    notif_id = bob_notif["id"]
    r = requests.patch(f"{BASE_URL}/notifications/{notif_id}/read", headers=bob_headers)
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/notifications", headers=bob_headers)
    assert r.json()["unreadCount"] == 0
    assert r.json()["items"][0]["isRead"] == True
    print("[PASS] 6. Bob marked notification as read (unreadCount now 0)")

    # 7. Bob accepts the invitation
    r = requests.post(f"{BASE_URL}/invitations/{bob_invite_token}/accept", headers=bob_headers)
    assert r.status_code == 200, f"Bob accept failed: {r.text}"
    accept_res = r.json()
    assert accept_res["success"] == True
    assert accept_res["role"] == "Editor"
    print(f"[PASS] 7. Bob accepted invitation successfully as {accept_res['role']}")

    # 8. Check Alice's notifications — Alice should receive "Invitation Accepted" notification!
    r = requests.get(f"{BASE_URL}/notifications", headers=alice_headers)
    assert r.status_code == 200
    alice_notifs = r.json()
    assert alice_notifs["unreadCount"] == 1
    alice_notif = alice_notifs["items"][0]
    assert alice_notif["type"] == "INVITATION_ACCEPTED"
    assert alice_notif["senderName"] == "Bob Builder"
    print(f"[PASS] 8. Alice received notification that Bob accepted: '{alice_notif['message']}'")

    # 9. Verify prompt appears under Bob's shared prompts
    r = requests.get(f"{BASE_URL}/prompts/{prompt_id}", headers=bob_headers)
    assert r.status_code == 200, f"Bob could not access shared prompt: {r.text}"
    p_data = r.json()
    assert p_data["isOwner"] == False
    assert p_data["userRole"] == "Editor"
    print(f"[PASS] 9. Prompt is accessible to Bob with isOwner=False and userRole=Editor")

    # 10. Test Resend Invitation Flow
    # Alice sends an invitation to Charlie
    r = requests.post(f"{BASE_URL}/collaboration/invitations", headers=alice_headers, json={
        "email": charlie_email,
        "name": "Charlie Reviewer",
        "role": "Viewer",
        "scope": "prompt",
        "promptId": prompt_id,
        "expiresInDays": 7
    })
    assert r.status_code == 201
    charlie_inv_id = r.json()["id"]
    charlie_token_val = r.json()["token"]

    # Charlie has 1 notif
    r = requests.get(f"{BASE_URL}/notifications", headers=charlie_headers)
    assert r.json()["unreadCount"] == 1

    # Alice resends the invitation
    r = requests.post(f"{BASE_URL}/collaboration/invitations/{charlie_inv_id}/resend", headers=alice_headers)
    assert r.status_code == 200, f"Resend failed: {r.text}"
    assert r.json()["success"] == True
    print("[PASS] 10. Alice successfully triggered [ Resend ] on Charlie's pending invitation")

    # 11. Test Decline Flow
    # Charlie declines the invitation
    r = requests.post(f"{BASE_URL}/invitations/{charlie_token_val}/decline", headers=charlie_headers)
    assert r.status_code == 200, f"Decline failed: {r.text}"
    assert r.json()["success"] == True

    # Now trying to accept after decline should fail
    r = requests.post(f"{BASE_URL}/invitations/{charlie_token_val}/accept", headers=charlie_headers)
    assert r.status_code == 400, "Expected 400 when accepting a declined/revoked invite"
    print("[PASS] 11. Charlie declined invitation; subsequent accept rejected with 400")

    # 12. Test Email Service HTML Builder and Diagnostic Config
    from app.services.email_service import build_invitation_html, verify_email_configuration
    html = build_invitation_html(
        inviter_name="Alice Architect",
        prompt_name="Quantum AI Orchestrator",
        role="Editor",
        invitation_url=f"http://localhost:5173/invite/{bob_invite_token}",
        expiration_str="7 days"
    )
    assert "PROMPTCOMMIT" in html
    assert "Alice Architect" in html
    assert "Quantum AI Orchestrator" in html
    assert "ACCEPT INVITATION" in html
    assert f"http://localhost:5173/invite/{bob_invite_token}" in html

    cfg = verify_email_configuration()
    assert cfg["provider"] == "resend"
    print(f"[PASS] 12. Email HTML template generation & config check verified (Provider: {cfg['provider']})")

    print("\nALL 12 REAL INVITATION & NOTIFICATION INTEGRATION TESTS PASSED PERFECTLY!\n")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[FAIL] Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
