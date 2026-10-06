import time
import uuid
import requests

BASE_URL = "http://localhost:8000/api"

def test_collaboration_full_lifecycle():
    ts = int(time.time())
    suffix = uuid.uuid4().hex[:6]

    user_a_email = f"owner_{ts}_{suffix}@promptcommit.dev"
    aanshi_email = f"aanshi_{ts}_{suffix}@promptcommit.dev"
    abhimanyu_email = f"abhimanyu_{ts}_{suffix}@promptcommit.dev"

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

    user_a_token, user_a = register(user_a_email, f"usera_{ts}_{suffix}", "Dhruvi Khatri")
    aanshi_token, aanshi = register(aanshi_email, f"aanshi_{ts}_{suffix}", "Aanshi Shah")
    abhimanyu_token, abhimanyu = register(abhimanyu_email, f"abhimanyu_{ts}_{suffix}", "Abhimanyu")

    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    headers_aanshi = {"Authorization": f"Bearer {aanshi_token}"}
    headers_abhimanyu = {"Authorization": f"Bearer {abhimanyu_token}"}

    # =========================================================================
    # PART 30: MULTI-PROMPT CREATION & INVITATIONS
    # User A (Owner) creates 4 prompts:
    # 1. UI Design Generator
    # 2. Dashboard UI
    # 3. React Code Generator
    # 4. Python Code Reviewer
    # =========================================================================
    def create_prompt(title, category, content):
        res = requests.post(f"{BASE_URL}/prompts", headers=headers_a, json={
            "title": title,
            "description": f"Description for {title}",
            "category": category,
            "content": content,
            "targetModel": "gemini-3.6-flash",
            "tags": ["design", "code"]
        })
        assert res.status_code in [200, 201]
        return res.json()

    p1 = create_prompt("UI Design Generator", "UI/UX", "Generate responsive UI layout tokens.")
    p2 = create_prompt("Dashboard UI", "UI/UX", "Create analytics dashboard interface components.")
    p3 = create_prompt("React Code Generator", "Coding", "Write modular React components with hooks.")
    p4 = create_prompt("Python Code Reviewer", "Coding", "Review Python code for PEP8 and type safety.")

    # Invite Aanshi:
    # Prompt 1 -> Reviewer
    # Prompt 2 -> Editor
    r1 = requests.post(f"{BASE_URL}/collaboration/invitations", headers=headers_a, json={
        "email": aanshi_email,
        "name": "Aanshi Shah",
        "role": "Reviewer",
        "scope": "prompt",
        "promptId": p1["id"],
        "expiresInDays": 7
    })
    assert r1.status_code in [200, 201]
    inv_aanshi_1 = r1.json()

    r2 = requests.post(f"{BASE_URL}/collaboration/invitations", headers=headers_a, json={
        "email": aanshi_email,
        "name": "Aanshi Shah",
        "role": "Editor",
        "scope": "prompt",
        "promptId": p2["id"],
        "expiresInDays": 7
    })
    assert r2.status_code in [200, 201]
    inv_aanshi_2 = r2.json()

    # Invite Abhimanyu:
    # Prompt 3 -> Editor
    # Prompt 4 -> Reviewer
    r3 = requests.post(f"{BASE_URL}/collaboration/invitations", headers=headers_a, json={
        "email": abhimanyu_email,
        "name": "Abhimanyu",
        "role": "Editor",
        "scope": "prompt",
        "promptId": p3["id"],
        "expiresInDays": 7
    })
    assert r3.status_code in [200, 201]
    inv_abhimanyu_1 = r3.json()

    r4 = requests.post(f"{BASE_URL}/collaboration/invitations", headers=headers_a, json={
        "email": abhimanyu_email,
        "name": "Abhimanyu",
        "role": "Reviewer",
        "scope": "prompt",
        "promptId": p4["id"],
        "expiresInDays": 7
    })
    assert r4.status_code in [200, 201]
    inv_abhimanyu_2 = r4.json()

    # Verify Owner overview before acceptance: 4 Pending Invitations
    ov = requests.get(f"{BASE_URL}/collaboration/overview", headers=headers_a).json()
    assert ov["pendingInvitesCount"] == 4

    # =========================================================================
    # PART 31: ACCEPT INVITATIONS TEST & STATE FIX
    # Aanshi accepts both invitations, Abhimanyu accepts both invitations
    # =========================================================================
    res = requests.post(f"{BASE_URL}/invitations/{inv_aanshi_1['token']}/accept", headers=headers_aanshi)
    assert res.status_code == 200
    assert res.json()["success"] is True

    res = requests.post(f"{BASE_URL}/invitations/{inv_aanshi_2['token']}/accept", headers=headers_aanshi)
    assert res.status_code == 200

    res = requests.post(f"{BASE_URL}/invitations/{inv_abhimanyu_1['token']}/accept", headers=headers_abhimanyu)
    assert res.status_code == 200

    res = requests.post(f"{BASE_URL}/invitations/{inv_abhimanyu_2['token']}/accept", headers=headers_abhimanyu)
    assert res.status_code == 200

    # Verify Owner Pending Invitations decreased to 0
    ov_after = requests.get(f"{BASE_URL}/collaboration/overview", headers=headers_a).json()
    assert ov_after["pendingInvitesCount"] == 0

    # Accepted invitations are no longer returned as pending
    owner_invs = requests.get(f"{BASE_URL}/collaboration/invitations", headers=headers_a).json()
    pending_only = [i for i in owner_invs if i["status"] == "Pending"]
    assert len(pending_only) == 0

    # =========================================================================
    # MULTI-PROMPT VISIBILITY VERIFICATION
    # =========================================================================
    members = requests.get(f"{BASE_URL}/collaboration/members", headers=headers_a).json()
    # 1 Owner + 2 Collaborators = 3 members
    assert len(members) == 3

    aanshi_member = next((m for m in members if m["email"].lower() == aanshi_email.lower()), None)
    assert aanshi_member is not None
    assert len(aanshi_member["sharedPrompts"]) == 2
    aanshi_prompt_ids = {p["promptId"] for p in aanshi_member["sharedPrompts"]}
    assert aanshi_prompt_ids == {p1["id"], p2["id"]}

    abhimanyu_member = next((m for m in members if m["email"].lower() == abhimanyu_email.lower()), None)
    assert abhimanyu_member is not None
    assert len(abhimanyu_member["sharedPrompts"]) == 2
    abhimanyu_prompt_ids = {p["promptId"] for p in abhimanyu_member["sharedPrompts"]}
    assert abhimanyu_prompt_ids == {p3["id"], p4["id"]}

    # Security / Data Isolation Check:
    # Aanshi cannot access Prompt 3 or Prompt 4
    r = requests.get(f"{BASE_URL}/prompts/{p3['id']}", headers=headers_aanshi)
    assert r.status_code == 404
    r = requests.get(f"{BASE_URL}/prompts/{p4['id']}", headers=headers_aanshi)
    assert r.status_code == 404

    # Abhimanyu cannot access Prompt 1 or Prompt 2
    r = requests.get(f"{BASE_URL}/prompts/{p1['id']}", headers=headers_abhimanyu)
    assert r.status_code == 404
    r = requests.get(f"{BASE_URL}/prompts/{p2['id']}", headers=headers_abhimanyu)
    assert r.status_code == 404

    # Shared With Me counts
    aanshi_prompts = requests.get(f"{BASE_URL}/prompts?scope=shared", headers=headers_aanshi).json()
    assert len(aanshi_prompts) == 2

    # =========================================================================
    # PART 32: COMMENT TEST
    # =========================================================================
    # Aanshi adds comment to Prompt 1
    c1_res = requests.post(f"{BASE_URL}/prompts/{p1['id']}/comments", headers=headers_aanshi, json={
        "content": "The responsive breakpoint requirements need clarification.",
        "version_tag": "v1.0"
    })
    assert c1_res.status_code in [200, 201]
    c1 = c1_res.json()
    assert c1["content"] == "The responsive breakpoint requirements need clarification."
    assert c1["userName"] == "Aanshi Shah"

    # Owner views comments and replies
    c2_res = requests.post(f"{BASE_URL}/prompts/{p1['id']}/comments", headers=headers_a, json={
        "content": "I'll update v2.1.",
        "version_tag": "v1.0"
    })
    assert c2_res.status_code in [200, 201]

    # Verify both comments appear
    all_comments = requests.get(f"{BASE_URL}/prompts/{p1['id']}/comments", headers=headers_aanshi).json()
    assert len(all_comments) == 2

    # Test like comment
    like_res = requests.post(f"{BASE_URL}/prompts/{p1['id']}/comments/{c1['id']}/like", headers=headers_a)
    assert like_res.status_code == 200
    assert like_res.json()["likesCount"] == 1

    # =========================================================================
    # PART 33: REVIEW WORKFLOW TEST
    # =========================================================================
    # Owner creates version v2.1
    v_res = requests.post(f"{BASE_URL}/prompts/{p1['id']}/versions", headers=headers_a, json={
        "version_number": "v2.1",
        "commit_message": "Added breakpoint specifications",
        "content": "Generate responsive UI layout tokens with explicit breakpoints.",
        "description": "v2.1 responsive update",
        "diff_notes": "+ Added tablet and mobile breakpoints"
    })
    assert v_res.status_code in [200, 201]
    new_version_tag = "v2.1"

    # Owner requests review from Aanshi on this version
    req_res = requests.post(f"{BASE_URL}/prompts/{p1['id']}/versions/{new_version_tag}/review/request", headers=headers_a, json={
        "reviewer_email": aanshi_email,
        "message": "Please check the responsive UI constraints."
    })
    assert req_res.status_code == 200
    assert req_res.json()["reviewStatus"] == "IN_REVIEW"

    # Aanshi checks status and requests changes
    chg_res = requests.post(f"{BASE_URL}/prompts/{p1['id']}/versions/{new_version_tag}/review/action", headers=headers_aanshi, json={
        "action": "request_changes",
        "feedback": "Please specify tablet breakpoint behavior."
    })
    assert chg_res.status_code == 200
    assert chg_res.json()["reviewStatus"] == "CHANGES_REQUESTED"

    # Owner requests review again
    requests.post(f"{BASE_URL}/prompts/{p1['id']}/versions/{new_version_tag}/review/request", headers=headers_a, json={
        "reviewer_email": aanshi_email,
        "message": "Updated with tablet breakpoints. Please re-review."
    })

    # Aanshi approves
    app_res = requests.post(f"{BASE_URL}/prompts/{p1['id']}/versions/{new_version_tag}/review/action", headers=headers_aanshi, json={
        "action": "approve",
        "feedback": "Approved! Breakpoints look clean."
    })
    assert app_res.status_code == 200
    assert app_res.json()["reviewStatus"] == "APPROVED"

    # Verify status persists on prompt
    p1_check = requests.get(f"{BASE_URL}/prompts/{p1['id']}", headers=headers_a).json()
    assert p1_check["reviewStatus"] == "APPROVED"

    # =========================================================================
    # PART 34: REVOCATION TEST
    # Owner revokes Aanshi's access to Prompt 2
    # =========================================================================
    del_res = requests.delete(f"{BASE_URL}/collaboration/members/{aanshi_email}/prompts/{p2['id']}", headers=headers_a)
    assert del_res.status_code == 200

    # Verify Prompt 2 disappears from Aanshi's Shared With Me
    aanshi_after_prompts = requests.get(f"{BASE_URL}/prompts?scope=shared", headers=headers_aanshi).json()
    aanshi_prompt_ids_after = [p["id"] for p in aanshi_after_prompts]
    assert p2["id"] not in aanshi_prompt_ids_after
    assert p1["id"] in aanshi_prompt_ids_after

    # Direct access to Prompt 2 by Aanshi returns 404
    r_direct = requests.get(f"{BASE_URL}/prompts/{p2['id']}", headers=headers_aanshi)
    assert r_direct.status_code == 404

    # Prompt 2 remains visible to Owner
    p2_owner = requests.get(f"{BASE_URL}/prompts/{p2['id']}", headers=headers_a)
    assert p2_owner.status_code == 200

    # Activity Feed Check
    act_res = requests.get(f"{BASE_URL}/collaboration/activity", headers=headers_a)
    assert act_res.status_code == 200
    activities = act_res.json()
    assert len(activities) > 0
