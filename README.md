# PromptCommit — AI Prompt Testing Platform

A full-stack private workspace for building, testing, versioning, and managing AI prompts with Git-inspired version control.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite 8, Tailwind CSS, React Router v7, Lucide Icons |
| **Backend** | Python 3.10+ FastAPI, Uvicorn |
| **Database** | MySQL / MariaDB via SQLAlchemy 2.0 ORM (PyMySQL) |
| **Authentication** | JWT (HS256) + bcrypt password hashing |
| **AI Integration** | Google Gemini, Groq, OpenRouter, Mistral AI |

---

## Quick Start

### 1. Database Setup

Ensure MySQL / MariaDB is running on port 3306 (e.g. via XAMPP):

```sql
CREATE DATABASE IF NOT EXISTS promptcommit_db;
```

Tables are automatically created on backend startup.

### 2. Backend Setup

```bash
cd server
py -m venv venv
.\venv\Scripts\Activate.ps1    # Windows PowerShell
pip install --upgrade pip
pip install -r requirements.txt
```

#### Configure Environment

```bash
cp .env.example .env
```

**Edit `server/.env`** and set a strong JWT secret:
```env
JWT_SECRET_KEY=your-strong-random-secret-here
```

Generate a secret with: `python -c "import secrets; print(secrets.token_urlsafe(64))"`

#### Start Backend Server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Swagger UI: http://localhost:8000/docs
- Health Check: http://localhost:8000/api/health

### 3. Frontend Setup

From the project root:

```bash
npm install
npm run dev
```

- App URL: http://localhost:5173

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | No | `mysql+pymysql://root:@localhost:3306/promptcommit_db` | SQLAlchemy database connection string |
| `JWT_SECRET_KEY` | **Yes** | — | Secret key for JWT token signing. Must be set. |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` (24h) | Token expiration in minutes |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins |
| `GEMINI_API_KEY` | No | — | Google Gemini API key |
| `GROQ_API_KEY` | No | — | Groq Cloud API key |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key |
| `MISTRAL_API_KEY` | No | — | Mistral AI API key |

---

## Signup / Password Requirements

**Username**: 3–30 characters, letters, numbers, and underscores only.

**Password**:
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character

---

## Running Tests

With the FastAPI backend running:

```bash
cd server
python test_flow.py
```

This runs 35 integration tests covering signup, login, prompt CRUD, versioning, collections, favorites, analytics, sharing, and user isolation.

---

## Demo Accounts

On first startup with an empty database, two demo accounts are seeded:

| Name | Email | Password |
|------|-------|----------|
| Aanshi Shah | aanshi@promptcommit.dev | password123 |
| Dhruvi Khatri | dhruvi@promptcommit.dev | password123 |

These accounts include sample prompts, collections, and version history.

---

## Project Structure

```
project/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── context/            # React contexts (Auth, Prompt, Toast, Language)
│   ├── pages/              # Page components (15 pages)
│   ├── services/           # API service layer (8 service modules)
│   └── utils/              # Utility functions
├── server/                 # Python FastAPI backend
│   ├── app/
│   │   ├── core/           # Config, database, security
│   │   ├── models/         # SQLAlchemy models (7 models)
│   │   ├── routes/         # API route handlers (9 route files)
│   │   ├── schemas/        # Pydantic validation schemas
│   │   ├── services/       # Business logic services
│   │   └── utils/          # Auth dependencies
│   ├── .env.example        # Environment template
│   ├── requirements.txt    # Python dependencies
│   └── test_flow.py        # Integration tests
├── package.json            # Frontend dependencies
└── vite.config.js          # Vite configuration
```

---

## Features

- **Prompt CRUD** with category, tag, and collection filtering
- **Git-inspired versioning** — explicit commits with messages, diff notes, and one-click rollback
- **Curated collections** — organize prompts into folders
- **Favorites** — pin important prompts
- **AI Playground** — test prompts against Google Gemini, Groq, OpenRouter, and Mistral AI
- **Analytics** — real database aggregates (not hardcoded)
- **Sharing** — add collaborators with role-based permissions
- **Side-by-side compare** — diff two prompt versions or prompts
- **Export** — JSON, TXT, Markdown
- **User isolation** — complete data separation between accounts
