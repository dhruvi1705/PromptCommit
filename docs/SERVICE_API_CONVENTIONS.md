# PromptCommit — Service & API Developer Conventions

This document establishes the authoritative conventions for frontend service functions, backend API endpoints, error handling, AI configuration, and collection relationship management across PromptCommit.

---

## 1. Frontend API Client & Request Standards (`src/services/api.js`)

### Centralized Base URL & Timeout
- **Base URL**: Configured via `import.meta.env.VITE_API_BASE_URL` with fallback to `'http://localhost:8000/api'`.
- **Default Timeout**: Standard CRUD requests use `DEFAULT_REQUEST_TIMEOUT_MS = 20000` (20 seconds).
- **Custom Timeouts**: Long-running AI operations (generation, comparison, prompt test runs) can pass a caller-specific timeout (e.g., `options.timeout = 60000`).
- **Timer Cleanup**: Timeout timers are unconditionally cleared on success, failure, timeout, or abort.

### Structured Error Model
`apiRequest` throws structured error objects that preserve backend metadata:
```typescript
class ApiError extends Error {
  name: "ApiError";
  status: number;         // HTTP status code (400, 401, 403, 404, 409, 429, 500, etc.)
  detail: string;         // Human-readable message or FastAPI detail string
  code: string;           // Error classification code (e.g., "VALIDATION_ERROR", "RATE_LIMITED")
  data: any;              // Full backend error payload / validation issue list
}

class RequestTimeoutError extends ApiError {
  name: "RequestTimeoutError";
  status: 408;
  detail: "Request timed out...";
  code: "TIMEOUT_ERROR";
}

class RequestAbortedError extends ApiError {
  name: "RequestAbortedError";
  status: 0;
  detail: "Request was cancelled.";
  code: "REQUEST_ABORTED";
}
```

### Auth Session Lifecycle Rules
- **401 Unauthorized**: Automatically clears stale token from `localStorage` and triggers authentication re-login.
- **403 Forbidden**: Preserves local token and session state (the user is authenticated, but lacks permissions for the specific resource).

---

## 2. AbortController & Async Race Protections
- Any effect fetching data on route changes or search filters must use `AbortController` or local cancellation flags (`let isMounted = true; ... return () => { isMounted = false; }`).
- For long-running AI calls in components (Compare, Playground, AIToolkit, PromptLibrary), pass `{ signal: controller.signal }` to `apiRequest` and handle `error.name === 'RequestAbortedError'` silently or gracefully.

---

## 3. Canonical AI Providers & Models

### The Authoritative 6-Model List
1. **Google Gemini (Cloud API)**: `gemini-3.6-flash` *(Default Model)*
2. **Google Gemini (Cloud API)**: `gemini-3.7-flash`
3. **Google Gemini (Cloud API)**: `gemini-3.8-flash`
4. **Groq (Cloud API)**: `openai/gpt-oss-20b`
5. **OpenRouter (Cloud API)**: `openrouter/free`
6. **Mistral AI (Cloud API)**: `mistral-small-latest`

### Canonical Provider Identifiers
- `gemini` → Display: `"Google Gemini"`
- `groq` → Display: `"Groq"`
- `openrouter` → Display: `"OpenRouter"`
- `mistral` → Display: `"Mistral AI"`

Provider normalization maps aliases (e.g., `"Google Gemini (Cloud API)"`, `"google"`, `"Google"`) to canonical ID `gemini`.

---

## 4. Collection Architecture & Prompt CRUD (`collectionId` Canonical)

### Authoritative Relationship
- Collection membership is strictly maintained through the `collection_prompts` many-to-many junction table.
- Canonical identifier for collections is **`collectionId`** (or `collection_id` at the HTTP boundary).
- `Prompt.collection_name` is strictly a **legacy compatibility field** synchronized by the backend during CRUD operations and migrations.
- **Never** create a fake `"General"` collection entity in the database.
- **Never** derive prompt membership or filter collections by name string matching.

### Prompt Creation & Updates
- `POST /api/prompts`: Accepts `collectionId` or `collection_id`. Validates that the collection exists and belongs to the authenticated user.
- `PUT /api/prompts/{prompt_id}`: Accepts `collectionId` or `collection_id`. Updates `prompt.collections = [col]` and synchronizes `prompt.collection_name = col.name` transactionally. Passing `""` or `null` clears the collection association.
- `GET /api/prompts?collectionId={id}`: Filters prompts via `join(Prompt.collections).filter(Collection.id == active_col_id)`.

---

## 5. Collaboration Service API

All frontend service calls adhere to camelCase parameters:
```javascript
// Email invitation
await collaborationService.createEmailInvite({
  email: 'collaborator@example.com',
  name: 'Jane Doe',
  role: 'Editor',
  promptId: 'prompt-123',
  scope: 'prompt',
  expiresInDays: 7
});

// Shareable link
await collaborationService.createShareLink({
  role: 'Reviewer',
  promptId: 'prompt-123',
  scope: 'prompt',
  expiresInDays: 30,
  maxUses: 10
});

// Member role update
await collaborationService.updateMemberPromptRole(email, promptId, 'Editor');
```
The service layer translates to backend schemas at the HTTP boundary.

---

## 6. Response Shape Conventions

| Domain | Service Method | Response Shape |
|---|---|---|
| **Auth** | `authService.login(email, password)` | `{ user: { id, email, name, avatar }, token: string }` |
| **Prompts** | `promptService.getPrompts(filters)` | `PromptResponse[]` (direct array of prompts) |
| **Prompt Details** | `promptService.getPromptById(id)` | `PromptResponse` object |
| **Collections** | `collectionService.getCollections()` | `CollectionResponse[]` (with `promptCount`, `promptsCount`) |
| **Collaboration Members** | `collaborationService.getMembers()` | `CollaboratorMemberItem[]` |
| **Invitations** | `collaborationService.getInvitations()` | `InvitationItemResponse[]` |
| **Notifications** | `notificationService.getNotifications()` | `{ items: NotificationItem[], unreadCount: number }` |
