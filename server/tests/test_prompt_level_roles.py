import time
import uuid
import pytest
import requests

BASE_URL = "http://localhost:8000/api"

def test_prompt_level_roles_independence():
    ts = int(time.time())
    suffix = uuid.uuid4().hex[:6]

    owner_email = f"owner_{ts}_{suffix}@promptcommit.dev"
    aanshi_email = f"aanshi_{ts}_{suffix}@promptcommit.dev"

    def register(email, username, name):
        r = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": email,
            "username": username,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "name": name
        })
        assert r.status_code in [200, 201], f"Signup failed for {email}: {r.text}"
        data = r.json()
        token = data.get("access_token") or data.get("token")
        return token, data.get("user")

    owner_token, owner = register(owner_email, f"owner_{ts}_{suffix}", "Dhruvi Khatri")
    aanshi_token, aanshi = register(aanshi_email, f"aanshi_{ts}_{suffix}", "Aanshi Shah")

    headers_owner = {"Authorization": f"Bearer {owner_token}"}
    headers_aanshi = {"Authorization": f"Bearer {aanshi_token}"}

    # 1. Owner creates 2 prompts: Prompt A (UI Dashboard) and Prompt B (Codebase Refactoring)
    r_p1 = requests.post(f"{BASE_URL}/prompts", headers=headers_owner, json={
        "title": f"UI Dashboard System Prompt {suffix}",
        "description": "Frontend styling guidelines",
        "category": "Frontend",
        "content": "You are a Frontend UI Engineer."
    })
    assert r_p1.status_code in [200, 201], f"Create p1 failed: {r_p1.text}"
    p1 = r_p1.json()

    r_p2 = requests.post(f"{BASE_URL}/prompts", headers=headers_owner, json={
        "title": f"Codebase Refactoring Engine {suffix}",
        "description": "Architecture refactoring",
        "category": "Architecture",
        "content": "You are a Staff Architect."
    })
    assert r_p2.status_code in [200, 201], f"Create p2 failed: {r_p2.text}"
    p2 = r_p2.json()

    # 2. Owner invites Aanshi to Prompt A as Reviewer
    r_inv1 = requests.post(f"{BASE_URL}/collaboration/invitations", headers=headers_owner, json={
        "email": aanshi_email,
        "role": "Reviewer",
        "scope": "prompt",
        "promptId": p1["id"],
        "expiresInDays": 7
    })
    assert r_inv1.status_code in [200, 201], f"Invite 1 failed: {r_inv1.text}"
    inv1_token = r_inv1.json()["token"]

    # 3. Owner invites Aanshi to Prompt B as Editor
    r_inv2 = requests.post(f"{BASE_URL}/collaboration/invitations", headers=headers_owner, json={
        "email": aanshi_email,
        "role": "Editor",
        "scope": "prompt",
        "promptId": p2["id"],
        "expiresInDays": 7
    })
    assert r_inv2.status_code in [200, 201], f"Invite 2 failed: {r_inv2.text}"
    inv2_token = r_inv2.json()["token"]

    # 4. Aanshi accepts both invitations
    r_acc1 = requests.post(f"{BASE_URL}/invitations/{inv1_token}/accept", headers=headers_aanshi)
    assert r_acc1.status_code == 200, f"Accept inv1 failed: {r_acc1.text}"

    r_acc2 = requests.post(f"{BASE_URL}/invitations/{inv2_token}/accept", headers=headers_aanshi)
    assert r_acc2.status_code == 200, f"Accept inv2 failed: {r_acc2.text}"

    # 5. Owner checks GET /api/collaboration/members
    r_members = requests.get(f"{BASE_URL}/collaboration/members", headers=headers_owner)
    assert r_members.status_code == 200
    members = r_members.json()

    aanshi_member = next((m for m in members if m["email"].lower() == aanshi_email.lower()), None)
    assert aanshi_member is not None, "Aanshi not found in members list"
    assert aanshi_member["promptsCount"] == 2
    assert len(aanshi_member["sharedPrompts"]) == 2

    sp_p1 = next((sp for sp in aanshi_member["sharedPrompts"] if sp["promptId"] == p1["id"]), None)
    sp_p2 = next((sp for sp in aanshi_member["sharedPrompts"] if sp["promptId"] == p2["id"]), None)

    assert sp_p1 is not None and sp_p1["role"] == "Reviewer", f"Expected Reviewer on p1, got {sp_p1}"
    assert sp_p2 is not None and sp_p2["role"] == "Editor", f"Expected Editor on p2, got {sp_p2}"

    # 6. Change Aanshi's role on Prompt A to Viewer
    r_up = requests.put(
        f"{BASE_URL}/collaboration/members/{aanshi_email}/prompts/{p1['id']}/role",
        headers=headers_owner,
        json={"role": "Viewer"}
    )
    assert r_up.status_code == 200, f"Update prompt role failed: {r_up.text}"

    # 7. Verify independence: Prompt A is Viewer, Prompt B remains Editor
    r_members2 = requests.get(f"{BASE_URL}/collaboration/members", headers=headers_owner)
    assert r_members2.status_code == 200
    members2 = r_members2.json()
    aanshi_member2 = next((m for m in members2 if m["email"].lower() == aanshi_email.lower()), None)

    sp_p1_after = next((sp for sp in aanshi_member2["sharedPrompts"] if sp["promptId"] == p1["id"]), None)
    sp_p2_after = next((sp for sp in aanshi_member2["sharedPrompts"] if sp["promptId"] == p2["id"]), None)

    assert sp_p1_after["role"] == "Viewer", f"Prompt 1 should now be Viewer, got {sp_p1_after['role']}"
    assert sp_p2_after["role"] == "Editor", f"Prompt 2 must remain Editor, got {sp_p2_after['role']}"

    # 8. Revoke access to Prompt A
    r_del = requests.delete(
        f"{BASE_URL}/collaboration/members/{aanshi_email}/prompts/{p1['id']}",
        headers=headers_owner
    )
    assert r_del.status_code == 200

    # 9. Verify only Prompt B remains with role Editor
    r_members3 = requests.get(f"{BASE_URL}/collaboration/members", headers=headers_owner)
    members3 = r_members3.json()
    aanshi_member3 = next((m for m in members3 if m["email"].lower() == aanshi_email.lower()), None)
    assert aanshi_member3["promptsCount"] == 1
    assert len(aanshi_member3["sharedPrompts"]) == 1
    assert aanshi_member3["sharedPrompts"][0]["promptId"] == p2["id"]
    assert aanshi_member3["sharedPrompts"][0]["role"] == "Editor"
