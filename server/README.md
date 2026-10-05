# PromptCommit Backend

FastAPI + MySQL (SQLAlchemy ORM) REST API server for the PromptCommit platform.

---

## 1. Prerequisites & Python Version
- **Python**: Python 3.10+ (Tested and verified with **Python 3.14.3** on Windows)
- **Database**: MySQL or MariaDB (via XAMPP, standalone MySQL, or Docker)
- **Node.js**: Node 18+ (for frontend Vite server)

---

## 2. Virtual Environment Setup

From the project root:
```bash
cd server
py -m venv venv
```

Activate the virtual environment:
- **Windows (PowerShell)**:
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
- **Windows (Command Prompt)**:
  ```cmd
  venv\Scripts\activate.bat
  ```
- **Linux / macOS**:
  ```bash
  source venv/bin/activate
  ```

---

## 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 4. MySQL Database Setup

1. Start your local MySQL daemon (e.g. from XAMPP Control Panel or `mysqld.exe`).
2. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS promptcommit_db;
   ```
3. Tables are **automatically created** on startup via SQLAlchemy's `Base.metadata.create_all(bind=engine)`.
4. Standard demo user accounts (`aanshi@promptcommit.dev` / `password123` and `dhruvi@promptcommit.dev` / `password123`) and baseline prompts are automatically seeded if the database is newly created.

---

## 5. Configure Environment (`.env`)

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment variables:
```env
# Database URL (PyMySQL driver)
DATABASE_URL=mysql+pymysql://root:@localhost:3306/promptcommit_db

# Security
JWT_SECRET_KEY=promptcommit_super_secret_jwt_key_university_project_2026_x89f
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Allowed CORS origins
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# AI Cloud Providers
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
```

---

## 6. Starting FastAPI Server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Or using Python:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

---

## 7. Interactive API Documentation
- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc API Catalog**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 8. Starting React Frontend

In another terminal window:
```bash
cd ..  # return to project root
npm run dev
```
Frontend will be accessible at: [http://localhost:5173](http://localhost:5173)

---

## 9. Running Automated Backend Tests

With FastAPI running:
```bash
cd server
python test_flow.py
```
This script validates:
- Health check
- User signup and login
- JWT token authentication
- Prompt CRUD operations
- Git-inspired prompt version creation & history
- Collection creation and prompt grouping
- Favorite pinning
- Real AI test execution / local provider check
- Real database analytics aggregates
- Protected endpoint rejection on missing token
