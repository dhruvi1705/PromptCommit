"""
BATCH 10 — Database Integrity Tests
Tests: migration registry, idempotency, schema verification, PromptTest FK/cascade,
legacy collection backfill, cross-user prevention, and data integrity.
"""
import pytest_lazyfixture
import pytest_lazyfixture
from groq.types.chat import chat_completion_assistant_message_param
from groq.types.chat import chat_completion_assistant_message_param
#pyrefly: ignore [missing-import]
import pytest_lazyfixture
import pytest_lazyfixture
import pytest_lazyfixture
import pytest_lazyfixture
import pytest_lazyfixture
import pytest_lazyfixture
import pytest_lazyfixture
import uuid
import requests
import time
from app.core.database import engine, SessionLocal, verify_schema, run_migrations, _ensure_migration_table, _is_migration_applied, Base
from app.core.migration import migrate_legacy_collections
from app.models.prompt import Prompt
from app.models.prompt_test import PromptTest
from app.models.collection import Collection, collection_prompts
from app.models.user import User
from app.core.security import create_access_token, hash_password
from sqlalchemy import text, inspect

BASE_URL = "http://localhost:8000/api"


def _create_test_user(db, prefix="db_test"):
    """Create a test user directly in DB for isolation."""
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


def _get_auth_headers(user_id):
    """Generate auth headers for a user."""
    token = create_access_token(subject=user_id)
    return {"Authorization": f"Bearer {token}"}


# ====================================================================
# TEST 1: Schema migrations table exists
# ====================================================================
def test_migration_table_exists():
    """Verify schema_migrations table is created."""
    with engine.connect() as conn:
        _ensure_migration_table(conn)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert "schema_migrations" in tables
    print("[OK] Test 1: schema_migrations table exists.")


# ====================================================================
# TEST 2: Migrations are idempotent
# ====================================================================
def test_migration_idempotency():
    """Run migrations twice — second run should be a no-op."""
    run_migrations()  # First run
    run_migrations()  # Second run — should skip all
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM schema_migrations"))
        count = result.scalar()
        assert count >= 2  # At least our 2 registered migrations
    print("[OK] Test 2: Migration idempotency verified.")


# ====================================================================
# TEST 3: Migration state tracking
# ====================================================================
def test_migration_state_tracking():
    """Verify applied migrations are recorded."""
    run_migrations()
    with engine.connect() as conn:
        assert _is_migration_applied(conn, "001_add_review_workflow_fields")
        assert _is_migration_applied(conn, "002_add_collection_default_tags")
        assert not _is_migration_applied(conn, "999_nonexistent_migration")
    print("[OK] Test 3: Migration state tracking verified.")


# ====================================================================
# TEST 4: Schema verification utility
# ====================================================================
def test_schema_verification():
    """Verify schema verification returns expected structure."""
    results = verify_schema()
    assert isinstance(results, dict)
    assert "missing_tables" in results
    assert "present_tables" in results
    assert "column_checks" in results
    assert "schema_migrations_exists" in results
    assert results["schema_migrations_exists"] is True

    # All critical tables should be present
    for tbl in ["prompts", "collections", "collection_prompts", "prompt_tests", "prompt_versions"]:
        assert tbl in results["present_tables"], f"Missing table: {tbl}"
        assert results["column_checks"][tbl]["status"] == "OK", \
            f"Column issues in {tbl}: {results['column_checks'][tbl]}"
    print("[OK] Test 4: Schema verification passed.")


# ====================================================================
# TEST 5: Legacy collection backfill is idempotent
# ====================================================================
def test_legacy_backfill_idempotency():
    """Run backfill twice — no duplicate associations on second run."""
    stats1 = migrate_legacy_collections()
    stats2 = migrate_legacy_collections()
    assert stats2["associations_created"] == 0, f"Second run created {stats2['associations_created']} duplicates"
    print("[OK] Test 5: Legacy backfill idempotency verified.")


# ====================================================================
# TEST 6: Cross-user collection prevention in backfill
# ====================================================================
def test_cross_user_collection_prevention():
    """Verify backfill never links User A's prompt to User B's collection."""
    db = SessionLocal()
    try:
        user_a = _create_test_user(db, "CrossA")
        user_b = _create_test_user(db, "CrossB")

        # Create a collection for User B
        col_b = Collection(user_id=user_b.id, name="Engineering", description="B's col")
        db.add(col_b)
        db.flush()

        # Create a prompt for User A with matching legacy name
        p_a = Prompt(
            user_id=user_a.id,
            title="Cross Test",
            content="Test content",
            collection_name="Engineering"
        )
        db.add(p_a)
        db.commit()

        # Run backfill
        migrate_legacy_collections()

        # Verify User A's prompt is NOT linked to User B's collection
        db.refresh(p_a)
        for c in p_a.collections:
            assert c.user_id == user_a.id, f"Cross-user association detected: prompt user={user_a.id}, col user={c.user_id}"

        print("[OK] Test 6: Cross-user collection prevention verified.")
    finally:
        db.close()


# ====================================================================
# TEST 7: General collection never created by backfill
# ====================================================================
def test_no_general_collection_created():
    """Verify backfill skips 'General' collection_name and never creates one."""
    db = SessionLocal()
    try:
        user = _create_test_user(db, "NoGen")
        p = Prompt(
            user_id=user.id,
            title="General Test",
            content="Test",
            collection_name="General"
        )
        db.add(p)
        db.commit()

        migrate_legacy_collections()

        general_cols = db.query(Collection).filter(
            Collection.user_id == user.id,
            Collection.name.ilike("General")
        ).all()
        assert len(general_cols) == 0, f"Found {len(general_cols)} General collections"
        print("[OK] Test 7: No General collection created.")
    finally:
        db.close()


# ====================================================================
# TEST 8: PromptTest FK SET NULL behavior
# ====================================================================
def test_prompt_test_fk_set_null():
    """Verify deleting a prompt sets PromptTest.prompt_id to NULL, not delete."""
    db = SessionLocal()
    try:
        user = _create_test_user(db, "FKTest")
        p = Prompt(
            id=f"p_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            title="FK Test Prompt",
            content="Test content"
        )
        db.add(p)
        db.flush()

        test = PromptTest(
            user_id=user.id,
            prompt_id=p.id,
            provider="Google Gemini",
            model="gemini-3.6-flash",
            input_text="test input"
        )
        db.add(test)
        db.commit()

        test_id = test.id
        prompt_id = p.id

        # Delete prompt
        db.delete(p)
        db.commit()

        # PromptTest should still exist with prompt_id = NULL
        remaining_test = db.query(PromptTest).filter(PromptTest.id == test_id).first()
        assert remaining_test is not None, "PromptTest was deleted instead of SET NULL"
        assert remaining_test.prompt_id is None, f"prompt_id should be NULL, got {remaining_test.prompt_id}"
        print("[OK] Test 8: PromptTest FK SET NULL behavior verified.")
    finally:
        db.close()


# ====================================================================
# TEST 9: Prompt deletion does not orphan versions/tags/shares
# ====================================================================
def test_prompt_deletion_cascades_correctly():
    """Verify deleting a prompt cascades to versions, tags, etc. but preserves tests."""
    db = SessionLocal()
    try:
        from app.models.prompt_version import PromptVersion
        from app.models.prompt import PromptTag

        user = _create_test_user(db, "CascTest")
        p = Prompt(
            id=f"p_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            title="Cascade Test",
            content="Test"
        )
        db.add(p)
        db.flush()

        db.add(PromptTag(prompt_id=p.id, tag="TestTag"))
        db.add(PromptVersion(
            prompt_id=p.id,
            version_number="v1.0",
            commit_message="Test",
            content="Test"
        ))
        db.add(PromptTest(
            user_id=user.id,
            prompt_id=p.id,
            provider="Google Gemini",
            model="gemini-3.6-flash"
        ))
        db.commit()

        prompt_id = p.id
        db.delete(p)
        db.commit()

        # Versions and tags should be gone (CASCADE)
        assert db.query(PromptVersion).filter(PromptVersion.prompt_id == prompt_id).count() == 0
        assert db.query(PromptTag).filter(PromptTag.prompt_id == prompt_id).count() == 0

        # Tests should remain (SET NULL)
        remaining = db.query(PromptTest).filter(PromptTest.user_id == user.id).all()
        assert len(remaining) >= 1
        for t in remaining:
            assert t.prompt_id is None  # SET NULL

        print("[OK] Test 9: Cascade + SET NULL behavior correct.")
    finally:
        db.close()


# ====================================================================
# TEST 10: Default values match model definitions
# ====================================================================
def test_default_values():
    """Verify model default values are correct."""
    db = SessionLocal()
    try:
        user = _create_test_user(db, "DefaultTest")
        p = Prompt(
            user_id=user.id,
            title="Default Test",
            content="Content"
        )
        db.add(p)
        db.commit()
        db.refresh(p)

        assert p.category == "Coding"
        assert p.collection_name is None  # Not "General"
        assert p.target_model == "gemini-3.6-flash"
        assert p.version == "v1.0"
        assert p.rating is None  # Not 0 or 5.0
        assert p.rating_count == 0
        assert p.is_private is True
        print("[OK] Test 10: Default values verified.")
    finally:
        db.close()


# ====================================================================
# TEST 11: Foreign key constraints exist
# ====================================================================
def test_foreign_key_constraints():
    """Verify foreign keys exist on critical tables."""
    inspector = inspect(engine)

    # Prompt -> User
    prompt_fks = inspector.get_foreign_keys("prompts")
    prompt_fk_cols = [fk["constrained_columns"] for fk in prompt_fks]
    assert any("user_id" in cols for cols in prompt_fk_cols), "Missing prompts.user_id FK"

    # PromptTest -> Prompt (SET NULL)
    test_fks = inspector.get_foreign_keys("prompt_tests")
    test_fk_tables = {fk["referred_table"]: fk for fk in test_fks}
    assert "prompts" in test_fk_tables, "Missing prompt_tests.prompt_id FK"

    # collection_prompts -> both tables
    cp_fks = inspector.get_foreign_keys("collection_prompts")
    cp_refs = {fk["referred_table"] for fk in cp_fks}
    assert "collections" in cp_refs, "Missing collection_prompts FK to collections"
    assert "prompts" in cp_refs, "Missing collection_prompts FK to prompts"

    print("[OK] Test 11: Foreign key constraints verified.")


# ====================================================================
# TEST 12: Junction table integrity
# ====================================================================
def test_junction_table_integrity():
    """Verify collection_prompts has proper structure."""
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("collection_prompts")}
    assert "collection_id" in cols
    assert "prompt_id" in cols
    print("[OK] Test 12: Junction table integrity verified.")


# ====================================================================
# TEST 13: Schema verification identifies missing columns
# ====================================================================
def test_schema_verify_missing_detection():
    """Verify schema verification correctly identifies present columns."""
    results = verify_schema()
    # All critical columns should be present
    for tbl, check in results["column_checks"].items():
        assert check["status"] == "OK", f"Unexpected column issue in {tbl}: {check}"
    print("[OK] Test 13: Schema verification column detection correct.")


# ====================================================================
# TEST 14: Duplicate backfill prevention
# ====================================================================
def test_duplicate_backfill_prevention():
    """Verify running backfill multiple times creates no duplicates."""
    db = SessionLocal()
    try:
        user = _create_test_user(db, "DupCheck")
        col = Collection(user_id=user.id, name="DupCol", description="Test")
        db.add(col)
        db.flush()

        p = Prompt(
            user_id=user.id,
            title="Dup Test",
            content="Content",
            collection_name="DupCol"
        )
        db.add(p)
        db.commit()

        # Run backfill 3 times
        migrate_legacy_collections()
        migrate_legacy_collections()
        migrate_legacy_collections()

        # Count associations
        db.refresh(p)
        assert len(p.collections) == 1, f"Expected 1 association, got {len(p.collections)}"
        print("[OK] Test 14: Duplicate backfill prevention verified.")
    finally:
        db.close()


# ====================================================================
# TEST 15: Analytics user isolation
# ====================================================================
def test_analytics_user_isolation_db():
    """Verify analytics queries are user-scoped at the DB level."""
    db = SessionLocal()
    try:
        user_a = _create_test_user(db, "IsoA")
        user_b = _create_test_user(db, "IsoB")

        # Create data for user A only
        p_a = Prompt(user_id=user_a.id, title="A's Prompt", content="Content A")
        db.add(p_a)
        db.commit()

        headers_b = _get_auth_headers(user_b.id)
        r = requests.get(f"{BASE_URL}/analytics/overview", headers=headers_b)
        assert r.status_code == 200
        data = r.json()
        assert data["totalPrompts"] == 0
        assert data["totalCollections"] == 0
        assert data["avgPromptRating"] is None
        print("[OK] Test 15: Analytics user isolation verified.")
    finally:
        db.close()


# ====================================================================
# ====================================================================
# TEST 16: Migration failure handling
# ====================================================================
def test_migration_failure_handling():
    """Verify that a failing migration statement rolls back and raises MigrationError."""
    from app.core.database import MigrationError
    failing_migrations = [
        {
            "id": "999_test_failure_migration",
            "description": "Failing test migration",
            "statements": ["ALTER TABLE prompts ADD COLUMN invalid_syntax_error_col INT FOOBAR_SYNTAX_ERROR"]
        }
    ]
    class pytest:
        pass
    with pytest.raises(MigrationError):
        run_migrations(migrations=failing_migrations, raise_on_error=True)

    with engine.connect() as conn:
        assert not _is_migration_applied(conn, "999_test_failure_migration")
    print("[OK] Test 16: Migration failure handling verified.")


# ====================================================================
# Test Runner
# ====================================================================
def run_all_tests():
    print("\n" + "=" * 60)
    print("BATCH 10 — DATABASE INTEGRITY TESTS")
    print("=" * 60 + "\n")

    tests = [
        test_migration_table_exists,
        test_migration_idempotency,
        test_migration_state_tracking,
        test_schema_verification,
        test_legacy_backfill_idempotency,
        test_cross_user_collection_prevention,
        test_no_general_collection_created,
        test_prompt_test_fk_set_null,
        test_prompt_deletion_cascades_correctly,
        test_default_values,
        test_foreign_key_constraints,
        test_junction_table_integrity,
        test_schema_verify_missing_detection,
        test_duplicate_backfill_prevention,
        test_analytics_user_isolation_db,
        test_migration_failure_handling,
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
    print(f"DATABASE INTEGRITY: {passed} passed, {failed} failed")
    print("=" * 60 + "\n")
    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    run_all_tests()
