# BATCH 4 — RATINGS, VERSION METADATA, DATES, AUTH TOKENS & API BEHAVIOR REPORT

**Audit Date:** September 24, 2026  
**Scope:** Problems 31–40 from PromptCommit Master Audit  
**Status:** COMPLETED & FULLY VERIFIED (All 30 backend pytest tests passing, Vite frontend compiled with 0 errors)

---

## 1. Problems 31–40 Addressed Summary

| Problem ID | Focus Area | Root Issue | Resolution | Status |
| :--- | :--- | :--- | :--- | :--- |
| **31** | Analytics Empty Rating | Fallback was hardcoded to `5.0` when a user had unrated prompts. | Updated backend `analytics_service.py` to return `avgPromptRating: None` and updated frontend to display `"Not rated"`. | **RESOLVED** |
| **32** | Prompt Library Rating & Sorting | Prompts without ratings fell back to `5.0` in sorting and details modal. | Replaced fake 5.0 fallback with honest null checks, placed unrated prompts deterministically last when sorting by rating, and display `"No ratings"`. | **RESOLVED** |
| **33** | Version Author Resolution | Default author fell back to `"Aanshi"` / `"Aanshi Shah"`. | Removed all generic `"Aanshi"` fallbacks; author is strictly derived from authenticated `current_user.name` with a neutral `"Unknown author"` fallback. | **RESOLVED** |
| **34** | Fake Date Fallbacks | Date utility contained static fake dates like `"Aug 20, 2026, 10:30 AM"` and `"20 Aug 2026"`. | Removed all synthetic static date defaults in `dateFormatter.js` and backend serializers; replaced with `"Date unavailable"`. | **RESOLVED** |
| **35** | Status Strings vs Timestamps | Strings like `"Active"`, `"Pending"`, `"Recently"` were parsed as `new Date()`. | Removed status-to-date conversion logic in `parseToDate()`; statuses remain distinct strings while timestamps are genuine ISO/Date values. | **RESOLVED** |
| **36** | JWT Storage Audit | `localStorage.getItem("pc_token")` security tradeoffs. | Audited storage lifecycle: tokens are never logged, never rendered in DOM, never exposed in URL query parameters, and reliably cleared on logout/401. | **AUDITED & SECURED** |
| **37** | API_BASE Hardcoding | `API_BASE = 'http://localhost:8000/api'` was hardcoded in `api.js`. | Updated to `import.meta.env.VITE_API_BASE_URL \|\| 'http://localhost:8000/api'`. | **RESOLVED** |
| **38** | Production API Config | Missing environment variable documentation in `.env.example`. | Added `VITE_API_BASE_URL` to `.env.example` with clear development and production samples; no provider secrets in client env. | **RESOLVED** |
| **39** | HTTP 401 vs 403 Handling | All error codes could risk session clearance. | Confirmed and enforced: HTTP 401 (Authentication failure) clears invalid token; HTTP 403 (Forbidden / authorization failure) preserves session and displays permission error. | **RESOLVED** |
| **40** | Logout Error Handling | `authService.logout()` silently swallowed errors and lacked server revocation state tracking. | Enhanced `logout()` to distinguish server-side notification success from network offline scenarios while guaranteeing local session cleanup in `finally`. | **RESOLVED** |

---

## 2. Rating Behavior (Before vs After)

### Before
* Prompts without ratings defaulted to `rating = 5.0` and `ratingCount = 1` in the database and API serialization.
* Sorting by rating treated unrated prompts as 5.0-star prompts, misleading users into believing new prompts were top-rated.
* Prompt Details modal rendered 5 full stars for unrated prompts.

### After
* Prompts with no reviews have `rating: null` and `ratingCount: 0`.
* Prompt Details modal shows unrated state with unfilled stars and `"No ratings"` label until the user hovers or submits a rating.
* When submitting a rating, `rate_prompt` computes a real weighted running average: `(existing_rating * existing_count + new_score) / (existing_count + 1)`.
* Sorting by rating puts rated prompts first in descending order, with unrated prompts placed deterministically at the end.

---

## 3. Analytics Rating Behavior

### Before
* `analytics_service.py` returned `avg_rating = 5.0` whenever `ratings` was empty or `total_prompts == 0`.
* Analytics dashboard displayed `"5.0"` with gold star for brand new accounts with 0 ratings.

### After
* `analytics_service.py` returns `avgPromptRating: None` when no ratings exist.
* `AnalyticsOverviewResponse` schema defines `avgPromptRating: Optional[float] = None`.
* Frontend `Analytics.jsx` checks `avgPromptRating !== null ? avgPromptRating : 'Not rated'`.

---

## 4. Version Author Behavior

### Before
* Fallbacks in `Versions.jsx`, `Header.jsx`, and serializers used `"Aanshi Shah"` or `"Aanshi"` when user context was missing.
* When User B committed a version, stale client components could render `"Aanshi Shah"`.

### After
* Backend `create_version` and initial version commits record `author_name=current_user.name or current_user.username or "Unknown author"`.
* Serializers in `prompts.py` and `versions.py` use `"Unknown author"` if missing.
* `Versions.jsx` renders `ver.author || selectedPrompt?.ownerName || currentUser?.name || 'Unknown author'`.
* Header component uses dynamic initials and `'User'` / `'Member'` fallbacks without hardcoded personal names.

---

## 5. Date Utility Behavior

### Before
* `dateFormatter.js` contained default parameters: `fallback = 'Aug 20, 2026, 10:30 AM'`, `fallback = '20 Aug 2026'`, `fallback = 'Aug 20, 2026'`, and `return '10:30 AM'`.
* Backend `format_datetime_str(dt)` returned `"Recently"` when `dt` was `None`.

### After
* `dateFormatter.js` defaults fallback to `'Date unavailable'` or `'Time unavailable'`.
* Backend serializers return `"Date unavailable"` when `created_at` or `updated_at` is `None`.
* Real relative time helper `formatRelativeTime(dateInput)` accurately formats elapsed time (`"Just now"`, `"5m ago"`, `"2h ago"`, `"Yesterday"`), returning `'Date unavailable'` if given invalid input.

---

## 6. Status/Timestamp Separation

### Before
* `parseToDate` in `dateFormatter.js` matched regex `/^(just now|recently|active|just joined|live)$/i` and returned `new Date()`.
* A prompt with status `"Active"` was converted to the current timestamp and displayed as `"Today at 10:30 AM"`.

### After
* Statuses (`"Active"`, `"Pending"`, `"Draft"`, `"In_Review"`, `"Changes_Requested"`, `"Approved"`, `"Archived"`, `"Live"`) are rejected by `parseToDate` and return `null`.
* Statuses are displayed as distinct badge labels; timestamps are rendered strictly from valid ISO date strings.

---

## 7. JWT Storage Findings & Security Audit

* **Architecture Context:** PromptCommit uses stateless JWT access tokens signed with HMAC-SHA256 (`HS256`) with a 24-hour expiration (`ACCESS_TOKEN_EXPIRE_MINUTES=1440`).
* **Current Storage:** Stored in `localStorage` under key `pc_token`.
* **Security Verification:**
  1. Tokens are never passed via URL query strings.
  2. Tokens are never logged to `console.log` or error outputs.
  3. Tokens are never rendered in client DOM.
  4. Tokens are injected solely via the HTTP `Authorization: Bearer <token>` header.
  5. Local session is cleared immediately on HTTP 401 responses or explicit logout.
* **Tradeoff Documentation:** Retaining `localStorage` preserves seamless Single Page Application (SPA) client routing, Google OAuth popup linking, and cross-origin development without introducing breaking CSRF cookie misconfigurations.

---

## 8. API_BASE Changes

* File modified: `src/services/api.js`
* Replaced: `const API_BASE = 'http://localhost:8000/api';`
* With: `const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';`

---

## 9. Environment Configuration

### Frontend `.env.example`
```env
# API Base URL for backend communications
# Development default: http://localhost:8000/api
# Production example: https://api.promptcommit.dev/api
VITE_API_BASE_URL=http://localhost:8000/api

# Google OAuth 2.0 Client ID (obtain from Google Cloud Console)
# This is a public identifier, safe to expose to the frontend
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```
* Verified: AI API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`) and `RESEND_API_KEY` remain strictly in `server/.env` and are never exposed via `VITE_*` prefixes.

---

## 10. HTTP 401 vs 403 Error Handling

* **HTTP 401 Unauthorized:**
  - Indicates missing, invalid, or expired JWT credentials.
  - Action: Clears local token via `setAuthToken(null)` and triggers re-authentication.
* **HTTP 403 Forbidden:**
  - Indicates an authenticated user lacks permission for a specific resource (e.g., Viewer attempting to edit a prompt or create a version commit).
  - Action: Preserves user token and session; raises `detail` error toast to user without forcing an unexpected logout.

---

## 11. Logout Error Handling

* File modified: `src/services/authService.js`
* Method: `authService.logout()`
* Behavior:
  - Invokes `POST /auth/logout` endpoint.
  - Distinguishes network failure from server success (`serverRevoked: true/false`).
  - Always executes `setAuthToken(null)` in `finally` block to prevent lingering sessions.
  - Logs a sanitized diagnostic warning without stack traces or credentials.
  - Returns `{ success: true, serverRevoked: boolean, error: string | null }`.

---

## 12–15. Test Suite Verification

### Backend Pytest Results (`test_batch_4_ratings_versions_auth.py`)
| Test Name | Verification Goal | Result |
| :--- | :--- | :--- |
| `test_new_prompt_rating_is_null_and_unrated` | Ensures new prompt rating is `None` with `ratingCount=0`. | **PASSED** |
| `test_prompt_rating_calculation_and_running_average` | Validates running weighted average calculation (4.0 then 2.0 -> 3.0 avg). | **PASSED** |
| `test_analytics_avg_rating_empty_state_and_with_ratings` | Validates `avgPromptRating: None` for unrated and real average once rated. | **PASSED** |
| `test_version_author_tracks_authenticated_creator` | Confirms User A and User B version commits reflect respective identities without "Aanshi" fallback. | **PASSED** |
| `test_auth_token_validation_and_401_vs_403` | Verifies 401 for invalid JWT and 403 for unauthorized version creation. | **PASSED** |
| `test_logout_endpoint` | Verifies `/auth/logout` returns `{ "success": True }`. | **PASSED** |

### Full Pytest Regression Suite
* Total tests executed: **30 tests**
* Total passed: **30 passed (100%)**
* Test files included:
  - `test_collection_architecture_batch1.py` (Batch 1)
  - `test_batch_2_collection_consistency.py` (Batch 2)
  - `test_batch_3_ai_provider_playground.py` (Batch 3)
  - `test_batch_4_ratings_versions_auth.py` (Batch 4)
  - `test_collaboration_final.py` (Collaboration & Invitations)
  - `test_prompt_level_roles.py` (RBAC & Permissions)

---

## 16. Search Audit Findings

| Search Term | Repository Occurrences Classification |
| :--- | :--- |
| `"Aanshi"` | Seed demo user in `main.py` (`"Aanshi Shah"`), demo login button in `Login.jsx` (`user1`), and collaboration tests. No hardcoded fallback logic remains in production serializers, models, or version author components. |
| `"5.0"` | Backend query parameter ceiling `le=5.0` in `prompts.py` and explicit rating for seed demo records in `main.py`. Removed from all default fallback paths and schemas. |
| `"Aug 20, 2026"` / `"20 Aug 2026"` | **0 matches**. Completely eradicated from all date utilities and components. |
| `"10:30 AM"` | Only static mock illustration text in marketing landing hero demo (`Landing.jsx`). No production code usage. |
| `"localhost:8000/api"` | `.env.example` fallback and backend unit test base URLs. Externalized in `src/services/api.js`. |
| `"pc_token"` | 3 controlled usages in `src/services/api.js` (getItem, setItem, removeItem). |
| `"new Date()"` | Used in real date comparison/current timestamp generation. Removed from all status-conversion routines. |

---

## 17. Frontend Build Result

```bash
> vite build
✓ 1861 modules transformed.
dist/index.html                   1.63 kB │ gzip:   0.85 kB
dist/assets/index-B3nMIXG8.css   72.51 kB │ gzip:  11.76 kB
dist/assets/index-C4-GaYlU.js   734.04 kB │ gzip: 169.45 kB
✓ built in 1.97s with 0 errors
```

---

## 18. Backend Python Compilation Result

```bash
> python -m compileall app
Listing 'app'...
Listing 'app\core'...
Listing 'app\models'...
Listing 'app\routes'...
Listing 'app\schemas'...
Listing 'app\services'...
Listing 'app\utils'...
0 compilation errors
```

---

## 19. Remaining Known Issues & Non-Issues
* None. All 10 problem areas in Batch 4 have been resolved and validated against the live MySQL database and FastAPI runtime.

---

## 20. Security Considerations
1. **Secret Isolation:** Zero backend API keys or database credentials are exposed to Vite client bundles.
2. **Access Control Integrity:** HTTP 403 errors are properly differentiated from HTTP 401 errors, protecting against session token destruction on permission edge-cases.
3. **Data Authenticity:** The system no longer fabricates ratings, dates, or version authors. Real data is preserved, and missing data displays an honest empty state.
