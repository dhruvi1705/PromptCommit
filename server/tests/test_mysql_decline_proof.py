import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import uuid
from app.core.database import SessionLocal
from app.models.user import User
from app.models.collaboration_invitation import CollaborationInvitation
from app.models.notification import Notification
from app.core.security import hash_password
from fastapi.testclient import TestClient
from app.main import app

def run_proof():
    db = SessionLocal()
    try:
        # Get or create Account A and Account B
        user_a = db.query(User).filter(User.email == "alice_sender_proof@promptcommit.dev").first()
        if not user_a:
            user_a = User(
                id=f"usr_proof_a_{uuid.uuid4().hex[:6]}",
                name="Alice Inviter Proof",
                username=f"alice_proof_{uuid.uuid4().hex[:4]}",
                email="alice_sender_proof@promptcommit.dev",
                password_hash=hash_password("Password123!")
            )
            db.add(user_a)

        user_b = db.query(User).filter(User.email == "bob_decliner_proof@promptcommit.dev").first()
        if not user_b:
            user_b = User(
                id=f"usr_proof_b_{uuid.uuid4().hex[:6]}",
                name="Bob Decliner Proof",
                username=f"bob_proof_{uuid.uuid4().hex[:4]}",
                email="bob_decliner_proof@promptcommit.dev",
                password_hash=hash_password("Password123!")
            )
            db.add(user_b)

        db.commit()

        # Create invitation
        client = TestClient(app)
        from app.core.security import create_access_token
        token_a = create_access_token(user_a.id)
        token_b = create_access_token(user_b.id)

        res_inv = client.post("/api/collaboration/invitations", headers={"Authorization": f"Bearer {token_a}"}, json={
            "email": user_b.email,
            "role": "Reviewer",
            "scope": "workspace"
        })
        inv_data = res_inv.json()
        inv_token = inv_data.get("token") or inv_data.get("inviteUrl").split("/")[-1]

        # Account B declines invitation
        res_dec = client.post(f"/api/invitations/{inv_token}/decline", headers={"Authorization": f"Bearer {token_b}"})
        print("DECLINE RESPONSE:", res_dec.status_code, res_dec.json())

        # Perform Section 29 required SQL verification query with fresh DB session
        db_fresh = SessionLocal()
        notifs = db_fresh.query(Notification).filter(
            Notification.type == "COLLABORATION_INVITATION_DECLINED"
        ).order_by(Notification.created_at.desc()).all()

        print("\n--- DATABASE QUERY RESULT (SELECT FROM notifications WHERE type = 'COLLABORATION_INVITATION_DECLINED') ---")
        print(f"Total Rows Found: {len(notifs)}")
        for n in notifs[:5]:
            print({
                "id": n.id,
                "user_id": n.user_id,
                "sender_id": n.sender_id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "invitation_id": n.invitation_id,
                "created_at": str(n.created_at)
            })
        db_fresh.close()

    finally:
        db.close()

if __name__ == "__main__":
    run_proof()
