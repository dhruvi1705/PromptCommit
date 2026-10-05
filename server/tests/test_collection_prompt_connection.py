import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_collection_prompt_connection_lifecycle():
    suffix = uuid.uuid4().hex[:8]
    email = f"user_{suffix}@promptcommit.dev"

    # 1. Register User
    res = client.post("/api/auth/signup", json={
        "email": email,
        "username": f"user_{suffix}",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "name": "Collection Tester"
    })
    assert res.status_code in [200, 201], f"Signup failed: {res.text}"
    token = res.json().get("access_token") or res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. TEST A: Create Collection "Coding"
    res = client.post("/api/collections", headers=headers, json={
        "name": "Coding",
        "description": "Code and development prompts",
        "icon": "Code2",
        "color": "blue"
    })
    assert res.status_code in [200, 201], f"Create collection failed: {res.text}"
    coding_col = res.json()
    assert coding_col["name"] == "Coding"
    assert coding_col["promptCount"] == 0

    # Create Collection "Research"
    res = client.post("/api/collections", headers=headers, json={
        "name": "Research",
        "description": "Academic and data analysis prompts",
        "icon": "BookOpen",
        "color": "indigo"
    })
    assert res.status_code in [200, 201]
    research_col = res.json()
    assert research_col["promptCount"] == 0

    # 3. Create Prompt 1 with Collection "Coding"
    res = client.post("/api/prompts", headers=headers, json={
        "title": "Codebase Refactoring Engine",
        "description": "Refactor code cleanly",
        "category": "Engineering",
        "collection": "Coding",
        "content": "You are an expert engineer. Optimize this algorithm.",
        "targetModel": "gemini-3.6-flash",
        "tags": ["Code", "Coding", "Development"]
    })
    assert res.status_code in [200, 201]
    p1 = res.json()
    assert p1["collection"] == "Coding"
    assert p1["category"] == "Engineering"

    # Verify Collections -> Coding promptCount is now 1
    res = client.get("/api/collections", headers=headers)
    assert res.status_code == 200
    cols = {c["name"]: c["promptCount"] for c in res.json()}
    assert cols["Coding"] == 1
    assert cols["Research"] == 0

    # 4. TEST B: Create Prompt 2 with Collection "Coding"
    res = client.post("/api/prompts", headers=headers, json={
        "title": "Database Query Optimizer",
        "description": "Optimize SQL queries",
        "category": "Database",
        "collection": "Coding",
        "content": "Analyze slow queries and recommend indexes.",
        "targetModel": "gemini-3.6-flash",
        "tags": ["SQL", "Postgres"]
    })
    assert res.status_code in [200, 201]
    p2 = res.json()
    assert p2["collection"] == "Coding"

    # Verify Collections -> Coding promptCount is now 2
    res = client.get("/api/collections", headers=headers)
    assert res.status_code == 200
    cols = {c["name"]: c["promptCount"] for c in res.json()}
    assert cols["Coding"] == 2
    assert cols["Research"] == 0

    # 5. TEST C: Edit Prompt 1 from "Coding" -> "Research"
    res = client.put(f"/api/prompts/{p1['id']}", headers=headers, json={
        "collection": "Research"
    })
    assert res.status_code == 200
    updated_p1 = res.json()
    assert updated_p1["collection"] == "Research"

    # Verify Collections counts: Coding = 1, Research = 1
    res = client.get("/api/collections", headers=headers)
    assert res.status_code == 200
    cols = {c["name"]: c["promptCount"] for c in res.json()}
    assert cols["Coding"] == 1
    assert cols["Research"] == 1

    # 6. TEST D: Fetch Prompt 1 again, verify it returns "Research"
    res = client.get(f"/api/prompts/{p1['id']}", headers=headers)
    assert res.status_code == 200
    assert res.json()["collection"] == "Research"

    # 7. TEST E: Create new collection directly "Frontend Prompts" and create prompt
    res = client.post("/api/collections", headers=headers, json={
        "name": "Frontend Prompts",
        "description": "UI components and layouts",
        "icon": "FolderKanban"
    })
    assert res.status_code in [200, 201]
    fe_col = res.json()
    assert fe_col["name"] == "Frontend Prompts"

    res = client.post("/api/prompts", headers=headers, json={
        "title": "React Component Generator",
        "description": "Generate accessible React UI",
        "category": "Coding",
        "collection": "Frontend Prompts",
        "content": "Create accessible Tailwind components.",
        "targetModel": "gemini-3.6-flash",
        "tags": ["React", "Tailwind"]
    })
    assert res.status_code in [200, 201]
    p3 = res.json()
    assert p3["collection"] == "Frontend Prompts"

    # Verify counts: Coding = 1, Research = 1, Frontend Prompts = 1
    res = client.get("/api/collections", headers=headers)
    assert res.status_code == 200
    cols = {c["name"]: c["promptCount"] for c in res.json()}
    assert cols["Coding"] == 1
    assert cols["Research"] == 1
    assert cols["Frontend Prompts"] == 1

    # 8. TEST F: Filter Prompts by Collection
    res = client.get("/api/prompts?collection=Coding", headers=headers)
    assert res.status_code == 200
    coding_prompts = res.json()
    assert len(coding_prompts) == 1
    assert coding_prompts[0]["id"] == p2["id"]

    res = client.get("/api/prompts?collection=Research", headers=headers)
    assert res.status_code == 200
    research_prompts = res.json()
    assert len(research_prompts) == 1
    assert research_prompts[0]["id"] == p1["id"]

    res = client.get("/api/prompts?collection=Frontend+Prompts", headers=headers)
    assert res.status_code == 200
    fe_prompts = res.json()
    assert len(fe_prompts) == 1
    assert fe_prompts[0]["id"] == p3["id"]

    # 9. TEST G: Remove Collection from Prompt 2 (set to General/None)
    res = client.put(f"/api/prompts/{p2['id']}", headers=headers, json={
        "collection": "General"
    })
    assert res.status_code == 200
    assert res.json()["collection"] is None or res.json()["collection"] == "General"

    # Verify Coding count drops to 0
    res = client.get("/api/collections", headers=headers)
    assert res.status_code == 200
    cols = {c["name"]: c["promptCount"] for c in res.json()}
    assert cols["Coding"] == 0
    assert cols["Research"] == 1
    assert cols["Frontend Prompts"] == 1

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
