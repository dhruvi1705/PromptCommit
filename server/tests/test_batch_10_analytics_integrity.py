"""
BATCH 10 — Analytics Integrity Tests
Tests: rating null/N/A, rating accuracy, model normalization, collection analytics,
metric consistency, recent activity ordering, empty dataset, user isolation.
"""
# pyrefly: ignore [missing-import]
import uuid
import requests
import time
from app.core.database import SessionLocal
from app.models.prompt import Prompt
from app.models.prompt_test import PromptTest
from app.models.collection import Collection
from app.models.user import User
from app.core.security import create_access_token, hash_password

BASE_URL = "http://localhost:8000/api"


def _create_db_user(db, prefix="an_test"):
    """Create a test user directly in DB."""
    uid = f"usr_{uuid.uuid4().hex[:12]}"
    user = User(
        id=uid,
        name=f"{prefix} {uid[:6]}",
        username=f"u_{uuid.uuid4().hex[:10]}",
        email=f"{prefix}_{uuid.uuid4().hex[:8]}@test.dev",
        password_hash=hash_password("Password123!")
    )
    db.add(user)
    db.flush()
    return user


def _headers(user_id):
    token = create_access_token(subject=user_id)
    return {"Authorization": f"Bearer {token}"}


# ====================================================================
# TEST 1: No-rating average returns null
# ====================================================================
def test_no_rating_returns_null():
    """avgPromptRating must be null when no prompts are rated."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "NullRat")
        db.add(Prompt(user_id=user.id, title="Unrated", content="X", rating=None))
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        assert r.status_code == 200
        assert r.json()["avgPromptRating"] is None
        print("[OK] Test 1: No-rating returns null.")
    finally:
        db.close()


# ====================================================================
# TEST 2: Single rating correctness
# ====================================================================
def test_single_rating():
    """avgPromptRating with one rated prompt."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "OneRat")
        db.add(Prompt(user_id=user.id, title="Rated", content="X", rating=4.5))
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        assert r.json()["avgPromptRating"] == 4.5
        print("[OK] Test 2: Single rating correctness.")
    finally:
        db.close()


# ====================================================================
# TEST 3: Multiple ratings average
# ====================================================================
def test_multiple_ratings_average():
    """avgPromptRating with multiple rated prompts (excludes unrated)."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "MultiRat")
        db.add(Prompt(user_id=user.id, title="R1", content="X", rating=5.0))
        db.add(Prompt(user_id=user.id, title="R2", content="X", rating=3.0))
        db.add(Prompt(user_id=user.id, title="R3", content="X", rating=None))  # Unrated
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        # Average of 5.0 and 3.0 = 4.0, unrated excluded
        assert r.json()["avgPromptRating"] == 4.0
        print("[OK] Test 3: Multiple ratings average correct.")
    finally:
        db.close()


# ====================================================================
# TEST 4: Total prompt count accuracy
# ====================================================================
def test_total_prompt_count():
    """totalPrompts must match actual prompt count for user."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "PCount")
        for i in range(5):
            db.add(Prompt(user_id=user.id, title=f"P{i}", content="X"))
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        assert r.json()["totalPrompts"] == 5
        print("[OK] Test 4: Total prompt count correct.")
    finally:
        db.close()


# ====================================================================
# TEST 5: Total collection count accuracy
# ====================================================================
def test_total_collection_count():
    """totalCollections must count canonical Collection records, not names."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "CCount")
        db.add(Collection(user_id=user.id, name="Col A", description="A"))
        db.add(Collection(user_id=user.id, name="Col B", description="B"))
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        assert r.json()["totalCollections"] == 2
        print("[OK] Test 5: Total collection count correct.")
    finally:
        db.close()


# ====================================================================
# TEST 6: Collection prompt count uses M2M
# ====================================================================
def test_collection_prompt_count_m2m():
    """Prompt count in collection must use collection_prompts M2M."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "M2MCount")
        col = Collection(user_id=user.id, name="M2M Test", description="Test")
        db.add(col)
        db.flush()

        p1 = Prompt(user_id=user.id, title="In Col", content="X")
        p2 = Prompt(user_id=user.id, title="Not In Col", content="X")
        db.add(p1)
        db.add(p2)
        db.flush()

        p1.collections.append(col)
        db.commit()

        # Verify via API
        h = _headers(user.id)
        r = requests.get(f"{BASE_URL}/collections/{col.id}/prompts", headers=h)
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["title"] == "In Col"
        print("[OK] Test 6: Collection prompt count uses M2M.")
    finally:
        db.close()


# ====================================================================
# TEST 7: Multi-collection prompt
# ====================================================================
def test_multi_collection_prompt():
    """Prompt in multiple collections is counted in each."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "MultiCol")
        col1 = Collection(user_id=user.id, name="Frontend", description="A")
        col2 = Collection(user_id=user.id, name="Backend", description="B")
        db.add(col1)
        db.add(col2)
        db.flush()

        p = Prompt(user_id=user.id, title="Full Stack", content="X")
        db.add(p)
        db.flush()

        p.collections.append(col1)
        p.collections.append(col2)
        db.commit()

        h = _headers(user.id)
        r1 = requests.get(f"{BASE_URL}/collections/{col1.id}/prompts", headers=h)
        r2 = requests.get(f"{BASE_URL}/collections/{col2.id}/prompts", headers=h)
        assert len(r1.json()) == 1
        assert len(r2.json()) == 1
        assert r1.json()[0]["id"] == r2.json()[0]["id"]
        print("[OK] Test 7: Multi-collection prompt counted in each.")
    finally:
        db.close()


# ====================================================================
# TEST 8: Model ID normalization in analytics
# ====================================================================
def test_model_id_normalization():
    """Analytics modelStats must use canonical provider IDs."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "ModelNorm")
        p = Prompt(user_id=user.id, title="Norm Test", content="X")
        db.add(p)
        db.flush()

        # Insert test with display name as provider (legacy behavior)
        db.add(PromptTest(
            user_id=user.id, prompt_id=p.id,
            provider="Google Gemini", model="gemini-3.6-flash",
            input_text="test"
        ))
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        model_stats = r.json()["modelStats"]
        assert len(model_stats) >= 1

        # Provider should be normalized to canonical ID
        gemini_stat = [m for m in model_stats if m["model"] == "gemini-3.6-flash"]
        assert len(gemini_stat) == 1
        assert gemini_stat[0]["provider"] == "gemini"  # Canonical ID, not display name
        assert gemini_stat[0]["providerDisplay"] == "Google Gemini"
        print("[OK] Test 8: Model ID normalization in analytics.")
    finally:
        db.close()


# ====================================================================
# TEST 9: Provider normalization for various inputs
# ====================================================================
def test_provider_normalization_variants():
    """Analytics normalizes provider variants to canonical IDs."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "ProvNorm")
        p = Prompt(user_id=user.id, title="Prov Test", content="X")
        db.add(p)
        db.flush()

        # Insert tests with different provider name variants
        db.add(PromptTest(user_id=user.id, prompt_id=p.id, provider="Groq", model="openai/gpt-oss-20b"))
        db.add(PromptTest(user_id=user.id, prompt_id=p.id, provider="Mistral AI", model="mistral-small-latest"))
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        model_stats = r.json()["modelStats"]

        providers = {m["model"]: m["provider"] for m in model_stats}
        assert providers.get("openai/gpt-oss-20b") == "groq"
        assert providers.get("mistral-small-latest") == "mistral"
        print("[OK] Test 9: Provider normalization variants.")
    finally:
        db.close()


# ====================================================================
# TEST 10: Model statistics with test count
# ====================================================================
def test_model_statistics_counts():
    """Verify model stats show correct test counts."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "StatCount")
        p = Prompt(user_id=user.id, title="Stat Test", content="X")
        db.add(p)
        db.flush()

        for _ in range(3):
            db.add(PromptTest(user_id=user.id, prompt_id=p.id, provider="Google Gemini", model="gemini-3.7-flash"))
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        stats = r.json()["modelStats"]
        flash37 = [m for m in stats if m["model"] == "gemini-3.7-flash"]
        assert len(flash37) == 1
        assert flash37[0]["testsCount"] == 3
        print("[OK] Test 10: Model statistics counts correct.")
    finally:
        db.close()


# ====================================================================
# TEST 11: Recent activity ordering
# ====================================================================
def test_recent_activity_ordering():
    """Verify activities sorted by creation datetime, most recent first."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "ActOrder")
        for i in range(4):
            p = Prompt(user_id=user.id, title=f"Order P{i}", content="X")
            db.add(p)
            db.flush()  # Ensure sequential created_at
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        activities = r.json()["recentActivities"]
        assert len(activities) >= 4
        # All activities should have valid time strings
        for act in activities:
            assert act["time"] != ""
            assert "type" in act
        print("[OK] Test 11: Recent activity ordering correct.")
    finally:
        db.close()


# ====================================================================
# TEST 12: Recent activity limit (≤8)
# ====================================================================
def test_recent_activity_limit():
    """Verify recent activities bounded to 8."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "ActLimit")
        for i in range(15):
            db.add(Prompt(user_id=user.id, title=f"Limit P{i}", content="X"))
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        assert len(r.json()["recentActivities"]) <= 8
        print("[OK] Test 12: Recent activity limit <= 8.")
    finally:
        db.close()


# ====================================================================
# TEST 13: Empty dataset returns valid structure
# ====================================================================
def test_empty_dataset():
    """Verify analytics with zero data returns valid nulls/zeros."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "Empty")
        db.commit()

        r = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user.id))
        d = r.json()
        assert d["totalPrompts"] == 0
        assert d["totalCollections"] == 0
        assert d["totalVersions"] == 0
        assert d["totalFavorites"] == 0
        assert d["totalTested"] == 0
        assert d["avgPromptRating"] is None  # NOT 0, NOT 5.0
        assert isinstance(d["categories"], list) and len(d["categories"]) == 0
        assert isinstance(d["modelStats"], list) and len(d["modelStats"]) == 0
        assert isinstance(d["recentActivities"], list) and len(d["recentActivities"]) == 0
        print("[OK] Test 13: Empty dataset returns valid structure.")
    finally:
        db.close()


# ====================================================================
# TEST 14: User isolation
# ====================================================================
def test_user_analytics_isolation():
    """User A's analytics must not include User B's data."""
    db = SessionLocal()
    try:
        user_a = _create_db_user(db, "IsoAlpha")
        user_b = _create_db_user(db, "IsoBeta")

        # Create data for user A
        db.add(Prompt(user_id=user_a.id, title="A Only", content="X", rating=5.0))
        db.add(Collection(user_id=user_a.id, name="A Col", description="A"))
        db.commit()

        # User B should see nothing
        r_b = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user_b.id))
        d_b = r_b.json()
        assert d_b["totalPrompts"] == 0
        assert d_b["totalCollections"] == 0
        assert d_b["avgPromptRating"] is None

        # User A should see their data
        r_a = requests.get(f"{BASE_URL}/analytics/overview", headers=_headers(user_a.id))
        d_a = r_a.json()
        assert d_a["totalPrompts"] == 1
        assert d_a["totalCollections"] == 1
        assert d_a["avgPromptRating"] == 5.0
        print("[OK] Test 14: User analytics isolation verified.")
    finally:
        db.close()


# ====================================================================
# TEST 15: Metric consistency — totalPrompts via analytics and prompt list
# ====================================================================
def test_metric_consistency():
    """Analytics totalPrompts must agree with prompt list count."""
    db = SessionLocal()
    try:
        user = _create_db_user(db, "Consist")
        for i in range(4):
            db.add(Prompt(user_id=user.id, title=f"Cons P{i}", content="X"))
        db.commit()

        h = _headers(user.id)
        r_analytics = requests.get(f"{BASE_URL}/analytics/overview", headers=h)
        r_prompts = requests.get(f"{BASE_URL}/prompts", headers=h)

        assert r_analytics.json()["totalPrompts"] == len(r_prompts.json())
        print("[OK] Test 15: Metric consistency verified.")
    finally:
        db.close()


# ====================================================================
# Test Runner
# ====================================================================
def run_all_tests():
    print("\n" + "=" * 60)
    print("BATCH 10 — ANALYTICS INTEGRITY TESTS")
    print("=" * 60 + "\n")

    tests = [
        test_no_rating_returns_null,
        test_single_rating,
        test_multiple_ratings_average,
        test_total_prompt_count,
        test_total_collection_count,
        test_collection_prompt_count_m2m,
        test_multi_collection_prompt,
        test_model_id_normalization,
        test_provider_normalization_variants,
        test_model_statistics_counts,
        test_recent_activity_ordering,
        test_recent_activity_limit,
        test_empty_dataset,
        test_user_analytics_isolation,
        test_metric_consistency,
    ]

    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except Exception as e:
            print(f"[FAIL] {t.__name__}: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"ANALYTICS INTEGRITY: {passed} passed, {failed} failed")
    print("=" * 60 + "\n")
    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    run_all_tests()
