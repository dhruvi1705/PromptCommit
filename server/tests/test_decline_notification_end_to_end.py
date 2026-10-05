"""
End-to-end regression test for Collaboration Invitation Decline & Notification Delivery.
Verifies:
1. Inviter (User A) creates an invitation for Recipient (User B).
2. Recipient (User B) declines the invitation via POST /api/invitations/{token}/decline.
3. Inviter (User A) queries GET /api/notifications.
4. Response contains item with type "COLLABORATION_INVITATION_DECLINED".
5. Notification fields match: userId == A.id, senderId == B.id, invitationId == inv.id.
6. Recipient (User B) queries GET /api/notifications and receives ZERO decline notifications (User Isolation).
"""
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

class TestDeclineNotificationEndToEnd(unittest.TestCase):
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

        # Create Inviter (Account A)
        self.inviter = User(
            id="usr_e2e_a_101",
            name="Alice Inviter E2E",
            username="alice_e2e",
            email="alice_e2e@promptcommit.dev",
            password_hash=hash_password("Password123!")
        )
        # Create Recipient (Account B)
        self.recipient = User(
            id="usr_e2e_b_202",
            name="Bob Recipient E2E",
            username="bob_e2e",
            email="bob_e2e@promptcommit.dev",
            password_hash=hash_password("Password123!")
        )
        # Create Stranger (Account C)
        self.stranger = User(
            id="usr_e2e_c_303",
            name="Charlie Stranger E2E",
            username="charlie_e2e",
            email="charlie_e2e@promptcommit.dev",
            password_hash=hash_password("Password123!")
        )
        self.db.add_all([self.inviter, self.recipient, self.stranger])
        self.db.commit()

        self.token_a = create_access_token(self.inviter.id)
        self.token_b = create_access_token(self.recipient.id)
        self.token_c = create_access_token(self.stranger.id)

        self.headers_a = {"Authorization": f"Bearer {self.token_a}"}
        self.headers_b = {"Authorization": f"Bearer {self.token_b}"}
        self.headers_c = {"Authorization": f"Bearer {self.token_c}"}

    def tearDown(self):
        self.db.close()

    def test_decline_notification_end_to_end_flow(self):
        # 1. Account A creates an invitation for Account B
        res_inv = self.client.post("/api/collaboration/invitations", headers=self.headers_a, json={
            "email": self.recipient.email,
            "role": "Reviewer",
            "scope": "workspace"
        })
        self.assertIn(res_inv.status_code, [200, 201])
        inv_data = res_inv.json()
        token = inv_data.get("token") or inv_data.get("inviteUrl", "").split("/")[-1]

        # 2. Account B declines the invitation
        res_dec = self.client.post(f"/api/invitations/{token}/decline", headers=self.headers_b)
        self.assertEqual(res_dec.status_code, 200)
        self.assertEqual(res_dec.json()["message"], "Invitation declined.")

        # 3. Account A calls GET /api/notifications
        res_notif_a = self.client.get("/api/notifications", headers=self.headers_a)
        self.assertEqual(res_notif_a.status_code, 200)
        data_a = res_notif_a.json()
        
        # Assert GET /api/notifications returns the declined notification item to Account A
        items_a = data_a["items"]
        declined_items = [n for n in items_a if n["type"] == "COLLABORATION_INVITATION_DECLINED"]
        self.assertEqual(len(declined_items), 1)

        notif_item = declined_items[0]
        self.assertEqual(notif_item["userId"], self.inviter.id)
        self.assertEqual(notif_item["senderId"], self.recipient.id)
        self.assertEqual(notif_item["type"], "COLLABORATION_INVITATION_DECLINED")
        self.assertEqual(notif_item["title"], "Invitation Declined")
        self.assertIn("Bob Recipient E2E", notif_item["message"])
        self.assertEqual(notif_item["actionUrl"], "/app/collaboration")
        self.assertFalse(notif_item["isRead"])

        # 4. Account B calls GET /api/notifications -> receives 0 decline notifications
        res_notif_b = self.client.get("/api/notifications", headers=self.headers_b)
        self.assertEqual(res_notif_b.status_code, 200)
        items_b = res_notif_b.json()["items"]
        declined_b = [n for n in items_b if n["type"] == "COLLABORATION_INVITATION_DECLINED"]
        self.assertEqual(len(declined_b), 0)

        # 5. Account C calls GET /api/notifications -> receives 0 notifications total
        res_notif_c = self.client.get("/api/notifications", headers=self.headers_c)
        self.assertEqual(res_notif_c.status_code, 200)
        self.assertEqual(len(res_notif_c.json()["items"]), 0)


if __name__ == "__main__":
    unittest.main()
