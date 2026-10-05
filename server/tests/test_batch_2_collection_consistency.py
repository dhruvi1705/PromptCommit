import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.collection import Collection, collection_prompts
from app.models.prompt import Prompt
from app.core.migration import migrate_legacy_collections

client = TestClient(app)

def create_test_user(name="Batch2 User"):
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

def test_batch_2_all_20_consistency_requirements():
    # Setup User A and User B
    user_a = create_test_user(name="Alice Engineer")
    user_b = create_test_user(name="Bob Researcher")

    # 1. Existing migrated prompts appear in Collections & 2. promptCount matches relationship
    db = SessionLocal()
    try:
        # Create a legacy prompt for Alice
        p_legacy = Prompt(
            user_id=user_a["id"],
            title="Alice Legacy Code Reviewer",
            content="Review code thoroughly.",
            category="Coding",
            collection_name="Alice Custom Vault"
        )
        db.add(p_legacy)
        db.commit()
        db.refresh(p_legacy)
    finally:
        db.close()

    # Run migration
    migrate_legacy_collections()

    # Verify Alice sees collection with count 1
    res = client.get("/api/collections", headers=user_a["headers"])
    assert res.status_code == 200
    alice_cols = res.json()
    migrated_col = next((c for c in alice_cols if c["name"] == "Alice Custom Vault"), None)
    assert migrated_col is not None, "TEST 1 Failed: Migrated collection not found"
    assert migrated_col["promptCount"] == 1, "TEST 2 Failed: Prompt count mismatch"

    # 3. User A and User B can both have "Research"
    res_a = client.post("/api/collections", headers=user_a["headers"], json={
        "name": "Research",
        "description": "Alice Research",
        "defaultTags": ["AI", "Algorithms"]
    })
    assert res_a.status_code in [200, 201]
    col_a_research = res_a.json()

    res_b = client.post("/api/collections", headers=user_b["headers"], json={
        "name": "Research",
        "description": "Bob Research",
        "defaultTags": ["Genomics", "Biomedical"]
    })
    assert res_b.status_code in [200, 201]
    col_b_research = res_b.json()

    assert col_a_research["id"] != col_b_research["id"], "TEST 3 Failed: Collection IDs must be unique per user"
    assert col_a_research["name"] == "Research"
    assert col_b_research["name"] == "Research"

    # 4. User A cannot access User B's "Research"
    res_unauth = client.get(f"/api/collections/{col_b_research['id']}", headers=user_a["headers"])
    assert res_unauth.status_code == 404, "TEST 4 Failed: User A accessed User B's collection"

    # 5. Collection filtering uses collectionId
    # Alice creates prompt in her Research collection
    res_p = client.post("/api/prompts", headers=user_a["headers"], json={
        "title": "Alice Literature Review",
        "content": "Synthesize papers",
        "category": "Research",
        "collectionId": col_a_research["id"]
    })
    assert res_p.status_code in [200, 201]
    p_alice_res = res_p.json()

    # Filter by collectionId
    res_filt = client.get(f"/api/prompts?collectionId={col_a_research['id']}", headers=user_a["headers"])
    assert res_filt.status_code == 200
    filtered_prompts = res_filt.json()
    assert len(filtered_prompts) == 1
    assert filtered_prompts[0]["id"] == p_alice_res["id"]

    # 6. Rename does not break filtering
    res_ren = client.put(f"/api/collections/{col_a_research['id']}", headers=user_a["headers"], json={
        "name": "Advanced Research"
    })
    assert res_ren.status_code == 200
    # Filter by same ID still returns the prompt
    res_filt_after = client.get(f"/api/prompts?collectionId={col_a_research['id']}", headers=user_a["headers"])
    assert len(res_filt_after.json()) == 1

    # 7. Dashboard collection selection uses ID & 8. CreatePrompt submits collectionId
    res_p2 = client.post("/api/prompts", headers=user_a["headers"], json={
        "title": "Prompt from CreatePrompt Form",
        "content": "Dashboard creation flow test",
        "category": "Coding",
        "collectionId": col_a_research["id"]
    })
    assert res_p2.status_code in [200, 201]
    assert res_p2.json()["collectionId"] == col_a_research["id"]

    # 9. EditPrompt submits collectionId
    # Create new collection for Alice
    res_new_col = client.post("/api/collections", headers=user_a["headers"], json={
        "name": "Alice Target Vault"
    })
    col_target = res_new_col.json()

    # Edit prompt to point to col_target["id"]
    res_edit = client.put(f"/api/prompts/{res_p2.json()['id']}", headers=user_a["headers"], json={
        "collectionId": col_target["id"]
    })
    assert res_edit.status_code == 200
    assert res_edit.json()["collectionId"] == col_target["id"]

    # 10. Prompt can be created without a collection
    res_no_col = client.post("/api/prompts", headers=user_a["headers"], json={
        "title": "Orphan Prompt",
        "content": "No collection test",
        "category": "Marketing"
    })
    assert res_no_col.status_code in [200, 201]
    assert res_no_col.json()["collectionId"] is None
    assert res_no_col.json()["collections"] == []

    # 11. Prompt can be created with a collection
    assert p_alice_res["collectionId"] == col_a_research["id"]

    # 12. Existing prompt can be added to a newly created collection
    res_add = client.post(
        f"/api/collections/{col_target['id']}/prompts/{res_no_col.json()['id']}",
        headers=user_a["headers"]
    )
    assert res_add.status_code == 200

    # Verify col_target count is now 2
    res_col_info = client.get(f"/api/collections/{col_target['id']}", headers=user_a["headers"])
    assert res_col_info.json()["promptCount"] == 2

    # 13. Collection creation uses authenticated user ID & 14. Client-supplied userId cannot change ownership
    res_fake_user = client.post("/api/collections", headers=user_a["headers"], json={
        "name": "Attempted Hijack Collection",
        "userId": user_b["id"]  # Client attempts to spoof user_b
    })
    assert res_fake_user.status_code in [200, 201]
    # Server must force user_a["id"]
    assert res_fake_user.json()["userId"] == user_a["id"]

    # 15. Collection defaults are persisted & 16. Default tags are returned consistently by API
    res_col_tags = client.post("/api/collections", headers=user_a["headers"], json={
        "name": "Machine Learning",
        "description": "ML & Neural Nets",
        "defaultTags": ["PyTorch", "Transformers", "LLM"]
    })
    assert res_col_tags.status_code in [200, 201]
    col_ml = res_col_tags.json()
    assert col_ml["defaultTags"] == ["PyTorch", "Transformers", "LLM"]

    # Read back from GET /api/collections/{id}
    res_col_read = client.get(f"/api/collections/{col_ml['id']}", headers=user_a["headers"])
    assert res_col_read.json()["defaultTags"] == ["PyTorch", "Transformers", "LLM"]

    # 17. New prompts can receive collection default tags (when tags omitted)
    res_p_default_tags = client.post("/api/prompts", headers=user_a["headers"], json={
        "title": "BERT Embeddings Extractor",
        "content": "Extract transformer embeddings.",
        "category": "Coding",
        "collectionId": col_ml["id"]
        # Explicit tags omitted
    })
    assert res_p_default_tags.status_code in [200, 201]
    p_ml = res_p_default_tags.json()
    assert "PyTorch" in p_ml["tags"]
    assert "Transformers" in p_ml["tags"]
    assert "LLM" in p_ml["tags"]

    # 18. Explicit prompt tags override defaults where appropriate
    res_p_explicit_tags = client.post("/api/prompts", headers=user_a["headers"], json={
        "title": "Custom Tagged Prompt",
        "content": "Explicit tags provided.",
        "category": "Coding",
        "collectionId": col_ml["id"],
        "tags": ["CustomTag1", "CustomTag2"]
    })
    assert res_p_explicit_tags.status_code in [200, 201]
    p_custom = res_p_explicit_tags.json()
    assert p_custom["tags"] == ["CustomTag1", "CustomTag2"]

    # 19. Changing collection default tags does not rewrite existing prompt tags
    res_update_tags = client.put(f"/api/collections/{col_ml['id']}", headers=user_a["headers"], json={
        "defaultTags": ["Jax", "Flax"]
    })
    assert res_update_tags.status_code == 200

    # Verify existing prompt p_ml still retains its tags
    res_p_ml_check = client.get(f"/api/prompts/{p_ml['id']}", headers=user_a["headers"])
    assert "PyTorch" in res_p_ml_check.json()["tags"]
    assert "Transformers" in res_p_ml_check.json()["tags"]

    # 20. User A cannot read User B's default tags
    res_b_tags = client.get(f"/api/collections/{col_b_research['id']}", headers=user_a["headers"])
    assert res_b_tags.status_code == 404, "TEST 20 Failed: User A accessed User B's collection tags"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
