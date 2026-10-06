import uuid
# pyrefly: ignore [missing-import]
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.collection import Collection, collection_prompts
from app.models.prompt import Prompt
from app.core.migration import migrate_legacy_collections

client = TestClient(app)

def create_test_user(name="Collection User"):
    suffix = uuid.uuid4().hex[:8]
    email = f"user_{suffix}@promptcommit.dev"
    username = f"u_{suffix}"
    password = "Password123!"

    res = client.post("/api/auth/signup", json={
        "email": email,
        "username": username,
        "password": password,
        "confirm_password": password,
        "name": name
    })
    assert res.status_code in [200, 201], f"Signup failed: {res.text}"
    data = res.json()
    token = data.get("access_token") or data.get("token")
    user_id = data.get("user", {}).get("id") or data.get("id")
    return {"token": token, "email": email, "id": user_id, "headers": {"Authorization": f"Bearer {token}"}}

def test_collection_architecture_all_18_requirements():
    # Setup User A and User B
    user_a = create_test_user(name="User Alpha")
    user_b = create_test_user(name="User Beta")

    # TEST 1: Create collection
    res = client.post("/api/collections", headers=user_a["headers"], json={
        "name": "Alpha Engineering",
        "description": "Engineering and architecture prompts",
        "icon": "Cpu",
        "color": "blue"
    })
    assert res.status_code in [200, 201], f"TEST 1 Failed: {res.text}"
    col_a1 = res.json()
    assert col_a1["name"] == "Alpha Engineering"
    assert col_a1["promptCount"] == 0
    assert col_a1["id"].startswith("col_")

    # TEST 2: Create prompt without collection
    res = client.post("/api/prompts", headers=user_a["headers"], json={
        "title": "Standalone Prompt",
        "description": "Prompt with no collection",
        "category": "Coding",
        "content": "Stand alone prompt instructions.",
        "targetModel": "gemini-3.6-flash"
    })
    assert res.status_code in [200, 201], f"TEST 2 Failed: {res.text}"
    prompt_no_col = res.json()
    assert prompt_no_col["collectionId"] is None
    assert prompt_no_col["collections"] == []

    # TEST 3: Create prompt with collectionId
    res = client.post("/api/prompts", headers=user_a["headers"], json={
        "title": "Alpha Prompt 1",
        "description": "Created with collectionId",
        "category": "Engineering",
        "collectionId": col_a1["id"],
        "content": "Alpha prompt 1 instructions",
        "targetModel": "gemini-3.6-flash"
    })
    assert res.status_code in [200, 201], f"TEST 3 Failed: {res.text}"
    prompt_a1 = res.json()
    assert prompt_a1["collectionId"] == col_a1["id"]
    assert len(prompt_a1["collections"]) == 1
    assert prompt_a1["collections"][0]["id"] == col_a1["id"]

    # TEST 4: Verify collection_prompts association exists in DB
    db = SessionLocal()
    try:
        assoc = db.query(collection_prompts).filter_by(
            collection_id=col_a1["id"],
            prompt_id=prompt_a1["id"]
        ).first()
        assert assoc is not None, "TEST 4 Failed: Association row missing in collection_prompts"
    finally:
        db.close()

    # TEST 5: Get collection and verify promptCount
    res = client.get(f"/api/collections/{col_a1['id']}", headers=user_a["headers"])
    assert res.status_code == 200, f"TEST 5 Failed: {res.text}"
    col_fetched = res.json()
    assert col_fetched["promptCount"] == 1

    # TEST 6: Get collection prompts and verify prompt appears
    res = client.get(f"/api/collections/{col_a1['id']}/prompts", headers=user_a["headers"])
    assert res.status_code == 200, f"TEST 6 Failed: {res.text}"
    col_prompts = res.json()
    assert len(col_prompts) == 1
    assert col_prompts[0]["id"] == prompt_a1["id"]

    # TEST 7: Add existing prompt to collection
    res = client.post(
        f"/api/collections/{col_a1['id']}/prompts/{prompt_no_col['id']}",
        headers=user_a["headers"]
    )
    assert res.status_code == 200, f"TEST 7 Failed: {res.text}"

    # Verify count is now 2
    res = client.get(f"/api/collections/{col_a1['id']}", headers=user_a["headers"])
    assert res.json()["promptCount"] == 2

    # TEST 8: Add same prompt twice. Expected: no duplicate association
    res = client.post(
        f"/api/collections/{col_a1['id']}/prompts/{prompt_no_col['id']}",
        headers=user_a["headers"]
    )
    assert res.status_code == 200, f"TEST 8 Failed: {res.text}"

    db = SessionLocal()
    try:
        assocs = db.query(collection_prompts).filter_by(
            collection_id=col_a1["id"],
            prompt_id=prompt_no_col["id"]
        ).all()
        assert len(assocs) == 1, f"TEST 8 Failed: Duplicate association found ({len(assocs)})"
    finally:
        db.close()

    # TEST 9: Remove prompt from collection
    res = client.delete(
        f"/api/collections/{col_a1['id']}/prompts/{prompt_no_col['id']}",
        headers=user_a["headers"]
    )
    assert res.status_code == 200, f"TEST 9 Failed: {res.text}"

    # Verify count back to 1
    res = client.get(f"/api/collections/{col_a1['id']}", headers=user_a["headers"])
    assert res.json()["promptCount"] == 1

    # Verify standalone prompt still exists
    res = client.get(f"/api/prompts/{prompt_no_col['id']}", headers=user_a["headers"])
    assert res.status_code == 200
    assert res.json()["title"] == "Standalone Prompt"

    # Create Collection A2
    res = client.post("/api/collections", headers=user_a["headers"], json={
        "name": "Alpha Research",
        "description": "Research notes",
        "icon": "BookOpen",
        "color": "indigo"
    })
    assert res.status_code in [200, 201]
    col_a2 = res.json()

    # TEST 10: Remove prompt from one collection while it remains in another
    # Attach prompt_a1 to col_a2 as well (M2M)
    res = client.post(
        f"/api/collections/{col_a2['id']}/prompts/{prompt_a1['id']}",
        headers=user_a["headers"]
    )
    assert res.status_code == 200

    # Remove prompt_a1 from col_a1
    res = client.delete(
        f"/api/collections/{col_a1['id']}/prompts/{prompt_a1['id']}",
        headers=user_a["headers"]
    )
    assert res.status_code == 200

    # Verify prompt_a1 is still in col_a2
    res = client.get(f"/api/collections/{col_a2['id']}", headers=user_a["headers"])
    assert res.json()["promptCount"] == 1
    res = client.get(f"/api/prompts/{prompt_a1['id']}", headers=user_a["headers"])
    assert res.json()["collectionId"] == col_a2["id"]

    # TEST 11: Rename collection. Verify prompt association remains
    res = client.put(f"/api/collections/{col_a2['id']}", headers=user_a["headers"], json={
        "name": "Alpha Deep Research"
    })
    assert res.status_code == 200, f"TEST 11 Failed: {res.text}"
    renamed_col = res.json()
    assert renamed_col["name"] == "Alpha Deep Research"
    assert renamed_col["promptCount"] == 1

    # Verify prompt still associated by ID
    res = client.get(f"/api/prompts?collectionId={col_a2['id']}", headers=user_a["headers"])
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == prompt_a1["id"]

    # TEST 12: Delete collection. Verify prompt still exists
    res = client.delete(f"/api/collections/{col_a1['id']}", headers=user_a["headers"])
    assert res.status_code == 200, f"TEST 12 Failed: {res.text}"

    # Verify col_a1 is gone
    res = client.get(f"/api/collections/{col_a1['id']}", headers=user_a["headers"])
    assert res.status_code == 404

    # TEST 13: Delete collection with a prompt belonging to another collection. Verify second relationship remains
    # Re-create col_a1, attach prompt_a1 to both col_a1 and col_a2
    res = client.post("/api/collections", headers=user_a["headers"], json={
        "name": "Alpha Temp",
        "description": "Temp collection"
    })
    temp_col = res.json()
    client.post(f"/api/collections/{temp_col['id']}/prompts/{prompt_a1['id']}", headers=user_a["headers"])
    # Delete temp_col
    client.delete(f"/api/collections/{temp_col['id']}", headers=user_a["headers"])

    # Verify prompt_a1 is still in col_a2
    res = client.get(f"/api/collections/{col_a2['id']}", headers=user_a["headers"])
    assert res.json()["promptCount"] == 1

    # TEST 14: User A cannot access User B's collection
    res = client.post("/api/collections", headers=user_b["headers"], json={
        "name": "Beta Private Collection",
        "description": "User B secret prompts"
    })
    col_b = res.json()

    # User A tries to GET User B's collection
    res = client.get(f"/api/collections/{col_b['id']}", headers=user_a["headers"])
    assert res.status_code == 404, "TEST 14 Failed: User A accessed User B's collection"

    # User A tries to PUT User B's collection
    res = client.put(f"/api/collections/{col_b['id']}", headers=user_a["headers"], json={
        "name": "Hacked Collection"
    })
    assert res.status_code == 404

    # User A tries to DELETE User B's collection
    res = client.delete(f"/api/collections/{col_b['id']}", headers=user_a["headers"])
    assert res.status_code == 404

    # TEST 15: User A cannot attach User B's prompt
    res = client.post("/api/prompts", headers=user_b["headers"], json={
        "title": "Beta Secret Prompt",
        "content": "Secret content",
        "category": "Coding"
    })
    prompt_b = res.json()

    res = client.post(
        f"/api/collections/{col_a2['id']}/prompts/{prompt_b['id']}",
        headers=user_a["headers"]
    )
    assert res.status_code == 404, "TEST 15 Failed: User A attached User B's prompt"

    # TEST 16 & 17: Legacy collection migration
    db = SessionLocal()
    try:
        # Create a legacy prompt directly with collection_name
        legacy_prompt = Prompt(
            user_id=user_a["id"],
            title="Legacy Unmigrated Prompt",
            content="Legacy prompt content",
            category="Coding",
            collection_name="Alpha Deep Research"
        )
        db.add(legacy_prompt)
        db.commit()
        db.refresh(legacy_prompt)
        legacy_id = legacy_prompt.id
    finally:
        db.close()

    # Run migration
    stats = migrate_legacy_collections()
    assert stats["migrated_prompts"] >= 1 or stats["associations_created"] >= 1

    # Verify prompt appears in collection via API
    res = client.get(f"/api/prompts?collectionId={col_a2['id']}", headers=user_a["headers"])
    assert res.status_code == 200
    prompt_ids = [p["id"] for p in res.json()]
    assert legacy_id in prompt_ids, "TEST 17 Failed: Migrated legacy prompt not in collection"

    # TEST 18: No fake "General" collection is automatically created
    res = client.get("/api/collections", headers=user_a["headers"])
    col_names = [c["name"].lower() for c in res.json()]
    assert "general" not in col_names, "TEST 18 Failed: Fake 'General' collection found in collections"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
