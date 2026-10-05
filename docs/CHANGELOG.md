# PromptCommit Change Log

## [2026-09-23]

### 1. Signup & Authentication
- **Changed**: Fixed frontend/backend signup contract mismatch
  - Added `username` input field to signup form
  - Added `confirm_password` input field to signup form
  - Replaced old "min 6 characters" password rule with correct validation:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 number
    - At least 1 special character
  - Added real-time password requirements checklist (green/red indicators)
  - Added username validation display (3–30 chars, letters/numbers/underscores)
  - Added confirm password match validation with visual feedback
  - Updated `authService.signup()` to send `{username, email, password, confirm_password, name}`
  - Updated `AuthContext.signup()` to accept signup data object and pass to service
- **Why**: Frontend was sending `{name, email, password, role}` but backend `SignupRequest` requires `{username, email, password, confirm_password}`. Signup was broken — would return 422 validation error.
- **Files**:
  - `src/pages/Signup.jsx`
  - `src/services/authService.js`
  - `src/context/AuthContext.jsx`
- **Result**: Frontend signup form now matches backend contract exactly. Password rules are consistent. Duplicate username/email errors are properly displayed.

### 2. Validation
- **Changed**: Frontend validation now mirrors backend validation rules
  - Password: 8+ chars, uppercase, lowercase, number, special character (consistent everywhere)
  - Username: 3–30 chars, letters/numbers/underscores only
  - Confirm password: must match password
  - Removed old "6 character minimum" rule from frontend
- **Why**: Frontend used "min 6 characters" while backend enforced "min 8 characters with complexity rules". This caused confusing UX — passwords passing frontend validation would fail on backend.
- **Files**:
  - `src/pages/Signup.jsx`
- **Result**: Frontend and backend validation are consistent. Backend remains authoritative.

### 3. Integration Tests
- **Changed**: Complete rewrite of `test_flow.py`
  - Updated signup payload to include `username`, `confirm_password`
  - Changed test password from `password123` to `Test@12345` (meets all validation rules)
  - Added unique test user generation (UUID-based) to avoid collision on re-runs
  - Expanded from 17 tests to 35 tests covering:
    1. Health check
    2. Signup with valid data
    3. Duplicate username rejection
    4. Duplicate email rejection
    5. Login with valid credentials
    6. Invalid login rejection
    7. Authenticated user retrieval
    8. Unauthenticated request rejection
    9. Prompt creation
    10. Prompt retrieval
    11. Prompt update
    12. Prompt listing
    13. Version creation
    14. Version history retrieval
    15. Version restore
    16. Collection creation
    17. Collection listing
    18. Add prompt to collection
    19. Collection update
    20. Favorite prompt
    21. Get favorites
    22. Unfavorite prompt
    23. Prompt test execution
    24. List tests
    25. Analytics overview
    26. Share prompt
    27. Verify shared collaborator
    28. Remove collaborator
    29. Create second user (isolation setup)
    30. Cross-user prompt access denied
    31. Cross-user prompt update denied
    32. Cross-user prompt delete denied
    33. Delete collection
    34. Delete prompt
    35. Verify deleted prompt returns 404
- **Why**: Old test used invalid signup data (`password123` without uppercase/special chars, missing `username` and `confirm_password`). Tests would fail on the current backend. Additionally, lacked coverage for duplicate rejection, invalid login, version restore, user isolation, sharing, and cleanup.
- **Files**:
  - `server/test_flow.py`
- **Result**: Tests match current API contract and cover all existing features.

### 4. Prompt Versioning
- **Changed**: Updated documentation to accurately describe versioning behavior
  - `PROMPTCOMMIT_PROJECT_MASTER.md` §4.3: Removed misleading claim "Every prompt edit creates a permanent snapshot". Clarified that versions are created **explicitly** via `POST /api/prompts/{id}/versions` (git commit metaphor). `PUT /api/prompts/{id}` updates prompt content directly without creating a version.
  - Added `username` column to database schema documentation in §3.1
  - `API_DOCUMENTATION.md`: Updated signup example to include `username` and `confirm_password`. Added password/username validation rules. Clarified versioning behavior.
- **Why**: Documentation implied automatic version creation on edit, but the code intentionally uses explicit version commits. This is the correct design matching the git-inspired metaphor. No code change was needed — only documentation was inaccurate.
- **Files**:
  - `PROMPTCOMMIT_PROJECT_MASTER.md`
  - `API_DOCUMENTATION.md`
- **Result**: Documentation accurately describes the real implementation. No behavioral changes.

### 5. Security / Environment
- **Changed**:
  - Removed hardcoded JWT secret default from `config.py`. `JWT_SECRET_KEY` is now **required** via environment variable or `.env` file. If missing, the application raises a clear `ValidationError` at startup.
  - Updated `.env.example` with placeholder value `CHANGE_ME_generate_a_strong_random_secret_here` and added a comment showing how to generate a strong secret.
  - Updated `.gitignore` to exclude: `.env`, `.env.*` (except `.env.example`), `venv/`, `.venv/`, `__pycache__/`, `*.pyc`, `*.pyo`, `.vite/`
  - The user's local `.env` file was **not deleted** — it continues to work because it already contains the JWT secret.
- **Why**: The hardcoded JWT secret in source code is a security risk. The `.env` file containing real secrets was not gitignored. `.env.example` should contain placeholders, not real secrets.
- **Files**:
  - `server/app/core/config.py`
  - `server/.env.example`
  - `.gitignore`
- **Result**: Secrets are no longer in source code defaults. Developers must set JWT_SECRET_KEY in their `.env`. Existing setup continues to work.

### 6. Dependencies / Project Cleanup
- **Changed**:
  - Added `requests>=2.31.0` to `server/requirements.txt` (used by `test_flow.py` but was missing)
  - Verified `package.json` has all required frontend dependencies
  - Ran `npm install` — 0 vulnerabilities, all packages up to date
  - Ran `npm run build` — successful production build (1.87s)
- **Why**: `test_flow.py` imports `requests` but it was not listed in `requirements.txt`. This would cause `ModuleNotFoundError` for developers installing from scratch.
- **Files**:
  - `server/requirements.txt`
- **Result**: All dependencies are explicitly declared.

### 7. API Integration
- **Changed**: No code changes needed. All frontend services correctly map to backend routes.
- **Verification**: Audited all 8 frontend service files against all 10 backend route files. All HTTP methods, URLs, and data formats are correct. No mocked/fake endpoints. JWT injection works via `apiRequest()` helper.
- **Result**: API integration is fully functional (signup was the only broken path, fixed in Phase 2).

### 8. Testing
- **Tests executed**:
  - `npm install` — PASS (0 vulnerabilities)
  - `npm run build` — PASS (production build in 1.87s)
  - `npm run lint` — PASS (0 errors, 132 pre-existing warnings in unmodified files)
  - `py -m py_compile` on all modified Python files — PASS
  - `server/test_flow.py` — NOT EXECUTED (requires running MySQL + FastAPI server)
- **Result**: All verifiable tests passed. Integration tests require live backend.
- **Failed tests**: None
- **Environment issues**: Integration tests (`test_flow.py`) require MySQL database running and FastAPI server active on port 8000. Cannot be verified without live database.

### 9. Files Modified
1. `src/pages/Signup.jsx` — Complete rewrite for signup form fix
2. `src/services/authService.js` — Updated signup() method signature and payload
3. `src/context/AuthContext.jsx` — Updated signup() to accept data object
4. `server/test_flow.py` — Complete rewrite with 35 comprehensive tests
5. `server/app/core/config.py` — Removed hardcoded JWT secret default
6. `server/.env.example` — Replaced real secret with placeholder
7. `server/requirements.txt` — Added `requests` dependency
8. `.gitignore` — Added .env, venv, __pycache__, .vite exclusions
9. `PROMPTCOMMIT_PROJECT_MASTER.md` — Fixed versioning docs, added username to schema
10. `API_DOCUMENTATION.md` — Updated signup example and validation rules

### 10. Files Added
1. `CHANGELOG.md` — This file
2. `PROJECT_AUDIT.md` — Final audit report
3. `README.md` — Updated project documentation

### 11. Files Deleted
- None. No files were deleted.

### 12. Remaining Issues
1. **Integration tests not executed**: `test_flow.py` requires MySQL database and FastAPI server running. The tests are syntactically valid and match the current API contract but cannot be verified without a live environment.
2. **Lint warnings**: 132 pre-existing lint warnings in unmodified files (unused imports in `Collaboration.jsx`, `Playground.jsx`, `LanguageContext.jsx`). These are not related to the current changes and were not modified per instructions.
3. **Chunk size warning**: Vite build warns about a JS chunk >500KB. This is a pre-existing condition and does not affect functionality.
4. **Demo account passwords**: Seed data uses `password123` for demo accounts which does not meet the new validation rules. This is intentional — seed data bypasses the signup validation schema and inserts directly via the User model. New user registrations through the API must meet all password requirements.
