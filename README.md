# PromptCommit — AI Prompt Testing Platform

PromptCommit is a full-stack AI prompt engineering workspace for creating, testing, versioning, comparing, organizing, and collaborating on AI prompts. Built around a Git-inspired version control model, it brings the discipline of software engineering to prompt development — explicit commits, version history, diff comparisons, and rollback — so teams and individuals can iterate on prompts with the same rigor they apply to code.

---

## 🌐 Live Demo

**Frontend:** [https://dhruvi1705.github.io/PromptCommit/](https://dhruvi1705.github.io/PromptCommit/)

> **Note:** The live demo hosts the React frontend via GitHub Pages. The FastAPI backend and MySQL database are configured for local development and are not included in the GitHub Pages deployment. To experience the full application (AI playground, versioning, collaboration, analytics), run the backend and database locally using the [Getting Started](#-getting-started) instructions below.

---

## 📌 Overview

Prompt engineering is becoming a core skill in modern AI development, yet most workflows still treat prompts as throwaway text — edited in place, untested, and unversioned. PromptCommit changes that.

**Core philosophy: "Treat prompts like code."**

Just as Git revolutionized collaborative software development with commits, diffs, branching, and history, PromptCommit applies those same principles to prompt engineering:

- **Commit** every meaningful change with a message describing what changed and why.
- **Compare** versions side-by-side to understand how a prompt evolved.
- **Rollback** to any previous version when a change doesn't perform as expected.
- **Collaborate** with teammates through role-based permissions and shared workspaces.
- **Test** prompts against multiple AI providers in a unified playground.

The result is a structured, auditable, and collaborative workflow for prompt development.

---

## ✨ Features

### Prompt Management
- Create, edit, and delete prompts
- Filter by category, tag, or collection
- Organize prompts into curated collections

### Git-Inspired Version Control
- Explicit commits with descriptive commit messages
- Full version history for every prompt
- Diff notes documenting what changed between versions
- Side-by-side version comparison
- One-click rollback to any previous version

### AI Playground
Test prompts against multiple AI providers from a single interface:
- Google Gemini
- Groq
- OpenRouter
- Mistral AI

### Analytics Dashboard
- Database-backed analytics with real aggregates
- Activity tracking and productivity insights

### Collaboration
- Add collaborators to prompts
- Role-based permissions
- Shared prompt access across team members

### Compare
- Side-by-side prompt comparison
- Version-to-version diff comparison

### Collections
- Group related prompts into named collections

### Favorites
- Mark frequently used prompts as favorites for quick access

### Export
- Export prompts in JSON, TXT, or Markdown format

### Authentication & Security
- JWT-based authentication (HS256)
- bcrypt password hashing
- Protected API routes
- Configurable CORS policies

### User Isolation
- Complete data separation between user accounts

---

## 🧠 Core Workflow

```
  ┌─────────────────┐
  │  CREATE PROMPT   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   EDIT PROMPT    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ COMMIT VERSION   │
  │  (with message)  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ VERSION HISTORY  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │    COMPARE       │
  │  (side-by-side)  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │    ROLLBACK      │
  │ (if needed)      │
  └─────────────────┘
```

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Browser                           │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│              React 19 + Vite 8 Frontend                  │
│         (Tailwind CSS · React Router v7)                 │
└────────────────────────┬─────────────────────────────────┘
                         │  REST API
                         ▼
┌──────────────────────────────────────────────────────────┐
│               FastAPI Backend (Uvicorn)                   │
│            (JWT Auth · SQLAlchemy ORM)                    │
├──────────────┬───────────────────────────────────────────┤
│              │              AI Providers                  │
│              │  ┌─────────┬──────────┬─────────────────┐ │
│              │  │ Gemini  │  Groq    │  OpenRouter     │ │
│              │  │         │          │  Mistral AI     │ │
│              │  └─────────┴──────────┴─────────────────┘ │
└──────────────┼───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│              MySQL / MariaDB Database                    │
│           (SQLAlchemy 2.0 · PyMySQL)                     │
└──────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer               | Technology                          |
|----------------------|-------------------------------------|
| **Frontend**         | React 19                            |
| **Build Tool**       | Vite 8                              |
| **Styling**          | Tailwind CSS                        |
| **Routing**          | React Router v7                     |
| **Icons**            | Lucide React                        |
| **Backend**          | Python 3.10+ · FastAPI              |
| **Server**           | Uvicorn                             |
| **Database**         | MySQL / MariaDB                     |
| **ORM**              | SQLAlchemy 2.0                      |
| **Database Driver**  | PyMySQL                             |
| **Authentication**   | JWT (HS256)                         |
| **Password Security**| bcrypt                              |
| **AI Providers**     | Google Gemini · Groq · OpenRouter · Mistral AI |
| **Testing**          | Python integration test suite       |
| **Deployment**       | GitHub Pages + GitHub Actions       |

---

## 📂 Project Structure

```
project/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment
├── src/
│   ├── components/             # Reusable UI components
│   ├── context/                # React contexts (Auth, Prompt, etc.)
│   ├── pages/                  # Page-level components
│   ├── services/               # API service layer
│   └── utils/                  # Utility functions
├── server/
│   ├── app/
│   │   ├── core/               # Config, database, security
│   │   ├── models/             # SQLAlchemy models
│   │   ├── routes/             # API route handlers
│   │   ├── schemas/            # Pydantic validation schemas
│   │   ├── services/           # Business logic services
│   │   └── utils/              # Auth dependencies
│   ├── .env.example            # Environment variable template
│   ├── requirements.txt        # Python dependencies
│   └── test_flow.py            # Integration test suite
├── public/                     # Static assets
├── package.json                # Frontend dependencies
├── vite.config.js              # Vite configuration
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+ recommended)
- **Python** 3.10+
- **MySQL** or **MariaDB** (e.g., via XAMPP) running on port `3306`
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/dhruvi1705/PromptCommit.git
cd PromptCommit
```

### 2. Database Setup

Ensure MySQL / MariaDB is running, then create the database:

```sql
CREATE DATABASE IF NOT EXISTS promptcommit_db;
```

> Tables are automatically created on backend startup via SQLAlchemy.

### 3. Backend Setup

```bash
cd server
```

Create and activate a virtual environment (Windows PowerShell):

```powershell
py -m venv venv
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Environment Configuration

```bash
cp .env.example .env
```

Edit `server/.env` and configure the required variables. At minimum, set a strong JWT secret:

```bash
# Generate a secure secret
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Set the generated value as `JWT_SECRET_KEY` in your `.env` file. See the [Environment Variables](#-environment-variables) section for the full list.

> **⚠️ Never commit your `.env` file.** It should remain in `.gitignore`.

### 5. Start the Backend

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

| Endpoint     | URL                              |
|-------------|----------------------------------|
| API Server  | http://localhost:8000            |
| Swagger UI  | http://localhost:8000/docs       |
| Health Check| http://localhost:8000/api/health  |

### 6. Start the Frontend

From the project root (in a separate terminal):

```bash
npm install
npm run dev
```

| Endpoint   | URL                     |
|-----------|-------------------------|
| Frontend  | http://localhost:5173    |

---

## 🔑 Environment Variables

All environment variables are configured in `server/.env`. A template is provided in `server/.env.example`.

| Variable                       | Required | Description                                    |
|--------------------------------|----------|------------------------------------------------|
| `DATABASE_URL`                 | No       | SQLAlchemy connection string (defaults to local MySQL) |
| `JWT_SECRET_KEY`               | **Yes**  | Secret key for signing JWT tokens              |
| `JWT_ALGORITHM`                | No       | JWT signing algorithm (default: `HS256`)       |
| `ACCESS_TOKEN_EXPIRE_MINUTES`  | No       | Token expiry in minutes (default: `1440`)      |
| `CORS_ORIGINS`                 | No       | Comma-separated list of allowed origins        |
| `GEMINI_API_KEY`               | No       | Google Gemini API key                          |
| `GROQ_API_KEY`                 | No       | Groq Cloud API key                             |
| `OPENROUTER_API_KEY`           | No       | OpenRouter API key                             |
| `MISTRAL_API_KEY`              | No       | Mistral AI API key                             |

> **Security:** Store all secrets in environment variables. Never hardcode API keys, JWT secrets, or passwords in source code.

---

## 🧪 Testing

The project includes a Python integration test suite that validates core functionality end-to-end.

### Running Tests

With the backend server running:

```bash
cd server
python test_flow.py
```

### Test Coverage Areas

- User signup and login
- Prompt CRUD operations
- Version control (commit, history, rollback)
- Collections management
- Favorites
- Analytics
- Sharing and collaboration
- User isolation between accounts

---

## 🔄 Deployment

The React frontend is automatically deployed to **GitHub Pages** via a **GitHub Actions** workflow on every push to `main`.

**Live URL:** [https://dhruvi1705.github.io/PromptCommit/](https://dhruvi1705.github.io/PromptCommit/)

### Deployment Flow

```
  Git Push (main)
       │
       ▼
  GitHub Actions
       │
       ├── npm ci
       ├── npm run build
       │
       ▼
  Vite → dist/
       │
       ▼
  GitHub Pages
       │
       ▼
  Live Frontend
```

The Vite configuration uses `base: '/PromptCommit/'` to support the GitHub Pages subdirectory.

> **Important:** The GitHub Pages deployment hosts the frontend only. The FastAPI backend and MySQL database are not deployed to production and must be run locally for full functionality. AI playground features, data persistence, and authentication require a running backend instance.

---

## 🔒 Security

| Measure                  | Implementation                                           |
|--------------------------|----------------------------------------------------------|
| **Authentication**       | JWT tokens with HS256 signing algorithm                 |
| **Password Hashing**     | bcrypt with automatic salting                           |
| **Protected Routes**     | Token-verified API endpoints                            |
| **User Isolation**       | Complete data separation between accounts               |
| **Role-Based Access**    | Collaboration permissions (owner, collaborator)         |
| **Environment Variables**| Secrets stored outside source code                      |
| **CORS**                 | Configurable allowed origins                            |

### Password Requirements

| Rule                      | Requirement                            |
|---------------------------|----------------------------------------|
| Length                    | Minimum 8 characters                   |
| Uppercase                | At least 1 uppercase letter (A–Z)      |
| Lowercase                | At least 1 lowercase letter (a–z)      |
| Number                   | At least 1 digit (0–9)                 |
| Special Character        | At least 1 special character           |

### Username Requirements

- 3–30 characters
- Letters, numbers, and underscores only

> **⚠️ Never commit `.env` files, passwords, JWT secrets, or API keys to version control.**

---

## 🧭 Application Routes

### Public Routes

| Route             | Description               |
|-------------------|---------------------------|
| `/`               | Landing page              |
| `/login`          | User login                |
| `/signup`         | User registration         |
| `/invite/:token`  | Collaboration invite link |

### Private Workspace Routes

| Route                 | Description                     |
|-----------------------|---------------------------------|
| `/app`                | Dashboard                       |
| `/app/prompts`        | Prompt library                  |
| `/app/create`         | Create new prompt               |
| `/app/playground`     | AI testing playground           |
| `/app/versions`       | Version history                 |
| `/app/compare`        | Side-by-side comparison         |
| `/app/toolkit`        | Toolkit                         |
| `/app/collections`    | Collections manager             |
| `/app/favorites`      | Favorited prompts               |
| `/app/collaboration`  | Collaboration management        |
| `/app/analytics`      | Analytics dashboard             |
| `/app/settings`       | User settings                   |

---

## 🎯 Project Goals

PromptCommit was built around a single engineering thesis:

> **"Treat prompts like code."**

In traditional software development, version control is non-negotiable — every change is tracked, every release is tagged, and every regression can be rolled back. Prompt engineering, despite being central to modern AI applications, lacks this discipline.

| Software Engineering      | Prompt Engineering (PromptCommit) |
|---------------------------|-----------------------------------|
| `git commit -m "message"` | Commit prompt version with notes  |
| `git diff`                | Side-by-side prompt comparison    |
| `git log`                 | Full version history              |
| `git revert`              | One-click rollback                |
| GitHub collaborators      | Role-based prompt sharing         |
| CI test suite             | AI playground testing             |

PromptCommit bridges this gap by providing a structured workspace where prompt engineers can iterate with confidence, collaborate effectively, and maintain a complete audit trail of their work.

---

## 📈 Future Improvements

- Production backend deployment (cloud hosting)
- Cloud-hosted database (managed MySQL or PostgreSQL)
- Additional AI provider integrations
- Prompt benchmarking and evaluation metrics
- Advanced analytics and usage dashboards
- Team workspaces with organization-level management
- Prompt template library
- Multi-model comparison in the playground
- CI/CD integration testing pipeline

---

## 👩‍💻 Author

**Dhruvi Khatri**
B.Tech — Computer Engineering

GitHub: [github.com/dhruvi1705](https://github.com/dhruvi1705)

---

## 📄 License

This project is intended for educational, portfolio, and development purposes.
