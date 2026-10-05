# PromptCommit: AI Prompt Testing Platform
## Master Project Documentation & Verified Single Source of Truth

> **Codebase Audit Status**: Full-Stack Architecture verified against the active codebase on **September 22, 2026**.  
> **Frontend**: React 19 + Vite 8 Single Page Application with Tailwind CSS and React Router v7.  
> **Backend**: Python 3.14 + FastAPI REST API with Uvicorn server.  
> **Database**: MySQL (MariaDB 10.4.32 via SQLAlchemy 2.0 ORM and PyMySQL).  
> **Security**: JWT Authentication (HS256) + bcrypt password hashing.

---

## Audit Summary

| Metric / Category | Verified Count | Details |
| :--- | :---: | :--- |
| **Complete Modules** | **15** | Python FastAPI Backend, MySQL Relational Database, JWT Authentication with bcrypt, Prompt CRUD with Category & Tag Filtering, Git-Inspired Prompt Versioning & Rollbacks, Curated Collections, Prompt Favorites, Real DB Analytics, Prompt Testing Service (with local AI integration & non-fabrication error states), Export Engine (TXT/JSON/MD), Side-by-Side Prompt Compare, UI Design System, Router Layout, Dashboard, Demo Persona Switching. |
| **Partially Implemented Modules** | **1** | Collaboration Workspace (Basic collaborator sharing via shareable links and collaborator role assignment is backed by database; PR workflow queue is a UI-level simulation for future multi-user branch merges). |
| **UI Only / Simulated Modules** | **1** | Pull Request Branch Merge Queue in `Collaboration.jsx` (Interactive UI simulation showcasing multi-developer branch merge reviews; marked as UI Only / Planned for v2). |
| **Planned Modules** | **2** | WebSocket live multi-user cursor editing, Automated CI/CD prompt regression testing pipeline. |

---

## Important Honesty Note

> [!IMPORTANT]
> **This document describes the exact, verified implementation of PromptCommit as verified directly from the active code.**  
> - **Backend**: Python FastAPI with MySQL (`promptcommit_db`), SQLAlchemy ORM, and JWT authentication is **LIVE and FULLY IMPLEMENTED**.
> - **AI Integration**: The platform connects to real cloud AI providers: Google Gemini (`gemini-3.6-flash`), Groq (`openai/gpt-oss-20b`), OpenRouter (`openrouter/free`), and Mistral AI (`mistral-small-latest`). In strict compliance with academic and professional honesty, **AI outputs are never fabricated**. If an AI provider is offline or unconfigured, an authentic diagnostics error is logged and returned.
> - **Collaboration**: Simple collaborator sharing is backed by database tables (`prompt_shares`); team PR workflows remain a UI-level preview model clearly documented as such.

---

## Documentation Status Legend

- 🟢 **COMPLETE**: Genuinely implemented and verified in the active codebase.
- 🟡 **PARTIALLY IMPLEMENTED**: Core operations function with database backing; advanced workflows remain client-side or scoped.
- 🔵 **UI ONLY**: The interface element exists visually to illustrate upcoming workflows (e.g. simulated PR queues).
- ⚪ **PLANNED**: Explicitly scoped for future versions.

---

## 1. Full-Stack Architecture

```
                 USER
                   │
                   ▼
           React + Vite (Port 5173)
                   │
              REST API (JSON / Bearer JWT)
                   │
                   ▼
          Python + FastAPI (Port 8000)
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
 Authentication  Prompt      AI Service
 (JWT + bcrypt)  Services        │
       │           │             ▼
       │           │        Gemini / Groq /
       │           │        OpenRouter / Mistral
       │           │
       └───────────┼─────────────┘
                   ▼
          SQLAlchemy ORM (PyMySQL)
                   │
                   ▼
         MySQL (promptcommit_db)
```

---

## 2. Technology Stack

### Frontend
- **Framework**: React 19.2 + Vite 8.2
- **Routing**: React Router v7
- **Styling**: Tailwind CSS 3.4 (Custom SaaS Blue palette, full Light/Dark mode)
- **Icons**: Lucide React
- **API Client**: Modular service layer (`src/services/api.js`, `authService.js`, `promptService.js`, `versionService.js`, `collectionService.js`, `favoriteService.js`, `testService.js`, `analyticsService.js`)

### Backend (`/server`)
- **Runtime**: Python 3.10+ (Verified on Python 3.14.3)
- **Framework**: FastAPI 0.115+
- **ASGI Server**: Uvicorn 0.30+
- **ORM**: SQLAlchemy 2.0+
- **Database Driver**: PyMySQL 1.1+ with Cryptography
- **Authentication**: JWT (`pyjwt`) with `bcrypt` password hashing
- **Environment**: `python-dotenv` & `pydantic-settings`
- **HTTP Client**: `httpx` (for real AI service requests)
- **Validation**: Pydantic v2

### Database
- **Engine**: MySQL / MariaDB (via XAMPP or native service on port 3306)
- **Database Name**: `promptcommit_db`

---

## 3. Database Schema (9 Tables)

1. **`users`**:
   - `id` (VARCHAR(64), PK)
   - `name` (VARCHAR(100))
   - `username` (VARCHAR(50), UNIQUE, Indexed)
   - `email` (VARCHAR(191), UNIQUE, Indexed)
   - `password_hash` (VARCHAR(255))
   - `role` (VARCHAR(100))
   - `avatar` (VARCHAR(10))
   - `bio` (TEXT)
   - `theme` (VARCHAR(20))
   - `created_at`, `updated_at` (DATETIME)

2. **`prompts`**:
   - `id` (VARCHAR(64), PK)
   - `user_id` (VARCHAR(64), FK -> users.id)
   - `title` (VARCHAR(255))
   - `description` (TEXT)
   - `content` (TEXT)
   - `category` (VARCHAR(100))
   - `collection_name` (VARCHAR(100))
   - `target_model` (VARCHAR(100))
   - `version` (VARCHAR(30))
   - `rating` (FLOAT)
   - `rating_count` (INT)
   - `test_count` (INT)
   - `avg_latency_ms` (INT)
   - `is_private` (BOOLEAN)
   - `created_at`, `updated_at` (DATETIME)

3. **`prompt_tags`**:
   - `id` (INT, PK Auto-increment)
   - `prompt_id` (VARCHAR(64), FK -> prompts.id)
   - `tag` (VARCHAR(100), Indexed)

4. **`prompt_versions`**:
   - `id` (VARCHAR(64), PK)
   - `prompt_id` (VARCHAR(64), FK -> prompts.id)
   - `version_number` (VARCHAR(30))
   - `commit_message` (VARCHAR(255))
   - `description` (TEXT)
   - `diff_notes` (TEXT)
   - `content` (TEXT)
   - `author_name` (VARCHAR(100))
   - `is_current` (BOOLEAN)
   - `created_at` (DATETIME)

5. **`collections`**:
   - `id` (VARCHAR(64), PK)
   - `user_id` (VARCHAR(64), FK -> users.id)
   - `name` (VARCHAR(100))
   - `description` (TEXT)
   - `icon` (VARCHAR(50))
   - `color` (VARCHAR(50))
   - `created_at`, `updated_at` (DATETIME)

6. **`collection_prompts`**:
   - `collection_id` (VARCHAR(64), FK -> collections.id, PK)
   - `prompt_id` (VARCHAR(64), FK -> prompts.id, PK)

7. **`favorites`**:
   - `id` (VARCHAR(64), PK)
   - `user_id` (VARCHAR(64), FK -> users.id)
   - `prompt_id` (VARCHAR(64), FK -> prompts.id)
   - `created_at` (DATETIME)
   - UNIQUE(`user_id`, `prompt_id`)

8. **`prompt_tests`**:
   - `id` (VARCHAR(64), PK)
   - `prompt_id` (VARCHAR(64), FK -> prompts.id, Nullable)
   - `user_id` (VARCHAR(64), FK -> users.id)
   - `provider` (VARCHAR(100))
   - `model` (VARCHAR(100))
   - `input_text` (TEXT)
   - `output_text` (TEXT)
   - `response_time_ms` (INT)
   - `status` (VARCHAR(50))
   - `created_at` (DATETIME)

9. **`prompt_shares`**:
   - `id` (VARCHAR(64), PK)
   - `prompt_id` (VARCHAR(64), FK -> prompts.id)
   - `shared_with_email` (VARCHAR(191))
   - `shared_with_name` (VARCHAR(100))
   - `role` (VARCHAR(50))
   - `created_at` (DATETIME)

---

## 4. Implemented Features & Modules

### 4.1 Authentication & Security (🟢 COMPLETE)
- **Endpoints**: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- **Security**: Passwords hashed using bcrypt; JWT tokens validated via HTTP Bearer scheme; protected routes reject unauthenticated requests with HTTP 401.
- **Frontend**: `AuthContext.jsx` automatically loads session from token on startup and manages reactive user state.

### 4.2 Prompt Vault CRUD (🟢 COMPLETE)
- **Endpoints**: `POST /api/prompts`, `GET /api/prompts`, `GET /api/prompts/{id}`, `PUT /api/prompts/{id}`, `DELETE /api/prompts/{id}`, `POST /api/prompts/{id}/rate`.
- **Isolation**: Users only query and modify their own prompts in the database.
- **Filtering**: Real-time filtering by category, search substring, and collection.

### 4.3 Git-Inspired Prompt Versioning (🟢 COMPLETE)
- **Endpoints**: `GET /api/prompts/{id}/versions`, `POST /api/prompts/{id}/versions`, `POST /api/prompts/{id}/versions/{version_id}/restore`.
- **Behavior**: Versions are created **explicitly** via the versions endpoint (like git commits). Editing a prompt via `PUT /api/prompts/{id}` updates the prompt content directly without creating a version snapshot. To preserve a version, the user commits explicitly via `POST /api/prompts/{id}/versions` with a commit message and diff notes. One-click rollback restores previous prompt text and updates HEAD.
- **Terminology**: Transparently described as *Git-inspired Prompt Versioning*, not claim of raw Git filesystem hooks.

### 4.4 Curated Collections (🟢 COMPLETE)
- **Endpoints**: `POST /api/collections`, `GET /api/collections`, `PUT /api/collections/{id}`, `DELETE /api/collections/{id}`.
- **Behavior**: Creates folder organizations. Clicking a collection in the frontend routes to `/app/prompts?collection=<name>` to filter prompts within the existing library view.

### 4.5 Favorites (🟢 COMPLETE)
- **Endpoints**: `GET /api/favorites`, `POST /api/prompts/{id}/favorite`, `DELETE /api/prompts/{id}/favorite`.
- **Behavior**: Pinned prompts stored in MySQL with duplicate protection (`UNIQUE(user_id, prompt_id)`).

### 4.6 Playground & Testing Service (🟢 COMPLETE)
- **Endpoint**: `POST /api/tests`, `GET /api/tests`.
- **Behavior**: Sends requests to configured AI engine (`Google Gemini`, `Groq`, `OpenRouter`, or `Mistral AI`). Real response time is recorded. If provider is offline, returns structured status without generating fake text.

### 4.7 Database Analytics (🟢 COMPLETE)
- **Endpoint**: `GET /api/analytics/overview`.
- **Metrics**: Real aggregates queried from database (prompt count, version count, favorites, test executions, average response time, category breakdown, model usage). No fake numbers or fabricated charts.

### 4.8 Side-by-Side Prompt Compare (🟢 COMPLETE)
- Compares either 2 versions of the same prompt or 2 distinct prompts side-by-side with token estimates and diff inspection.

### 4.9 Export & Share (🟢 COMPLETE)
- Export to JSON, TXT, and Markdown files with optional version history inclusion. Simple collaborator assignment and shareable URL generation.

### 4.10 Team Collaboration (🟡 PARTIAL / 🔵 UI ONLY)
- Simple collaborator addition is backed by `prompt_shares` in the database.
- The Pull Request code review interface in `Collaboration.jsx` is an interactive demonstration model for upcoming team PR workflows.

---

## 5. Quick Start Commands

### 1. Database
Ensure MySQL / MariaDB is active on port 3306 (via XAMPP or service).

### 2. Backend
```bash
cd server
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 3. Frontend
```bash
npm run dev
```
- App URL: [http://localhost:5173](http://localhost:5173)

### 4. Integration Test Suite
```bash
cd server
python test_flow.py
```
- Validates 17 complete end-to-end backend tests against live MySQL database.

---

## 6. Top Viva Questions & Model Answers

1. **Q: What is the backend technology stack of PromptCommit?**  
   *A: The backend is built using Python with FastAPI, running on Uvicorn. It uses SQLAlchemy 2.0 ORM with PyMySQL to communicate with a MySQL database (`promptcommit_db`).*

2. **Q: How is authentication handled securely?**  
   *A: User passwords are encrypted with bcrypt (12 salt rounds) and stored as password hashes. Upon login, the backend issues an HS256 signed JSON Web Token (JWT), which the React client sends in the `Authorization: Bearer <token>` header for protected endpoints.*

3. **Q: How does prompt version control work?**  
   *A: It is a Git-inspired prompt versioning system backed by the `prompt_versions` table. Each commit preserves an immutable snapshot with version tag, commit message, author name, timestamp, and diff notes, allowing one-click rollbacks.*

4. **Q: How does the AI service work, and are outputs fabricated?**  
   *A: The AI service (`server/app/services/ai_service.py`) uses a provider abstraction layer connecting to official cloud endpoints: Google Gemini, Groq, OpenRouter, and Mistral AI. Responses are never fabricated: if the engine is offline or rate-limited, an authentic error status is returned.*

5. **Q: Are analytics numbers hardcoded?**  
   *A: No. The `/api/analytics/overview` endpoint aggregates real database counts, test response times, and version counts dynamically using SQLAlchemy queries.*
