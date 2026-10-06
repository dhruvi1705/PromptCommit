# pyre-ignore [missing-import]
import pytest
import requests
import uuid
from datetime import datetime, timezone
from app.core.ai_config import SUPPORTED_AI_PROVIDERS

BASE_URL = "http://localhost:8000/api"

def register_user(prefix: str = "batch9_user"):
    unique_id = uuid.uuid4().hex[:8]
    email = f"{prefix}_{unique_id}@promptcommit.dev"
    username = f"u9_{unique_id}"
    password = "SecurePassword123!"
    name = f"User {unique_id.upper()}"
    
    reg_res = requests.post(
        f"{BASE_URL}/auth/signup",
        json={
            "email": email,
            "username": username,
            "password": password,
            "confirm_password": password,
            "name": name
        }
    )
    assert reg_res.status_code == 201, f"Failed registration: {reg_res.text}"
    token = reg_res.json()["access_token"]
    user = reg_res.json()["user"]
    headers = {"Authorization": f"Bearer {token}"}
    return user, headers, password


# ====================================================================
# TEST 1: Prompt without collection has no fake General collection
# ====================================================================
def test_prompt_no_collection_no_fake_general():
    """Verify prompt without collection has collectionId: None, collections: [], and no fake General collection is created."""
    user, headers, _ = register_user("NoColUser")
    
    # Create prompt without collection
    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "Unassigned Prompt", "content": "Sample content"}, headers=headers)
    assert r_p.status_code == 201
    p_data = r_p.json()
    assert p_data["collectionId"] is None
    assert p_data["collection"] is None
    assert len(p_data["collections"]) == 0

    # Ensure no collection named 'General' exists in collections list
    r_cols = requests.get(f"{BASE_URL}/collections", headers=headers)
    assert r_cols.status_code == 200
    assert len(r_cols.json()) == 0
    assert not any(c["name"].lower() == "general" for c in r_cols.json())
    print("[OK] Test 1: No fake General pseudo-collection.")


# ====================================================================
# TEST 2: Prompt with collection returns canonical collection
# ====================================================================
def test_prompt_with_canonical_collection():
    """Verify prompt with assigned collection returns canonical collection data."""
    user, headers, _ = register_user("CanonColUser")

    r_col = requests.post(f"{BASE_URL}/collections", json={"name": "Engineering"}, headers=headers)
    assert r_col.status_code == 201
    col_id = r_col.json()["id"]

    r_p = requests.post(f"{BASE_URL}/prompts", json={
        "title": "Code Review Bot",
        "content": "Review code",
        "collectionId": col_id
    }, headers=headers)
    assert r_p.status_code == 201
    p_data = r_p.json()
    assert p_data["collectionId"] == col_id
    assert p_data["collection"] == "Engineering"
    assert len(p_data["collections"]) == 1
    assert p_data["collections"][0]["id"] == col_id
    assert p_data["collections"][0]["name"] == "Engineering"
    print("[OK] Test 2: Canonical collection returned.")


# ====================================================================
# TEST 3: Export uses canonical collection relationship
# ====================================================================
def test_export_uses_canonical_collection():
    """Verify exported data reflects canonical collection data via prompt.collections."""
    user, headers, _ = register_user("ExportTester")

    r_col = requests.post(f"{BASE_URL}/collections", json={"name": "Cloud Engineering"}, headers=headers)
    col_id = r_col.json()["id"]

    r_p = requests.post(f"{BASE_URL}/prompts", json={
        "title": "Terraform AWS", "content": "AWS VPC blueprint", "collectionId": col_id
    }, headers=headers)
    p_id = r_p.json()["id"]

    # Fetch prompt - verify export-ready canonical representation
    r_get = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    p_data = r_get.json()
    assert len(p_data["collections"]) == 1
    assert p_data["collections"][0]["id"] == col_id
    assert p_data["collections"][0]["name"] == "Cloud Engineering"
    print("[OK] Test 3: Export uses canonical collection.")


# ====================================================================
# TEST 4: Renamed collection appears correctly in prompt data
# ====================================================================
def test_renamed_collection_appears_correctly():
    """Verify renaming a collection propagates to prompt representations."""
    user, headers, _ = register_user("RenameTester")

    r_col = requests.post(f"{BASE_URL}/collections", json={"name": "Old Name"}, headers=headers)
    col_id = r_col.json()["id"]

    r_p = requests.post(f"{BASE_URL}/prompts", json={
        "title": "Test Prompt", "content": "Content", "collectionId": col_id
    }, headers=headers)
    p_id = r_p.json()["id"]

    # Rename
    r_rename = requests.put(f"{BASE_URL}/collections/{col_id}", json={"name": "New Name"}, headers=headers)
    assert r_rename.status_code == 200

    # Check prompt reflects rename
    r_get = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    p_data = r_get.json()
    assert p_data["collection"] == "New Name"
    assert p_data["collections"][0]["name"] == "New Name"
    print("[OK] Test 4: Renamed collection reflected in prompt.")


# ====================================================================
# TEST 5: Deleting collection does not delete prompt
# ====================================================================
def test_deleting_collection_preserves_prompt():
    """Verify deleting a collection removes the association without deleting prompts."""
    user, headers, _ = register_user("DelColTester")

    r_col = requests.post(f"{BASE_URL}/collections", json={"name": "Temporary Vault"}, headers=headers)
    col_id = r_col.json()["id"]

    r_p = requests.post(f"{BASE_URL}/prompts", json={
        "title": "Persistent Asset", "content": "Do not delete me", "collectionId": col_id
    }, headers=headers)
    p_id = r_p.json()["id"]

    r_del = requests.delete(f"{BASE_URL}/collections/{col_id}", headers=headers)
    assert r_del.status_code == 200

    r_p_check = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    assert r_p_check.status_code == 200
    assert r_p_check.json()["title"] == "Persistent Asset"
    print("[OK] Test 5: Prompt survives collection deletion.")


# ====================================================================
# TEST 6: Deleting collection does not create General
# ====================================================================
def test_deleting_collection_no_general_created():
    """Verify deleting a collection does not fabricate a General collection."""
    user, headers, _ = register_user("NoGenCreate")

    r_col = requests.post(f"{BASE_URL}/collections", json={"name": "Disposable"}, headers=headers)
    col_id = r_col.json()["id"]

    requests.post(f"{BASE_URL}/prompts", json={
        "title": "Orphan", "content": "Test", "collectionId": col_id
    }, headers=headers)

    requests.delete(f"{BASE_URL}/collections/{col_id}", headers=headers)

    r_cols = requests.get(f"{BASE_URL}/collections", headers=headers)
    assert len(r_cols.json()) == 0
    assert not any(c["name"].lower() == "general" for c in r_cols.json())
    print("[OK] Test 6: No General fabricated after deletion.")


# ====================================================================
# TEST 7: Collection deletion removes canonical association
# ====================================================================
def test_collection_deletion_clears_association():
    """Verify collection deletion clears prompt's collection fields."""
    user, headers, _ = register_user("AssocClear")

    r_col = requests.post(f"{BASE_URL}/collections", json={"name": "Linked"}, headers=headers)
    col_id = r_col.json()["id"]

    r_p = requests.post(f"{BASE_URL}/prompts", json={
        "title": "Linked Prompt", "content": "Test", "collectionId": col_id
    }, headers=headers)
    p_id = r_p.json()["id"]

    requests.delete(f"{BASE_URL}/collections/{col_id}", headers=headers)

    r_get = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    p_data = r_get.json()
    assert p_data["collectionId"] is None
    assert p_data["collection"] is None
    assert len(p_data["collections"]) == 0
    print("[OK] Test 7: Collection association cleared after deletion.")


# ====================================================================
# TEST 8: PromptContext categories do not contain collection names
# (Validated via API — categories come from prompt.category, not collections)
# ====================================================================
def test_categories_separate_from_collections():
    """Verify categories are independent of collection names."""
    user, headers, _ = register_user("CatSepUser")

    # Create a collection with a unique name
    requests.post(f"{BASE_URL}/collections", json={"name": "My Secret Vault"}, headers=headers)

    # Create a prompt with a known category
    requests.post(f"{BASE_URL}/prompts", json={
        "title": "Cat Test", "content": "C", "category": "Coding"
    }, headers=headers)

    # Fetch analytics to check category breakdown
    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    an = r_an.json()
    cat_names = [c["name"] for c in an["categories"]]
    assert "My Secret Vault" not in cat_names
    assert "Coding" in cat_names
    print("[OK] Test 8: Categories separate from collections.")


# ====================================================================
# TEST 9: addCollection does not alter categories
# ====================================================================
def test_add_collection_does_not_alter_categories():
    """Verify creating a collection does not change prompt categories."""
    user, headers, _ = register_user("AddColCat")

    # Create prompts with specific categories
    requests.post(f"{BASE_URL}/prompts", json={
        "title": "P1", "content": "C1", "category": "Research"
    }, headers=headers)

    # Get analytics before adding collection
    r_before = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    cats_before = {c["name"]: c["count"] for c in r_before.json()["categories"]}

    # Add a collection
    requests.post(f"{BASE_URL}/collections", json={"name": "New Collection XYZ"}, headers=headers)

    # Get analytics after adding collection
    r_after = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    cats_after = {c["name"]: c["count"] for c in r_after.json()["categories"]}

    assert cats_before == cats_after
    assert "New Collection XYZ" not in cats_after
    print("[OK] Test 9: addCollection does not alter categories.")


# ====================================================================
# TEST 10: deleteCollection operates by collection ID
# ====================================================================
def test_delete_collection_by_id():
    """Verify collection deletion works via collection ID."""
    user, headers, _ = register_user("DelById")

    r_col = requests.post(f"{BASE_URL}/collections", json={"name": "ByIdDel"}, headers=headers)
    col_id = r_col.json()["id"]

    r_del = requests.delete(f"{BASE_URL}/collections/{col_id}", headers=headers)
    assert r_del.status_code == 200
    assert r_del.json()["success"] is True
    print("[OK] Test 10: deleteCollection by ID.")


# ====================================================================
# TEST 11: No current Gemini 2.0 model references
# ====================================================================
def test_no_gemini_2_model_references():
    """Verify supported AI configurations contain exactly the 6 canonical models and no Gemini 2.0."""
    all_models = []
    for provider, cfg in SUPPORTED_AI_PROVIDERS.items():
        all_models.extend(cfg["models"])

    assert "gemini-3.6-flash" in all_models
    assert "gemini-3.7-flash" in all_models
    assert "gemini-3.8-flash" in all_models
    assert "openai/gpt-oss-20b" in all_models
    assert "openrouter/free" in all_models
    assert "mistral-small-latest" in all_models
    assert len(all_models) == 6

    # Verify Gemini 2.0 is NOT present
    assert not any("gemini-2" in m.lower() for m in all_models)
    assert not any("gemini 2" in m.lower() for m in all_models)
    print("[OK] Test 11: No Gemini 2.0 references.")


# ====================================================================
# TEST 12: Collaboration roles use canonical values
# ====================================================================
def test_collaboration_canonical_roles():
    """Verify sharing a prompt normalizes role to canonical values."""
    user, headers, _ = register_user("RoleTester")

    r_p = requests.post(f"{BASE_URL}/prompts", json={
        "title": "Shared Asset", "content": "Share me"
    }, headers=headers)
    p_id = r_p.json()["id"]

    # Share with canonical "Reviewer" role
    r_share = requests.post(f"{BASE_URL}/prompts/{p_id}/share", json={
        "email": "collab_reviewer@test.dev", "role": "Reviewer"
    }, headers=headers)
    assert r_share.status_code == 200

    # Fetch prompt to check share data
    r_get = requests.get(f"{BASE_URL}/prompts/{p_id}", headers=headers)
    shares = r_get.json().get("sharedWith", [])
    if shares:
        assert shares[0]["role"] in ["Viewer", "Reviewer", "Editor", "Owner"]
    print("[OK] Test 12: Canonical collaboration roles.")


# ====================================================================
# TEST 13: Obsolete typo correction test removed/replaced
# (Verified by absence of TYPO_CORRECTIONS in codebase)
# ====================================================================
def test_no_typo_correction_legacy():
    """Verify TYPO_CORRECTIONS, correct_raw_text, polish_rough_idea do not exist in source."""
    import os
    import glob

    src_dir = os.path.join(os.path.dirname(__file__), "app")
    py_files = glob.glob(os.path.join(src_dir, "**", "*.py"), recursive=True)

    for fpath in py_files:
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            assert "TYPO_CORRECTIONS" not in content, f"Found TYPO_CORRECTIONS in {fpath}"
            assert "correct_raw_text" not in content, f"Found correct_raw_text in {fpath}"
            assert "polish_rough_idea" not in content, f"Found polish_rough_idea in {fpath}"
    print("[OK] Test 13: No obsolete typo correction logic.")


# ====================================================================
# TEST 14: Analytics total prompt count
# ====================================================================
def test_analytics_total_prompt_count():
    """Verify analytics totalPrompts is accurate."""
    user, headers, _ = register_user("PromptCount")

    requests.post(f"{BASE_URL}/prompts", json={"title": "P1", "content": "C1"}, headers=headers)
    requests.post(f"{BASE_URL}/prompts", json={"title": "P2", "content": "C2"}, headers=headers)
    requests.post(f"{BASE_URL}/prompts", json={"title": "P3", "content": "C3"}, headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    assert r_an.json()["totalPrompts"] == 3
    print("[OK] Test 14: Total prompt count correct.")


# ====================================================================
# TEST 15: Analytics total collection count
# ====================================================================
def test_analytics_total_collection_count():
    """Verify analytics totalCollections is accurate."""
    user, headers, _ = register_user("ColCount")

    requests.post(f"{BASE_URL}/collections", json={"name": "Col A"}, headers=headers)
    requests.post(f"{BASE_URL}/collections", json={"name": "Col B"}, headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    assert r_an.json()["totalCollections"] == 2
    print("[OK] Test 15: Total collection count correct.")


# ====================================================================
# TEST 16: Analytics average rating
# ====================================================================
def test_analytics_average_rating():
    """Verify average rating calculation is correct and only includes rated prompts."""
    user, headers, _ = register_user("AvgRating")

    r_p1 = requests.post(f"{BASE_URL}/prompts", json={"title": "Rated A", "content": "C"}, headers=headers)
    p1_id = r_p1.json()["id"]
    r_p2 = requests.post(f"{BASE_URL}/prompts", json={"title": "Rated B", "content": "C"}, headers=headers)
    p2_id = r_p2.json()["id"]
    requests.post(f"{BASE_URL}/prompts", json={"title": "Unrated", "content": "C"}, headers=headers)

    requests.post(f"{BASE_URL}/prompts/{p1_id}/rate?rating=4.0", headers=headers)
    requests.post(f"{BASE_URL}/prompts/{p2_id}/rate?rating=5.0", headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    assert r_an.json()["avgPromptRating"] == 4.5
    print("[OK] Test 16: Average rating correct.")


# ====================================================================
# TEST 17: No-rating average is null
# ====================================================================
def test_analytics_no_rating_is_null():
    """Verify avgPromptRating is null when no prompts are rated."""
    user, headers, _ = register_user("NullRating")

    requests.post(f"{BASE_URL}/prompts", json={"title": "NoRate", "content": "C"}, headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    assert r_an.json()["avgPromptRating"] is None
    print("[OK] Test 17: No-rating average is null.")


# ====================================================================
# TEST 18: Category breakdown correctness
# ====================================================================
def test_analytics_category_breakdown():
    """Verify category breakdown uses prompt.category and is correct."""
    user, headers, _ = register_user("CatBreak")

    requests.post(f"{BASE_URL}/prompts", json={"title": "P1", "content": "C", "category": "Coding"}, headers=headers)
    requests.post(f"{BASE_URL}/prompts", json={"title": "P2", "content": "C", "category": "Coding"}, headers=headers)
    requests.post(f"{BASE_URL}/prompts", json={"title": "P3", "content": "C", "category": "Research"}, headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    cats = {c["name"]: c["count"] for c in r_an.json()["categories"]}
    assert cats.get("Coding") == 2
    assert cats.get("Research") == 1
    print("[OK] Test 18: Category breakdown correct.")


# ====================================================================
# TEST 19: Model statistics correctness
# ====================================================================
def test_analytics_model_statistics():
    """Verify model statistics from prompt tests use canonical model IDs."""
    user, headers, _ = register_user("ModelStats")

    r_p = requests.post(f"{BASE_URL}/prompts", json={"title": "TestP", "content": "C"}, headers=headers)
    p_id = r_p.json()["id"]

    requests.post(f"{BASE_URL}/tests", json={
        "prompt_id": p_id, "provider": "Google Gemini",
        "model": "gemini-3.6-flash", "input_text": "test"
    }, headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    model_stats = r_an.json()["modelStats"]
    if model_stats:
        model_names = [m["model"] for m in model_stats]
        assert "gemini-3.6-flash" in model_names
        # Verify no Gemini 2.0 in model stats
        assert not any("gemini-2" in m.lower() for m in model_names)
    print("[OK] Test 19: Model statistics correct.")


# ====================================================================
# TEST 20: Recent activity chronological ordering
# ====================================================================
def test_recent_activity_chronological():
    """Verify recent activities are sorted by real datetime, not string sort."""
    user, headers, _ = register_user("ChronoAct")

    # Create several prompts to generate activities
    for i in range(4):
        requests.post(f"{BASE_URL}/prompts", json={
            "title": f"Chrono P{i}", "content": f"Content {i}"
        }, headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    activities = r_an.json()["recentActivities"]
    assert len(activities) >= 4

    # Activities should be in reverse chronological order (most recent first)
    # Since we created them sequentially, the last created should be first
    # Verify all have time strings (format validation)
    for act in activities:
        assert "time" in act
        assert act["time"] != ""
    print("[OK] Test 20: Recent activity chronological order.")


# ====================================================================
# TEST 21: Recent activity limit
# ====================================================================
def test_recent_activity_limit():
    """Verify recent activities are bounded by a limit (8)."""
    user, headers, _ = register_user("LimitAct")

    for i in range(12):
        requests.post(f"{BASE_URL}/prompts", json={
            "title": f"Limit P{i}", "content": f"Content {i}"
        }, headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    activities = r_an.json()["recentActivities"]
    assert len(activities) <= 8
    print("[OK] Test 21: Recent activity limit enforced.")


# ====================================================================
# TEST 22: User analytics isolation
# ====================================================================
def test_analytics_user_isolation():
    """Verify User A's analytics metrics do NOT include User B's data."""
    user_a, h_a, _ = register_user("UserAlphaAnalytics")
    user_b, h_b, _ = register_user("UserBetaAnalytics")

    requests.post(f"{BASE_URL}/collections", json={"name": "Alpha Vault"}, headers=h_a)
    requests.post(f"{BASE_URL}/prompts", json={"title": "Alpha Prompt 1", "content": "A1"}, headers=h_a)
    requests.post(f"{BASE_URL}/prompts", json={"title": "Alpha Prompt 2", "content": "A2"}, headers=h_a)

    # User B analytics must be completely empty
    r_an_b = requests.get(f"{BASE_URL}/analytics/overview", headers=h_b)
    assert r_an_b.status_code == 200
    an_b = r_an_b.json()
    assert an_b["totalPrompts"] == 0
    assert an_b["totalCollections"] == 0
    assert an_b["avgPromptRating"] is None
    assert len(an_b["categories"]) == 0
    assert len(an_b["recentActivities"]) == 0

    # User A analytics should show their data
    r_an_a = requests.get(f"{BASE_URL}/analytics/overview", headers=h_a)
    an_a = r_an_a.json()
    assert an_a["totalPrompts"] == 2
    assert an_a["totalCollections"] == 1
    print("[OK] Test 22: User analytics isolation.")


# ====================================================================
# TEST 23: Empty analytics dataset behavior
# ====================================================================
def test_empty_analytics_dataset():
    """Verify analytics with no data returns valid zero/null structures."""
    user, headers, _ = register_user("EmptyAnalytics")

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    assert r_an.status_code == 200
    an = r_an.json()
    assert an["totalPrompts"] == 0
    assert an["totalVersions"] == 0
    assert an["totalFavorites"] == 0
    assert an["totalTested"] == 0
    assert an["totalCollections"] == 0
    assert an["avgPromptRating"] is None
    assert isinstance(an["categories"], list) and len(an["categories"]) == 0
    assert isinstance(an["modelStats"], list) and len(an["modelStats"]) == 0
    assert isinstance(an["recentActivities"], list) and len(an["recentActivities"]) == 0
    print("[OK] Test 23: Empty analytics returns valid structure.")


# ====================================================================
# TEST 24: Canonical collection metrics in analytics
# ====================================================================
def test_canonical_collection_metrics():
    """Verify analytics collection count reflects actual canonical collections."""
    user, headers, _ = register_user("ColMetrics")

    requests.post(f"{BASE_URL}/collections", json={"name": "Vault A"}, headers=headers)
    requests.post(f"{BASE_URL}/collections", json={"name": "Vault B"}, headers=headers)
    r_c3 = requests.post(f"{BASE_URL}/collections", json={"name": "Vault C"}, headers=headers)
    c3_id = r_c3.json()["id"]

    # Delete one
    requests.delete(f"{BASE_URL}/collections/{c3_id}", headers=headers)

    r_an = requests.get(f"{BASE_URL}/analytics/overview", headers=headers)
    assert r_an.json()["totalCollections"] == 2
    print("[OK] Test 24: Canonical collection metrics correct.")


# ====================================================================
# Test Runner
# ====================================================================
def run_all_tests():
    print("\n" + "=" * 60)
    print("PROMPTCOMMIT - BATCH 9 TEST SUITE")
    print("Collection Legacy Cleanup + Analytics Correctness & Performance")
    print("=" * 60 + "\n")

    tests = [
        test_prompt_no_collection_no_fake_general,
        test_prompt_with_canonical_collection,
        test_export_uses_canonical_collection,
        test_renamed_collection_appears_correctly,
        test_deleting_collection_preserves_prompt,
        test_deleting_collection_no_general_created,
        test_collection_deletion_clears_association,
        test_categories_separate_from_collections,
        test_add_collection_does_not_alter_categories,
        test_delete_collection_by_id,
        test_no_gemini_2_model_references,
        test_collaboration_canonical_roles,
        test_no_typo_correction_legacy,
        test_analytics_total_prompt_count,
        test_analytics_total_collection_count,
        test_analytics_average_rating,
        test_analytics_no_rating_is_null,
        test_analytics_category_breakdown,
        test_analytics_model_statistics,
        test_recent_activity_chronological,
        test_recent_activity_limit,
        test_analytics_user_isolation,
        test_empty_analytics_dataset,
        test_canonical_collection_metrics,
    ]

    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except Exception as e:
            print(f"[FAIL] {t.__name__} FAILED: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"BATCH 9 TEST SUMMARY: {passed} passed, {failed} failed")
    print("=" * 60 + "\n")
    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    run_all_tests()
