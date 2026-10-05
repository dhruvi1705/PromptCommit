# AI MULTIMEDIA CAPABILITIES MATRIX

| Input Type | Provider | Model | Supported | Actual Transport |
|------------|----------|-------|-----------|------------------|
| Text | Gemini | gemini-3.6-flash | YES | JSON / Text prompt |
| Text | Gemini | gemini-3.7-flash | YES | JSON / Text prompt |
| Text | Gemini | gemini-3.8-flash | YES | JSON / Text prompt |
| Text | Groq | openai/gpt-oss-20b | YES | JSON / Text prompt |
| Text | OpenRouter | openrouter/free | YES | JSON / Text prompt |
| Text | Mistral | mistral-small-latest | YES | JSON / Text prompt |
| Image | Gemini | gemini-3.6-flash | YES | `types.Part.from_bytes` (Native Vision) |
| Image | Gemini | gemini-3.7-flash | YES | `types.Part.from_bytes` (Native Vision) |
| Image | Gemini | gemini-3.8-flash | YES | `types.Part.from_bytes` (Native Vision) |
| Image | Groq | openai/gpt-oss-20b | NO | Structured Error (`MULTIMODAL_NOT_SUPPORTED`) |
| Image | OpenRouter | openrouter/free | YES | `image_url` Base64 Data URL Part |
| Image | Mistral | mistral-small-latest | YES | `image_url` Base64 Data URL Part |
| PDF | Gemini | gemini-3.6-flash | YES | `pypdf` Extracted Page Text & Context |
| PDF | Gemini | gemini-3.7-flash | YES | `pypdf` Extracted Page Text & Context |
| PDF | Gemini | gemini-3.8-flash | YES | `pypdf` Extracted Page Text & Context |
| PDF | Groq | openai/gpt-oss-20b | YES | `pypdf` Extracted Page Text & Context |
| PDF | OpenRouter | openrouter/free | YES | `pypdf` Extracted Page Text & Context |
| PDF | Mistral | mistral-small-latest | YES | `pypdf` Extracted Page Text & Context |
| Code | Gemini | gemini-3.6-flash | YES | Structured Code Block with Language Tag |
| Code | Gemini | gemini-3.7-flash | YES | Structured Code Block with Language Tag |
| Code | Gemini | gemini-3.8-flash | YES | Structured Code Block with Language Tag |
| Code | Groq | openai/gpt-oss-20b | YES | Structured Code Block with Language Tag |
| Code | OpenRouter | openrouter/free | YES | Structured Code Block with Language Tag |
| Code | Mistral | mistral-small-latest | YES | Structured Code Block with Language Tag |
