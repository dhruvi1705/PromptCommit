import requests
import sys

sys.stdout.reconfigure(line_buffering=True)

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=== Testing Production-Grade Collaboration System ===")
    
    # 1. Login Alice & Bob & Charlie
    import time
    ts = int(time.time())
    alice_email = f"alice_{ts}@promptcommit.dev"
    bob_email = f"bob_{ts}@promptcommit.dev"
    charlie_email = f"charlie_{ts}@promptcommit.dev"
    
    def register_user(email, username, name):
        r = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": email,
            "username": username,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "name": name
        })
        assert r.status_code in [200, 201], f"Signup failed for {email}: ({r.status_code}) {r.text}"
        data = r.json()
        token = data.get("access_token") or data.get("token")
        return token, data.get("user")

    alice_token, alice_user = register_user(alice_email, f"alice_{ts}", "Alice Architect")
    bob_token, bob_user = register_user(bob_email, f"bob_{ts}", "Bob Builder")
    charlie_token, charlie_user = register_user(charlie_email, f"charlie_{ts}", "Charlie Coder")

    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    print("[PASS] Created 3 isolated test users (Alice, Bob, Charlie)")

    # 2. Alice creates a prompt
    r = requests.post(f"{BASE_URL}/prompts", headers=alice_headers, json={
        "title": "Production System Prompt v1",
        "description": "Enterprise grade AI instruction system",
        "category": "Coding",
        "content": "You are an expert full-stack engineer. Always write clean code.",
        "targetModel": "Mistral Small",
        "tags": ["prod", "system"]
    })
    assert r.status_code in [200, 201], f"Failed to create prompt: ({r.status_code}) {r.text}"
    alice_prompt = r.json()
    prompt_id = alice_prompt["id"]
    print(f"[PASS] Alice created prompt ID: {prompt_id}")

    # 3. Alice creates targeted email invite for Bob as Editor
    r = requests.post(f"{BASE_URL}/collaboration/invitations", headers=alice_headers, json={
        "email": bob_email,
        "name": "Bob Builder",
        "role": "Editor",
        "scope": "prompt",
        "promptId": prompt_id,
        "expiresInDays": 7
    })
    assert r.status_code in [200, 201], f"Failed to create email invite: ({r.status_code}) {r.text}"
    bob_invite = r.json()
    bob_token_str = bob_invite["token"]
    print(f"[PASS] Alice created targeted email invite for Bob (token: {bob_token_str[:12]}...)")

    # 4. Public inspection of invite token
    r = requests.get(f"{BASE_URL}/invitations/{bob_token_str}")
    assert r.status_code == 200, f"Failed to inspect invite: {r.text}"
    inspect_data = r.json()
    assert inspect_data["valid"] is True
    assert inspect_data["invitedEmail"] == bob_email
    assert inspect_data["role"] == "Editor"
    print(f"[PASS] Public invite inspection succeeded for token")

    # 5. Charlie tries to accept Bob's targeted invite (must fail 403 email mismatch)
    r = requests.post(f"{BASE_URL}/invitations/{bob_token_str}/accept", headers=charlie_headers)
    assert r.status_code == 403, f"Expected 403 for email mismatch, got: {r.status_code} {r.text}"
    print(f"[PASS] Charlie correctly rejected with 403 on Bob's targeted email invite")

    # 6. Bob accepts targeted invite
    r = requests.post(f"{BASE_URL}/invitations/{bob_token_str}/accept", headers=bob_headers)
    assert r.status_code == 200, f"Bob failed to accept invite: {r.text}"
    print(f"[PASS] Bob accepted email invite successfully")

    # 7. Bob checks /api/prompts to see shared prompt
    r = requests.get(f"{BASE_URL}/prompts", headers=bob_headers)
    assert r.status_code == 200
    bob_prompts = r.json()
    shared_found = next((p for p in bob_prompts if p["id"] == prompt_id), None)
    assert shared_found is not None, "Shared prompt not found in Bob's prompts list"
    assert shared_found["isOwner"] is False, "Expected isOwner=False"
    assert shared_found["userRole"] == "Editor", f"Expected userRole=Editor, got {shared_found['userRole']}"
    print(f"[PASS] Bob correctly sees Alice's prompt with isOwner=False and userRole=Editor")

    # 8. Bob (Editor) creates version commit on Alice's prompt
    r = requests.post(f"{BASE_URL}/prompts/{prompt_id}/versions", headers=bob_headers, json={
        "commit_message": "Added strict type validation guidelines",
        "description": "Collaborator iteration by Bob",
        "content": "You are an expert full-stack engineer. Always write clean, strictly typed code.",
        "diff_notes": "Added type guidelines"
    })
    assert r.status_code in [200, 201], f"Bob failed to create version: ({r.status_code}) {r.text}"
    print(f"[PASS] Bob (Editor) successfully committed a new version on Alice's prompt")

    # 9. Alice creates shareable link for entire workspace (role: Viewer, maxUses: 2)
    r = requests.post(f"{BASE_URL}/collaboration/share-links", headers=alice_headers, json={
        "role": "Viewer",
        "scope": "workspace",
        "expiresInDays": 30,
        "maxUses": 2
    })
    assert r.status_code in [200, 201], f"Failed to create share link: ({r.status_code}) {r.text}"
    share_link = r.json()
    link_token = share_link["token"]
    print(f"[PASS] Alice created multi-use workspace share link (token: {link_token[:12]}...)")

    # 10. Charlie accepts share link
    r = requests.post(f"{BASE_URL}/invitations/{link_token}/accept", headers=charlie_headers)
    assert r.status_code == 200, f"Charlie failed to accept share link: {r.text}"
    print(f"[PASS] Charlie accepted workspace share link as Viewer")

    # 11. Charlie (Viewer) attempts to update prompt content (must fail 403 Forbidden)
    r = requests.put(f"{BASE_URL}/prompts/{prompt_id}", headers=charlie_headers, json={
        "title": "Hacked Title",
        "content": "Malicious content"
    })
    assert r.status_code == 403, f"Expected 403 when Viewer edits, got: {r.status_code} {r.text}"
    print(f"[PASS] Charlie (Viewer) correctly blocked from editing prompt (403 Forbidden)")

    # 12. Charlie (Viewer) attempts to create version (must fail 403 Forbidden)
    r = requests.post(f"{BASE_URL}/prompts/{prompt_id}/versions", headers=charlie_headers, json={
        "commit_message": "Viewer commit",
        "content": "Viewer content"
    })
    assert r.status_code == 403, f"Expected 403 when Viewer commits version, got: {r.status_code} {r.text}"
    print(f"[PASS] Charlie (Viewer) correctly blocked from committing versions (403 Forbidden)")

    # 13. Alice checks collaboration overview
    r = requests.get(f"{BASE_URL}/collaboration/overview", headers=alice_headers)
    assert r.status_code == 200
    overview = r.json()
    assert overview.get("membersCount", 0) >= 2 or overview.get("totalMembers", 0) >= 2
    print(f"[PASS] Alice overview shows {overview.get('membersCount')} active collaborators")

    # 14. Alice updates Bob's role to Reviewer
    r = requests.put(f"{BASE_URL}/collaboration/members/{bob_email}/role", headers=alice_headers, json={
        "role": "Reviewer"
    })
    assert r.status_code == 200
    print(f"[PASS] Alice updated Bob's role to Reviewer")

    # 15. Alice revokes Charlie's access
    r = requests.delete(f"{BASE_URL}/collaboration/members/{charlie_email}", headers=alice_headers)
    assert r.status_code == 200
    print(f"[PASS] Alice revoked Charlie's access")

    # 16. Verify Charlie no longer sees Alice's prompts
    r = requests.get(f"{BASE_URL}/prompts", headers=charlie_headers)
    assert r.status_code == 200
    charlie_prompts = r.json()
    assert not any(p["id"] == prompt_id for p in charlie_prompts), "Charlie still has access after revocation"
    print(f"[PASS] Charlie's prompt access is completely revoked")

    print("\nALL 16 COLLABORATION BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"[FAIL] Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
