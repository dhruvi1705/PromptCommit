"""
End-to-End Verification Test Suite for:
1. Analytics Date Range (Multiple dates, zero-filled continuity, user isolation, 7d/30d filter)
2. Collaboration Comments (JWT user derivation, RBAC authorization, persistence, 403 on unauthorized)
3. Collaboration Reviews (Lifecycle DRAFT -> IN_REVIEW -> CHANGES_REQUESTED -> IN_REVIEW -> APPROVED, Viewer rejection 403, DB persistence)
"""
import uuid
import datetime
import requests
import pytest
from app.core.database import SessionLocal
from app.models.user import User
from app.models.prompt import Prompt
from app.models.prompt_version import PromptVersion
from app.models.prompt_test import PromptTest
from app.models.prompt_share import PromptShare
from app.models.prompt_comment import PromptComment
from app.core.security import create_access_token, hash_password

BASE_URL = "http://localhost:8000/api"

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _create_user(db, name_prefix="TestUser"):
    uid = f"usr_{uuid.uuid4().hex[:12]}"
    user = User(
        id=uid,
        name=f"{name_prefix} {uid[:6]}",
        username=f"u_{uuid.uuid4().hex[:10]}",
        email=f"{uid[:10]}@testcommit.dev",
        password_hash=hash_password("Password123!")
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def _auth_header(user):
    token = create_access_token(subject=user.id)
    return {"Authorization": f"Bearer {token}"}

# ==============================================================================
# 1. ANALYTICS MULTIPLE DATES & TIME-SERIES CONTINUITY
# ==============================================================================
def test_analytics_multi_date_time_series(db_session):
    user = _create_user(db_session, "AnalyticsUser")
    headers = _auth_header(user)

    p_id = f"p_{uuid.uuid4().hex[:12]}"
    prompt = Prompt(
        id=p_id,
        user_id=user.id,
        title="Analytics Test Prompt",
        category="Testing",
        content="System instruction"
    )
    db_session.add(prompt)
    db_session.commit()

    # Seed tests across 4 distinct past dates
    today = datetime.date.today()
    dates_to_seed = [
        (today - datetime.timedelta(days=5), 3),
        (today - datetime.timedelta(days=3), 7),
        (today - datetime.timedelta(days=2), 2),
        (today - datetime.timedelta(days=0), 5),
    ]

    for d, count in dates_to_seed:
        dt = datetime.datetime.combine(d, datetime.time(12, 0, 0))
        for _ in range(count):
            test_rec = PromptTest(
                id=f"test_{uuid.uuid4().hex[:12]}",
                prompt_id=p_id,
                user_id=user.id,
                model="gemini-3.6-flash",
                provider="gemini",
                response_time_ms=120,
                rating=4,
                created_at=dt
            )
            db_session.add(test_rec)
    db_session.commit()

    # Query overview endpoint
    res = requests.get(f"{BASE_URL}/analytics/overview?days=7", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # 1. Verify dailyActivity contains continuous days (exactly 7 entries)
    daily = data.get("dailyActivity") or []
    assert len(daily) == 7, f"Expected 7 continuous days in 7d range, got {len(daily)}"

    # 2. Check that multiple dates have test counts > 0 matching real DB records
    active_days = [item for item in daily if item["tests"] > 0]
    assert len(active_days) >= 4, f"Expected at least 4 active days, got {len(active_days)}"

    # 3. Check that non-active days inside the range have tests == 0 (continuous zero-fill)
    zero_days = [item for item in daily if item["tests"] == 0]
    assert len(zero_days) > 0, "Expected empty dates to be represented as zero"

    # 4. Check 30d range
    res_30 = requests.get(f"{BASE_URL}/analytics/overview?range=30d", headers=headers)
    assert res_30.status_code == 200
    daily_30 = res_30.json().get("dailyActivity") or []
    assert len(daily_30) == 30, f"Expected 30 continuous days in 30d range, got {len(daily_30)}"

    # 5. User isolation check: Another user must see 0 tests
    other_user = _create_user(db_session, "IsolatedUser")
    other_res = requests.get(f"{BASE_URL}/analytics/overview?days=7", headers=_auth_header(other_user))
    assert other_res.status_code == 200
    other_daily = other_res.json().get("dailyActivity") or []
    assert all(item["tests"] == 0 for item in other_daily), "Other user saw test data from another user!"


# ==============================================================================
# 2. COLLABORATION COMMENTS E2E
# ==============================================================================
def test_collaboration_comments_lifecycle_and_rbac(db_session):
    owner = _create_user(db_session, "OwnerUser")
    collaborator = _create_user(db_session, "CollabUser")
    stranger = _create_user(db_session, "StrangerUser")

    p_id = f"p_{uuid.uuid4().hex[:12]}"
    prompt = Prompt(
        id=p_id,
        user_id=owner.id,
        title="Comment RBAC Test Prompt",
        category="General",
        content="Instruction content",
        version="v1.0"
    )
    db_session.add(prompt)
    db_session.commit()

    # Share prompt with collaborator as Reviewer via PromptShare
    share_rec = PromptShare(
        id=f"shr_{uuid.uuid4().hex[:12]}",
        prompt_id=p_id,
        shared_with_email=collaborator.email,
        shared_with_name=collaborator.name,
        role="Reviewer"
    )
    db_session.add(share_rec)
    db_session.commit()

    # 1. Authorized collaborator creates comment (linked to v1.0)
    collab_headers = _auth_header(collaborator)
    post_res = requests.post(f"{BASE_URL}/prompts/{p_id}/comments", headers=collab_headers, json={
        "content": "Collaborator review note on v1.0",
        "version_tag": "v1.0"
    })
    assert post_res.status_code in [200, 201], post_res.text
    created_comment = post_res.json()
    assert created_comment["content"] == "Collaborator review note on v1.0"
    assert created_comment["versionTag"] == "v1.0"
    # Authenticated user derived from JWT
    assert created_comment["userId"] == collaborator.id

    # 2. Verify comment is actually persisted in MySQL
    db_session.rollback()
    db_comment = db_session.query(PromptComment).filter(PromptComment.id == created_comment["id"]).first()
    assert db_comment is not None
    assert db_comment.content == "Collaborator review note on v1.0"

    # 3. Retrieve comments via GET
    get_res = requests.get(f"{BASE_URL}/prompts/{p_id}/comments", headers=_auth_header(owner))
    assert get_res.status_code == 200
    comments_list = get_res.json()
    assert any(c["id"] == created_comment["id"] for c in comments_list)

    # 4. Unauthorized user (stranger without access) receives 403 Forbidden
    stranger_headers = _auth_header(stranger)
    denied_res = requests.post(f"{BASE_URL}/prompts/{p_id}/comments", headers=stranger_headers, json={
        "content": "Unauthorized intrusion attempt"
    })
    assert denied_res.status_code == 403, f"Expected 403 for unauthorized user, got {denied_res.status_code}"


# ==============================================================================
# 3. COLLABORATION REVIEWS E2E
# ==============================================================================
def test_collaboration_reviews_lifecycle_and_rbac(db_session):
    owner = _create_user(db_session, "ReviewOwner")
    reviewer = _create_user(db_session, "ReviewReviewer")
    viewer = _create_user(db_session, "ReviewViewer")
    stranger = _create_user(db_session, "ReviewStranger")

    p_id = f"p_{uuid.uuid4().hex[:12]}"
    prompt = Prompt(
        id=p_id,
        user_id=owner.id,
        title="Review Lifecycle Prompt",
        category="General",
        content="Version 1.0 content",
        version="v1.0"
    )
    v1 = PromptVersion(
        id=f"ver_{uuid.uuid4().hex[:12]}",
        prompt_id=p_id,
        version_number="v1.0",
        commit_message="Initial commit",
        content="Version 1.0 content",
        review_status="DRAFT"
    )
    db_session.add_all([prompt, v1])
    db_session.commit()

    # Assign Reviewer role
    db_session.add(PromptShare(
        id=f"shr_{uuid.uuid4().hex[:12]}",
        prompt_id=p_id,
        shared_with_email=reviewer.email,
        shared_with_name=reviewer.name,
        role="Reviewer"
    ))
    # Assign Viewer role
    db_session.add(PromptShare(
        id=f"shr_{uuid.uuid4().hex[:12]}",
        prompt_id=p_id,
        shared_with_email=viewer.email,
        shared_with_name=viewer.name,
        role="Viewer"
    ))
    db_session.commit()

    owner_headers = _auth_header(owner)
    reviewer_headers = _auth_header(reviewer)
    viewer_headers = _auth_header(viewer)
    stranger_headers = _auth_header(stranger)

    # 1. Owner requests review -> transitions to IN_REVIEW
    req_res = requests.post(f"{BASE_URL}/prompts/{p_id}/versions/v1.0/request-review", headers=owner_headers, json={
        "reviewer_email": reviewer.email,
        "message": "Please review initial release."
    })
    assert req_res.status_code == 200, req_res.text
    assert req_res.json()["reviewStatus"] == "IN_REVIEW"

    # Verify status in DB
    db_session.rollback()
    db_v = db_session.query(PromptVersion).filter(PromptVersion.id == v1.id).first()
    assert db_v.review_status == "IN_REVIEW"

    # 2. Viewer attempts to approve -> Must be rejected with 403 Forbidden!
    viewer_res = requests.post(f"{BASE_URL}/prompts/{p_id}/versions/v1.0/review-action", headers=viewer_headers, json={
        "action": "approve",
        "feedback": "Viewer trying to approve"
    })
    assert viewer_res.status_code == 403, f"Expected 403 for Viewer, got {viewer_res.status_code}"

    # 3. Stranger attempts to review -> 403 or 404
    stranger_res = requests.post(f"{BASE_URL}/prompts/{p_id}/versions/v1.0/review-action", headers=stranger_headers, json={
        "action": "approve"
    })
    assert stranger_res.status_code in [403, 404]

    # 4. Reviewer requests changes without required feedback -> 400 Bad Request
    fail_chg_res = requests.post(f"{BASE_URL}/prompts/{p_id}/versions/v1.0/review-action", headers=reviewer_headers, json={
        "action": "request_changes",
        "feedback": ""
    })
    assert fail_chg_res.status_code == 400

    # 5. Reviewer requests changes with reason -> CHANGES_REQUESTED
    chg_res = requests.post(f"{BASE_URL}/prompts/{p_id}/versions/v1.0/review-action", headers=reviewer_headers, json={
        "action": "request_changes",
        "feedback": "Needs safety prompt constraints."
    })
    assert chg_res.status_code == 200
    assert chg_res.json()["reviewStatus"] == "CHANGES_REQUESTED"

    # Verify PromptVersion updated in MySQL
    db_session.rollback()
    db_v2 = db_session.query(PromptVersion).filter(PromptVersion.id == v1.id).first()
    assert db_v2.review_status == "CHANGES_REQUESTED"
    assert db_v2.review_feedback == "Needs safety prompt constraints."

    # 6. Re-request review -> IN_REVIEW
    re_req = requests.post(f"{BASE_URL}/prompts/{p_id}/versions/v1.0/request-review", headers=owner_headers, json={
        "reviewer_email": reviewer.email,
        "message": "Updated constraints added."
    })
    assert re_req.status_code == 200
    assert re_req.json()["reviewStatus"] == "IN_REVIEW"

    # 7. Reviewer approves -> APPROVED
    app_res = requests.post(f"{BASE_URL}/prompts/{p_id}/versions/v1.0/review-action", headers=reviewer_headers, json={
        "action": "approve",
        "feedback": "Looks great, approved!"
    })
    assert app_res.status_code == 200
    assert app_res.json()["reviewStatus"] == "APPROVED"

    # 8. Check review status endpoint
    status_res = requests.get(f"{BASE_URL}/prompts/{p_id}/versions/v1.0/review-status", headers=reviewer_headers)
    assert status_res.status_code == 200
    assert status_res.json()["reviewStatus"] == "APPROVED"
