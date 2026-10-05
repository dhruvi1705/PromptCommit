# PromptCommit — Batch 8 Service/API Consistency + Prompt CRUD Collection Migration Report

**Date**: 2026-09-24  
**Batch**: 8 (Problems 71–80)  
**Status**: COMPLETE  

---

## 1. Executive Summary & Problems Resolved

Batch 8 audited and resolved Problems 71 through 80, establishing end-to-end service and API consistency across PromptCommit:

- **Problem 71**: Standardized `collaborationService.js` on canonical camelCase arguments (`email`, `name`, `role`, `promptId`, `scope`, `expiresInDays`, `maxUses`). Service functions cleanly translate parameters across the HTTP boundary.
- **Problem 72**: Verified and maintained the single authoritative AI configuration across frontend (`src/data/aiProviders.js`) and backend (`server/app/core/ai_config.py`), covering the exact 6 supported models:
  1. Google Gemini: `gemini-3.6-flash` *(Default)*
  2. Google Gemini: `gemini-3.7-flash`
  3. Google Gemini: `gemini-3.8-flash`
  4. Groq: `openai/gpt-oss-20b`
  5. OpenRouter: `openrouter/free`
  6. Mistral AI: `mistral-small-latest`
- **Problem 73**: Enforced canonical provider identifiers (`gemini`, `groq`, `openrouter`, `mistral`) with robust backend alias normalization.
- **Problem 74**: Unified frontend service response shapes across Auth, Prompts, Collections, Collaboration, and Notifications without unnecessary object nesting.
- **Problem 75**: Replaced generic error throws with structured `ApiError`, `RequestTimeoutError` (HTTP 408), and `RequestAbortedError` classes in `src/services/api.js`. Preserved 401 token clearing while preserving 403 active sessions.
- **Problem 76**: Completed an `AbortController` audit across components (Playground, Compare, AIToolkit, PromptLibrary, Collections), ensuring in-flight request cancellation on route switch and unmount.
- **Problem 77**: Centralized `API_BASE` configuration in `src/services/api.js` using `import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'`.
- **Problem 78**: Centralized request timeout handling (`DEFAULT_REQUEST_TIMEOUT_MS = 20000`) with caller overrides for AI generation and guaranteed timer cleanup across all resolution paths.
- **Problem 79**: Audited and confirmed that prompt CRUD flows use canonical `collectionId` (and `collection_id`) referencing the `collection_prompts` junction table. No string-based collection lookups or fake "General" collections exist.
- **Problem 80**: Implemented transactional collection membership synchronization in prompt updates (`PUT /api/prompts/{id}`), verifying user ownership and updating the canonical M2M relationship while maintaining legacy `collection_name` for backward compatibility.

---

## 2. Files Inspected & Modified

### Frontend
- [`src/services/api.js`](file:///c:/Users/riyap/Downloads/project/src/services/api.js) — Centralized `API_BASE`, `DEFAULT_REQUEST_TIMEOUT_MS`, structured `ApiError`, `RequestTimeoutError`, `RequestAbortedError`, timer cleanup, 401/403 session semantics.
- [`src/services/collaborationService.js`](file:///c:/Users/riyap/Downloads/project/src/services/collaborationService.js) — Standardized on camelCase method arguments.
- [`src/services/promptService.js`](file:///c:/Users/riyap/Downloads/project/src/services/promptService.js) — Uses canonical `collectionId` and clean domain-level returns.
- [`src/services/collectionService.js`](file:///c:/Users/riyap/Downloads/project/src/services/collectionService.js) — Consistent response handling.
- [`src/data/aiProviders.js`](file:///c:/Users/riyap/Downloads/project/src/data/aiProviders.js) — Verified authoritative 6 AI models & canonical provider IDs.
- [`SERVICE_API_CONVENTIONS.md`](file:///c:/Users/riyap/Downloads/project/SERVICE_API_CONVENTIONS.md) — Comprehensive developer guide.

### Backend
- [`server/app/core/ai_config.py`](file:///c:/Users/riyap/Downloads/project/server/app/core/ai_config.py) — Validates canonical provider IDs, models, and alias normalization.
- [`server/app/schemas/prompt.py`](file:///c:/Users/riyap/Downloads/project/server/app/schemas/prompt.py) — Added `collectionId`, `collection_id`, `target_model`, `is_private` aliases.
- [`server/app/routes/prompts.py`](file:///c:/Users/riyap/Downloads/project/server/app/routes/prompts.py) — Transactional `collectionId` resolution, ownership validation, empty string clearance, and M2M updates.
- [`server/app/schemas/collection.py`](file:///c:/Users/riyap/Downloads/project/server/app/schemas/collection.py) — Added `promptsCount` alias alongside `promptCount`.
- [`server/app/routes/collections.py`](file:///c:/Users/riyap/Downloads/project/server/app/routes/collections.py) — Computed prompt counts using M2M `collection_prompts`.
- [`server/test_batch_8_service_api_consistency.py`](file:///c:/Users/riyap/Downloads/project/server/test_batch_8_service_api_consistency.py) — Batch 8 automated test suite.

---

## 3. Canonical Service & API Conventions
Full conventions are documented in [`SERVICE_API_CONVENTIONS.md`](file:///c:/Users/riyap/Downloads/project/SERVICE_API_CONVENTIONS.md). Key highlights:
1. `apiRequest()` returns the parsed JSON payload directly.
2. CamelCase method signatures in JS services.
3. Errors throw instances of `ApiError` with `status`, `detail`, `code`, and `data`.
4. 401 status clears local token; 403 preserves session.

---

## 4. Canonical Provider & Model Configurations
- **Gemini**: `gemini` → `gemini-3.6-flash` *(Default)*, `gemini-3.7-flash`, `gemini-3.8-flash`
- **Groq**: `groq` → `openai/gpt-oss-20b`
- **OpenRouter**: `openrouter` → `openrouter/free`
- **Mistral AI**: `mistral` → `mistral-small-latest`

---

## 5. API Error Model
Structured `ApiError` exposes:
- `.name`: `"ApiError"` / `"RequestTimeoutError"` / `"RequestAbortedError"`
- `.status`: HTTP status code (or 408 for timeout, 0 for abort)
- `.detail`: User-friendly error message
- `.code`: Machine-readable classification code
- `.data`: Detailed validation or server error response object

---

## 6. AbortController Audit Findings
- `PromptLibrary`, `Collections`, `Playground`, `Compare`, and `AIToolkit` properly handle `AbortController` signals during component unmount and concurrent parameter updates.
- Batch 7 request identity guards and state verification remain active and unaffected.

---

## 7. Centralized API Base URL & Timeout Policy
- `API_BASE`: Single declaration in `src/services/api.js`.
- `DEFAULT_REQUEST_TIMEOUT_MS`: 20,000 ms.
- Timer cleanup occurs in all paths via `try ... finally { clearTimeout(timerId); }`.

---

## 8. Collection Relationship & Prompt CRUD Architecture
- Collection membership is stored in `collection_prompts`.
- Prompt creation and updates accept `collectionId`.
- Ownership verification ensures User A cannot attach prompts to User B's collections.
- Deleting a collection dissociates prompts gracefully without deleting the prompt entity itself.

---

## 9. Search Audit Results

| Pattern | Match Count | Classification | Notes |
|---|---|---|---|
| `open-mistral-7b` | 2 | TEST FIXTURE | Confirms model rejection in test suites |
| `localhost:8000` | 1 | VALID | Fallback default in `src/services/api.js` |
| `API_BASE` | 1 | VALID | Centralized in `src/services/api.js` |
| `DEFAULT_REQUEST_TIMEOUT_MS` | 1 | VALID | Centralized in `src/services/api.js` |
| `collection_name` (Frontend) | 0 | CLEAN | Frontend uses `collectionId` exclusively |
| `collection_name` (Backend) | 12 | LEGACY COMPATIBILITY / MIGRATION | Synchronized for backward compatibility |
| Fake "General" collections | 0 | CLEAN | No fake entities created |
| Duplicate collaboration args | 0 | CLEAN | Canonical camelCase args in `collaborationService.js` |

---

## 10. Test Execution Results

### Batch 8 Test Suite (`server/test_batch_8_service_api_consistency.py`)
- `test_ai_provider_canonical_configuration_and_normalization`: **PASSED**
- `test_collaboration_canonical_arguments`: **PASSED**
- `test_prompt_crud_canonical_collection_relationship`: **PASSED**
- `test_cross_user_collection_isolation`: **PASSED**
- `test_collection_rename_and_deletion_preserves_prompts`: **PASSED**
- `test_auth_status_code_semantics`: **PASSED**
**Summary**: 6 passed, 0 failed.

### Regression Test Suite (Batches 1–7)
- **Batch 1** (`test_collection_architecture_batch1.py`): **1/1 PASSED** (18/18 checks)
- **Batch 2** (`test_batch_2_collection_consistency.py`): **1/1 PASSED** (20/20 checks)
- **Batch 3** (`test_batch_3_ai_provider_playground.py`): **PASSED**
- **Batch 4** (`test_batch_4_ratings_versions_auth.py`): **6/6 PASSED**
- **Batch 5** (`test_batch_5_auth_session_rbac.py`): **5/5 PASSED**
- **Batch 6** (`test_batch_6_invitations_notifications.py`): **5/5 PASSED**
- **Batch 7** (`test_batch_7_async_race_conditions.py`): **6/6 PASSED**

---

## 11. Build and Compilation Verification
- **Frontend Build (`npm run build`)**: **PASS** (Built in 1.83s with 0 errors)
- **Backend Compilation (`py -m compileall app`)**: **PASS** (All modules compiled with 0 errors)

---

## 12. Database Integrity Verification
- `collection_prompts` foreign keys: Valid and verified
- Cross-user collection associations: Blocked (returns HTTP 404)
- Duplicate associations: Prevented by unique checks
- Legacy compatibility: Synchronized seamlessly during prompt updates
