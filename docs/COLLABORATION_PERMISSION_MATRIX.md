# COLLABORATION PERMISSION MATRIX — PROMPTCOMMIT

**Status:** Authoritative Backend RBAC Document  
**Authoritative Source:** Backend API Routes (`server/app/routes/prompts.py`, `server/app/routes/versions.py`, `server/app/routes/reviews.py`, `server/app/routes/comments.py`, `server/app/routes/collaboration.py`)

---

## 1. Canonical Role Vocabulary

| Canonical Role | Accepted UI Display Aliases | Description |
| :--- | :--- | :--- |
| **Owner** | Workspace Owner, Prompt Author | The user who created and owns the prompt or workspace. Unrestricted administrative and mutation authority. |
| **Editor** | Prompt Editor | Full content editing and version commit capability. Cannot delete prompts or manage workspace access. |
| **Reviewer** | Prompt Reviewer | Quality assurance and approval role. Can inspect, test, review, approve, and request changes. Cannot directly mutate baseline prompt instructions or restore version snapshots. |
| **Viewer** | View Only, Read-Only | Read-only collaborator. Can view prompts, test in playground, and post discussion comments. Cannot mutate content, commit versions, or execute review approval decisions. |

---

## 2. Operation Permission Matrix

| Operation | Owner | Editor | Reviewer | Viewer | Enforcing Backend Route & Status Code |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **View Prompt Content** |  Yes |  Yes |  Yes |  Yes | `GET /api/prompts/{id}` (404 if unauthorized) |
| **Test in Playground** |  Yes |  Yes |  Yes |  Yes | `POST /api/tests/run` |
| **Edit Prompt Content** |  Yes |  Yes |  No |  No | `PUT /api/prompts/{id}` (403 if not Owner/Editor) |
| **Create Version Commit** |  Yes |  Yes |  No |  No | `POST /api/prompts/{id}/versions` (403 if not Owner/Editor) |
| **Restore Version Snapshot** |  Yes |  Yes |  No |  No | `POST /api/prompts/{id}/versions/{v}/restore` (403 if not Owner/Editor) |
| **Delete Prompt** |  Yes |  No |  No |  No | `DELETE /api/prompts/{id}` (404/403 if not Owner) |
| **Post Discussion Comment** |  Yes |  Yes |  Yes |  Yes | `POST /api/prompts/{id}/comments` (404 if not a member) |
| **Delete Own Comment** |  Yes |  Yes |  Yes |  Yes | `DELETE /api/prompts/{id}/comments/{cid}` |
| **Delete Any Comment** |  Yes |  No |  No |  No | `DELETE /api/prompts/{id}/comments/{cid}` (403 if not comment author/Owner) |
| **Request Review** |  Yes |  Yes |  Yes |  No | `POST /api/prompts/{id}/versions/{v}/review/request` |
| **Submit Approval / Request Changes** |  Yes |  Yes |  Yes |  No | `POST /api/prompts/{id}/versions/{v}/review/action` (400/403 if Viewer) |
| **Invite Collaborator (Email/Link)** |  Yes |  No |  No |  No | `POST /api/collaboration/invitations` (404 if not Owner) |
| **Change Collaborator Role** |  Yes |  No |  No |  No | `PUT /api/collaboration/members/{email}/prompts/{id}/role` (404 if not Owner) |
| **Revoke Prompt Access** |  Yes |  No |  No |  No | `DELETE /api/collaboration/members/{email}/prompts/{id}` (404 if not Owner) |
| **Revoke Workspace Access** |  Yes |  No |  No |  No | `DELETE /api/collaboration/members/{email}` (404 if not Owner) |

---

## 3. Scope Separation: Workspace Membership vs. Prompt-Level Sharing

1. **Prompt-Specific Permissions:** Access is granted per prompt via `prompt_shares`. A user may have `Editor` access on Prompt A and `Reviewer` or `Viewer` access on Prompt B.
2. **Independent Mutation:** Changing a user's role on Prompt A (`PUT /api/collaboration/members/{email}/prompts/{prompt_a}/role`) only alters permissions for Prompt A without modifying Prompt B.
3. **Activity Timeline Isolation:** Collaboration activity (`GET /api/collaboration/activity`) returns only events for prompts owned by or shared with the authenticated user.
