# MULTIMEDIA INPUT PIPELINE REPORT

## 1. Root Cause
Previously, multimedia attachments (images, PDFs, code snippets) were stored as browser-only object URLs (`URL.createObjectURL(file)`) or local state flags (`hasImage=true`, "Vision Ready"). The frontend API service sent JSON payloads containing only metadata or text prompts without transmitting actual binary content or extracted text payload to the FastAPI backend endpoints (`/api/tests/run`). Consequently, the AI inference service only received text inputs and responded with "I can't see the image..." or ignored attached files.

## 2. Current Multimedia Architecture
The complete multimedia input pipeline was refactored end-to-end to transmit actual binary bytes or extracted document content from user interactions in the Playground/AIToolkit to AI provider inference calls.

```
USER ATTACHMENT (File / Code / Text)
       ↓
FRONTEND STATE (Playground / AIToolkit)
       ↓
FormData / Multipart API Transport (api.js / testService.js)
       ↓
FastAPI Request (`UploadFile` + form metadata)
       ↓
MultimediaProcessor (`server/app/services/multimedia_processor.py`)
       ↓
Provider Capability Check & Formatting (`server/app/services/ai_service.py`)
       ↓
AI Provider Payload (Gemini / Groq / OpenRouter / Mistral)
       ↓
Model Response Generation & Telemetry Logging
```

## 3. Query Pipeline
- **Transport**: Standard JSON or FormData with `input_type="text"`.
- **Backend**: Validates string prompt.
- **Provider Payload**: Direct text string to LLM endpoint.

## 4. Image Pipeline
- **Transport**: `FormData` binary upload (`file` key) or Base64 payload.
- **Backend**: `MultimediaProcessor` verifies file size (max 10MB) and MIME type (`image/png`, `image/jpeg`, `image/webp`, `image/gif`). Sanitizes filename and reads raw bytes.
- **Provider Integration**:
  - **Gemini**: Constructs `types.Part.from_bytes(data=raw_bytes, mime_type=mime_type)` passed directly to `client.interactions.create`.
  - **OpenRouter**: Converts raw bytes to base64 data URL `data:<mime>;base64,<data>` in standard OpenAI-compatible `image_url` content parts.
  - **Mistral**: Converts raw bytes to base64 data URL `data:<mime>;base64,<data>` in standard Mistral-compatible `image_url` content parts.
  - **Groq**: Rejects image input with clean structured `MULTIMODAL_NOT_SUPPORTED` error (`openai/gpt-oss-20b` is text/PDF/code only).

## 5. PDF Pipeline
- **Transport**: `FormData` binary upload (`file` key) with `application/pdf`.
- **Backend**: `MultimediaProcessor.extract_pdf_text()` extracts text content per page using `pypdf` with fallback regex stream parser.
- **Provider Integration**: Combines extracted text content into structured prompt wrapper passed cleanly to any configured LLM model without binary payload rejection.

## 6. Code Pipeline
- **Transport**: `input_type="code"`, `text_content=<source_code>`, `language=<lang>`.
- **Backend**: Validates non-empty code content and language tag.
- **Provider Integration**: Formats code block with markdown fence ` ```<language> ` embedded into prompt payload.

## 7. API Transport
[`src/services/api.js`](file:///c:/Users/riyap/Downloads/project/src/services/api.js) automatically inspects request bodies. When `body instanceof FormData`, it omits `Content-Type: application/json` headers and allows the browser `fetch` engine to automatically construct `multipart/form-data` with exact boundary identifiers.

## 8. Backend Processing
[`server/app/services/multimedia_processor.py`](file:///c:/Users/riyap/Downloads/project/server/app/services/multimedia_processor.py) provides unified `MultimediaInput` validation and safety metadata logging (`safe_log_dict()`), ensuring raw bytes or text payloads are validated before provider transmission without leaking sensitive byte sequences into logs.

## 9. AI Provider Integration
[`server/app/services/ai_service.py`](file:///c:/Users/riyap/Downloads/project/server/app/services/ai_service.py) enforces provider adapters for Gemini, Groq, OpenRouter, and Mistral.

## 10. Capability Matrix
See [`AI_MULTIMEDIA_CAPABILITIES.md`](file:///c:/Users/riyap/Downloads/project/AI_MULTIMEDIA_CAPABILITIES.md) for full breakdown across models.

## 11. Security Validation
- Max file size cap enforced at 10MB.
- Filenames sanitized via `re.sub(r'[^\w\.-]', '_', safe_filename)` to prevent path traversal attacks.
- Safe logging strips binary content and raw byte values from server logs.

## 12. Request Cancellation
Frontend uses `AbortController` and `useRef` tokens to abort stale requests on rapid model switches or button re-clicks, preventing out-of-order state mutations.

## 13. Tests
Added [`server/test_batch_10_multimedia_pipeline.py`](file:///c:/Users/riyap/Downloads/project/server/test_batch_10_multimedia_pipeline.py) covering 15 dedicated test cases. All 15 tests pass.

## 14. Manual Verification
Verified Playground and AIToolkit workflows for Query, Image, PDF, and Code attachments across Gemini and fallback providers.

## 15. Build
- `npm run build`: PASS
- `compileall app`: PASS
