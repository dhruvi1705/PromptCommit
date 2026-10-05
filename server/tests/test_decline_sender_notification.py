"""
Test suite for Collaboration Invitation Decline & Sender Notification Lifecycle.
Tests:
- Account A invites Account B
- Account B declines
- Invitation becomes inactive
- Notification created for Account A (inviter) with type COLLABORATION_INVITATION_DECLINED
- Account B and unrelated Account C do NOT receive sender notifications (isolation)
- Duplicate decline requests do NOT create duplicate notifications
"""
import uuid
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, get_db
from app.models.user import User
from app.models.collaboration_invitation import CollaborationInvitation
from app.models.notification import Notification
from app.core.security import create_access_token, hash_password

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

class TestDeclineSenderNotification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=test_engine)
        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)

    def setUp(self):
        self.db = TestingSessionLocal()
        self.db.query(Notification).delete()
        self.db.query(CollaborationInvitation).delete()
        self.db.query(User).delete()
        self.db.commit()

        # User A (Inviter / Sender)
        self.user_a = User(
            id="usr_a_123",
            name="Alice Inviter",
            username="alice_inviter",
            email="alice@promptcommit.dev",
            password_hash=hash_password("Password123!")
        )
        # User B (Recipient)
        self.user_b = User(
            id="usr_b_456",
            name="Bob Recipient",
            username="bob_recipient",
            email="bob@promptcommit.dev",
            password_hash=hash_password("Password123!")
        )
        # User C (Unrelated Stranger)
        self.user_c = User(
            id="usr_c_789",
            name="Charlie Stranger",
            username="charlie_stranger",
            email="charlie@promptcommit.dev",
            password_hash=hash_password("Password123!")
        )
        self.db.add_all([self.user_a, self.user_b, self.user_c])
        self.db.commit()

        self.token_a = create_access_token(self.user_a.id)
        self.token_b = create_access_token(self.user_b.id)
        self.token_c = create_access_token(self.user_c.id)

        self.headers_a = {"Authorization": f"Bearer {self.token_a}"}
        self.headers_b = {"Authorization": f"Bearer {self.token_b}"}
        self.headers_c = {"Authorization": f"Bearer {self.token_c}"}

    def tearDown(self):
        self.db.close()

    def test_decline_invitation_creates_sender_notification(self):
        """1. Account B declines Account A's invitation -> Account A gets notification."""
        # Create invitation from A to B
        res_inv = self.client.post("/api/collaboration/invitations", headers=self.headers_a, json={
            "email": self.user_b.email,
            "role": "Reviewer",
            "scope": "workspace"
        })
        self.assertIn(res_inv.status_code, [200, 201])
        inv_data = res_inv.json()
        token = inv_data.get("token") or inv_data.get("invitationUrl", "").split("/")[-1]

        # Account B declines invitation
        res_dec = self.client.post(f"/api/invitations/{token}/decline", headers=self.headers_b)
        self.assertEqual(res_dec.status_code, 200)
        self.assertEqual(res_dec.json()["message"], "Invitation declined.")

        # Check invitation state in DB
        inv_db = self.db.query(CollaborationInvitation).filter(CollaborationInvitation.token == token).first()
        self.assertIsNotNone(inv_db)
        self.assertFalse(inv_db.is_active)

        # Check Account A (Sender) notifications
        res_notif_a = self.client.get("/api/notifications", headers=self.headers_a)
        self.assertEqual(res_notif_a.status_code, 200)
        items_a = res_notif_a.json()["items"]
        decline_notifs_a = [n for n in items_a if n["type"] == "COLLABORATION_INVITATION_DECLINED"]

        self.assertEqual(len(decline_notifs_a), 1)
        notif_a = decline_notifs_a[0]
        self.assertEqual(notif_a["userId"], self.user_a.id)
        self.assertEqual(notif_a["senderId"], self.user_b.id)
        self.assertEqual(notif_a["invitationId"], inv_db.id)
        self.assertIn("Bob Recipient", notif_a["message"])
        self.assertIn("declined your collaboration invitation", notif_a["message"])

        # Check Account B (Recipient) notifications -> NO sender decline notification
        res_notif_b = self.client.get("/api/notifications", headers=self.headers_b)
        self.assertEqual(res_notif_b.status_code, 200)
        items_b = res_notif_b.json()["items"]
        decline_notifs_b = [n for n in items_b if n["type"] == "COLLABORATION_INVITATION_DECLINED"]
        self.assertEqual(len(decline_notifs_b), 0)

        # Check Account C (Stranger) notifications -> NOTHING
        res_notif_c = self.client.get("/api/notifications", headers=self.headers_c)
        self.assertEqual(res_notif_c.status_code, 200)
        items_c = res_notif_c.json()["items"]
        self.assertEqual(len(items_c), 0)

    def test_duplicate_decline_does_not_create_duplicate_notification(self):
        """2. Repeating decline request does not create duplicate notifications."""
        res_inv = self.client.post("/api/collaboration/invitations", headers=self.headers_a, json={
            "email": self.user_b.email,
            "role": "Editor",
            "scope": "workspace"
        })
        token = res_inv.json().get("token") or res_inv.json().get("invitationUrl", "").split("/")[-1]

        # First decline
        self.client.post(f"/api/invitations/{token}/decline", headers=self.headers_b)
        # Second decline (retry)
        self.client.post(f"/api/invitations/{token}/decline", headers=self.headers_b)

        # Verify exactly 1 decline notification exists for Account A
        res_notif_a = self.client.get("/api/notifications", headers=self.headers_a)
        items_a = res_notif_a.json()["items"]
        decline_notifs = [n for n in items_a if n["type"] == "COLLABORATION_INVITATION_DECLINED"]
        self.assertEqual(len(decline_notifs), 1)

    def test_wrong_user_cannot_decline_targeted_invitation(self):
        """3. Account C (stranger) cannot decline invitation targeted specifically to Account B."""
        res_inv = self.client.post("/api/collaboration/invitations", headers=self.headers_a, json={
            "email": self.user_b.email,
            "role": "Reviewer",
            "scope": "workspace"
        })
        token = res_inv.json().get("token") or res_inv.json().get("invitationUrl", "").split("/")[-1]

        # Account C attempts to decline B's targeted invitation
        res_dec = self.client.post(f"/api/invitations/{token}/decline", headers=self.headers_c)
        self.assertEqual(res_dec.status_code, 403)

        # Verify Account A received NO decline notification
        res_notif_a = self.client.get("/api/notifications", headers=self.headers_a)
        items_a = res_notif_a.json()["items"]
        decline_notifs = [n for n in items_a if n["type"] == "COLLABORATION_INVITATION_DECLINED"]
        self.assertEqual(len(decline_notifs), 0)


if __name__ == "__main__":
    unittest.main()
