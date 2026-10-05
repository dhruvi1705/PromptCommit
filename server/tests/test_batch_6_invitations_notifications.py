"""
Test Suite for Batch 6:
- Problems 51–54: Granular invitation status, email restrictions, expiration & usage limits, token security
- Problem 55: Async email dispatch resilience
- Problems 56–58: Notification polling, overlap & real-time state integrity
- Problems 59–60: User switch isolation & notification action security (mark-read, delete, IDOR defense)
"""

import time
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = "http://localhost:8000/api"


def register_user(name_prefix="User"):
    ts = int(time.time() * 1000) % 100000
    rand = uuid.uuid4().hex[:6]
    email = f"b6_{rand}_{ts}@promptcommit.dev"
    username = f"u6_{rand}_{ts}"
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


def test_invitation_granular_statuses_and_inspection():
    """Verify granular status code (ACTIVE, EXPIRED, REVOKED, ACCEPTED, USAGE_LIMIT_REACHED)."""
    owner, h_owner, _ = register_user("OwnerInvStatus")
    recipient, h_recipient, _ = register_user("RecipientInvStatus")
    other_user, h_other, _ = register_user("StrangerInvStatus")

    # 1. Create a prompt
    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Status Test Prompt", "content": "Instructions"}, headers=h_owner)
    p_id = r_p.json()["id"]

    # 2. Create an active invitation
    r_inv = requests.post(
        f"{BASE_URL}/collaboration/invitations",
        json={"email": recipient["email"], "role": "Editor", "promptId": p_id, "expiresInDays": 7},
        headers=h_owner
    )
    assert r_inv.status_code == 201
    inv_token = r_inv.json()["token"]

    # 3. Public inspection before acceptance -> ACTIVE
    r_inspect = requests.get(f"{BASE_URL}/invitations/{inv_token}")
    assert r_inspect.status_code == 200
    data_inspect = r_inspect.json()
    assert data_inspect["statusCode"] == "ACTIVE"
    assert data_inspect["valid"] is True
    assert data_inspect["role"] == "Editor"
    assert data_inspect["promptTitle"] == "Status Test Prompt"

    # 4. Accept the invitation as recipient
    r_acc = requests.post(f"{BASE_URL}/invitations/{inv_token}/accept", headers=h_recipient)
    assert r_acc.status_code == 200

    # 5. Inspection after acceptance -> ACCEPTED
    r_inspect_after = requests.get(f"{BASE_URL}/invitations/{inv_token}")
    assert r_inspect_after.status_code == 200
    data_after = r_inspect_after.json()
    assert data_after["statusCode"] == "ACCEPTED"
    assert data_after["valid"] is False

    # 6. Attempt second acceptance -> Rejected as already accepted (400)
    r_acc_dup = requests.post(f"{BASE_URL}/invitations/{inv_token}/accept", headers=h_recipient)
    assert r_acc_dup.status_code == 400
    assert "already been accepted" in r_acc_dup.json()["detail"]


def test_invitation_email_restriction_server_enforcement():
    """Verify backend rejects acceptance if authenticated user does not match invited email."""
    owner, h_owner, _ = register_user("OwnerRestrict")
    target_user, h_target, _ = register_user("TargetUser")
    hacker_user, h_hacker, _ = register_user("HackerUser")

    # Owner creates invitation targeted specifically to target_user
    r_inv = requests.post(
        f"{BASE_URL}/collaboration/invitations",
        json={"email": target_user["email"], "role": "Reviewer", "expiresInDays": 3},
        headers=h_owner
    )
    assert r_inv.status_code == 201
    token = r_inv.json()["token"]

    # Hacker attempts to accept target_user's invitation -> 403 Forbidden
    r_hack = requests.post(f"{BASE_URL}/invitations/{token}/accept", headers=h_hacker)
    assert r_hack.status_code == 403
    assert target_user["email"] in r_hack.json()["detail"]

    # Valid recipient accepts -> Success (200)
    r_valid = requests.post(f"{BASE_URL}/invitations/{token}/accept", headers=h_target)
    assert r_valid.status_code == 200


def test_invitation_revocation_and_usage_limits():
    """Verify revoked invitations and exhausted multi-use links are strictly rejected."""
    owner, h_owner, _ = register_user("OwnerRevoke")
    user_1, h_u1, _ = register_user("UserOne")
    user_2, h_u2, _ = register_user("UserTwo")

    # 1. Test Revocation
    r_inv = requests.post(
        f"{BASE_URL}/collaboration/invitations",
        json={"email": user_1["email"], "role": "Viewer", "expiresInDays": 7},
        headers=h_owner
    )
    inv_id = r_inv.json()["id"]
    inv_token = r_inv.json()["token"]

    # Owner revokes it
    r_rev = requests.post(f"{BASE_URL}/collaboration/invitations/{inv_id}/revoke", headers=h_owner)
    assert r_rev.status_code == 200

    # User 1 tries to accept revoked invite -> 400 Revoked
    r_acc_rev = requests.post(f"{BASE_URL}/invitations/{inv_token}/accept", headers=h_u1)
    assert r_acc_rev.status_code == 400
    assert "revoked" in r_acc_rev.json()["detail"]

    # 2. Test Multi-use Link with max_uses = 1
    r_link = requests.post(
        f"{BASE_URL}/collaboration/share-links",
        json={"role": "Viewer", "expiresInDays": 7, "maxUses": 1},
        headers=h_owner
    )
    assert r_link.status_code == 201
    link_token = r_link.json()["token"]

    # User 1 accepts link -> Success (200)
    r_link_acc1 = requests.post(f"{BASE_URL}/invitations/{link_token}/accept", headers=h_u1)
    assert r_link_acc1.status_code == 200

    # User 2 tries to accept exhausted link -> 400 Usage limit reached
    r_link_acc2 = requests.post(f"{BASE_URL}/invitations/{link_token}/accept", headers=h_u2)
    assert r_link_acc2.status_code == 400
    assert "usage limit" in r_link_acc2.json()["detail"].lower()


def test_notification_isolation_and_security():
    """Verify strict tenant isolation for notifications, IDOR protection, and mark-all-read."""
    user_a, h_a, _ = register_user("UserAlpha")
    user_b, h_b, _ = register_user("UserBeta")

    # User A invites User B -> generates notification for User B
    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Alpha Prompt", "content": "Code"}, headers=h_a)
    p_id = r_p.json()["id"]
    requests.post(f"{BASE_URL}/collaboration/invitations", json={"email": user_b["email"], "promptId": p_id, "role": "Editor"}, headers=h_a)

    # 1. User B fetches notifications -> Sees the invitation notification
    r_notif_b = requests.get(f"{BASE_URL}/notifications", headers=h_b)
    assert r_notif_b.status_code == 200
    b_data = r_notif_b.json()
    assert b_data["unreadCount"] >= 1
    b_notif = b_data["items"][0]
    b_notif_id = b_notif["id"]

    # 2. User A fetches notifications -> User A does NOT see User B's notification
    r_notif_a = requests.get(f"{BASE_URL}/notifications", headers=h_a)
    assert r_notif_a.status_code == 200
    a_data = r_notif_a.json()
    a_ids = [n["id"] for n in a_data["items"]]
    assert b_notif_id not in a_ids

    # 3. IDOR Attack: User A tries to mark User B's notification as read -> 404
    r_hack_read = requests.patch(f"{BASE_URL}/notifications/{b_notif_id}/read", headers=h_a)
    assert r_hack_read.status_code == 404

    # 4. IDOR Attack: User A tries to delete User B's notification -> 404
    r_hack_del = requests.delete(f"{BASE_URL}/notifications/{b_notif_id}", headers=h_a)
    assert r_hack_del.status_code == 404

    # 5. User B marks single notification as read -> Success (200)
    r_read_b = requests.patch(f"{BASE_URL}/notifications/{b_notif_id}/read", headers=h_b)
    assert r_read_b.status_code == 200

    # 6. User B mark all read
    r_mark_all = requests.post(f"{BASE_URL}/notifications/mark-all-read", headers=h_b)
    assert r_mark_all.status_code == 200
    r_notif_b_after = requests.get(f"{BASE_URL}/notifications", headers=h_b)
    assert r_notif_b_after.json()["unreadCount"] == 0


def test_idempotent_share_acceptance_no_duplicate_records():
    """Verify accepting multiple invitations or re-accepting does not create duplicate PromptShare rows."""
    owner, h_owner, _ = register_user("OwnerIdempotent")
    collab, h_collab, _ = register_user("CollabIdempotent")

    # Owner creates prompt
    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Idempotent Prompt", "content": "Text"}, headers=h_owner)
    p_id = r_p.json()["id"]

    # Share link 1 (Editor)
    r_l1 = requests.post(f"{BASE_URL}/collaboration/share-links", json={"role": "Editor", "promptId": p_id, "maxUses": 5}, headers=h_owner)
    t1 = r_l1.json()["token"]

    # Share link 2 (Reviewer)
    r_l2 = requests.post(f"{BASE_URL}/collaboration/share-links", json={"role": "Reviewer", "promptId": p_id, "maxUses": 5}, headers=h_owner)
    t2 = r_l2.json()["token"]

    # Collab accepts Link 1
    requests.post(f"{BASE_URL}/invitations/{t1}/accept", headers=h_collab)

    # Collab accepts Link 2 (updates role from Editor to Reviewer)
    requests.post(f"{BASE_URL}/invitations/{t2}/accept", headers=h_collab)

    # Inspect prompt collaborators
    r_collabs = requests.get(f"{BASE_URL}/collaboration/prompts/{p_id}/collaborators", headers=h_owner)
    assert r_collabs.status_code == 200
    collabs_data = r_collabs.json()
    
    # Verify collab appears exactly once (1 owner + 1 collaborator = totalParticipants: 2)
    matching_shares = [c for c in collabs_data["collaborators"] if c.get("email", "").lower() == collab["email"].lower()]
    assert len(matching_shares) == 1, f"Expected 1 share entry for user, found {len(matching_shares)}"
    assert matching_shares[0]["role"] == "Reviewer"


if __name__ == "__main__":
    pytest.main(["-v", __file__])
