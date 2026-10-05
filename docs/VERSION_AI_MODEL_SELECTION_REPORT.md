# VERSION AI MODEL SELECTION REPORT — PROMPTCOMMIT

## 1. Current Version Creation Flow
The version creation flow allows users to create new iterations/versions for existing prompts in the vault across `CreatePrompt.jsx` (New Version workflow mode) and `Versions.jsx` (Git version commit modal). The updated flow features full AI model selection and AI generation directly integrated into version creation.

## 2. AI Model Selector Implementation
- Integrated the single authoritative component `src/components/AIModelSelector.jsx`.
- Placed immediately above/near the "New Prompt Content" and "Generate with AI" action inside the modal.
- Provides canonical selection across all six supported provider/model configurations:
  1. Google Gemini — `gemini-3.6-flash` (Default)
  2. Google Gemini — `gemini-3.7-flash`
  3. Google Gemini — `gemini-3.8-flash`
  4. Groq — `openai/gpt-oss-20b`
  5. OpenRouter — `openrouter/free`
  6. Mistral AI — `mistral-small-latest`

## 3. Provider/Model Payload
- Frontend transmits canonical IDs (`provider: "gemini"`, `model: "gemini-3.6-flash"`) in generation and version commit payloads.
- Display names (e.g. "Google Gemini — Gemini 3.6 Flash") are used exclusively for rendering human-friendly UI text.

## 4. Version Model Persistence
- When committing a new version (e.g. V2.0), the selected model updates the parent prompt's `target_model` attribute in MySQL.
- Historical version data (e.g. V1.0) remains unmutated and untouched.

## 5. Backend Validation
- `server/app/core/ai_config.py` performs canonical provider/model normalization and validation.
- Endpoints `POST /api/prompts/generate` and `POST /api/prompts/{id}/versions` invoke `validate_ai_configuration(provider, model)`.
- Mismatched or unsupported combinations return HTTP 400 Bad Request with structured detail messages.

## 6. Rate-Limit Handling
- Upstream quota or rate-limit errors (HTTP 429 / quota exceeded) are returned intact without being swallowed or converted into generic messages.
- Users can switch to another supported AI provider (e.g., Groq `openai/gpt-oss-20b`) and retry generation seamlessly.

## 7. Async Cancellation Behavior
- Generation requests manage an active `AbortController` (`activeGenerateControllerRef`).
- When a user changes models or triggers a new generation while a request is in flight, the pending request is aborted.
- Request sequence IDs (`generateRequestIdRef`) guarantee older async generation responses cannot overwrite newer results.

## 8. Tests
- Created test suite `server/test_version_ai_model_selection.py` with 15 test cases covering:
  1. Default model is `gemini-3.6-flash`
  2. Existing version target_model loading
  3. Gemini model selection reaching backend
  4. Groq model selection reaching backend
  5. OpenRouter model selection reaching backend
  6. Mistral model selection reaching backend
  7. Invalid provider/model rejection (HTTP 400)
  8. Provider/model mismatch rejection (HTTP 400)
  9. Preservation of historical V1.0 when creating V2.0
  10. Model persistence for V2.0 target_model
  11. Rate limit error message preservation
  12. Switching provider/model after rate limit
  13. Prevention of invalid duplicate generation calls
  14. Stale async generation response protection
  15. Unauthorized user version creation block (HTTP 403/404)
- **Results**: 15 / 15 tests PASSED (OK).

## 9. Build
- `npm run build` executed successfully without errors (Built in 1.64s).

## 10. Compile
- `python -m compileall app` executed successfully with 0 errors across all Python modules.

## 11. Remaining Limitations
- None. All requirements met.
