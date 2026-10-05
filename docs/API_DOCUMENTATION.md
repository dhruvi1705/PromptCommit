# PromptCommit REST API Documentation

Comprehensive reference documentation for the PromptCommit Python FastAPI backend connected to MySQL via SQLAlchemy ORM.

**Base URL**: `http://localhost:8000/api`  
**Swagger UI**: `http://localhost:8000/docs`  
**ReDoc**: `http://localhost:8000/redoc`

---

## Authentication & Headers

Protected routes require an `Authorization` header with a valid JWT Bearer token:
```http
Authorization: Bearer <access_token>
```

---

## Endpoints Catalog

### 1. System & Health

#### `GET /api/health`
- **Description**: Verify backend status and MySQL database connectivity.
- **Authentication**: Public
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "service": "PromptCommit API",
  "version": "1.0.0",
  "database": "MySQL (Connected)"
}
```

---

### 2. Authentication

#### `POST /api/auth/signup`
- **Description**: Register a new user account with hashed password (`bcrypt`) and issue a JWT token.
- **Authentication**: Public
- **Request Body**:
```json
{
  "username": "janedoe",
  "email": "jane@promptcommit.dev",
  "password": "StrongPass@123",
  "confirm_password": "StrongPass@123",
  "name": "Jane Doe"
}
```
- **Password Requirements**:
  - Minimum 8 characters
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 number (0-9)
  - At least 1 special character
- **Username Requirements**:
  - 3–30 characters
  - Letters, numbers, and underscores only
- **Validation Errors**: `422 Unprocessable Entity` with descriptive message
- **Duplicate Errors**: `400 Bad Request` if username or email already exists
- **Response**: `201 Created`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "usr_94e82b71f02a",
    "name": "Jane Doe",
    "username": "janedoe",
    "email": "jane@promptcommit.dev",
    "role": "Prompt Engineer",
    "avatar": "JD",
    "bio": "Private workspace user on PromptCommit.",
    "theme": "light"
  }
}
```

#### `POST /api/auth/login`
- **Description**: Authenticate with email and password, returning a JWT token and user info.
- **Authentication**: Public
- **Request Body**:
```json
{
  "email": "aanshi@promptcommit.dev",
  "password": "password123"
}
```
- **Response**: `200 OK` (Same schema as signup)

#### `GET /api/auth/me`
- **Description**: Retrieve current authenticated user profile.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`
```json
{
  "user": {
    "id": "user1",
    "name": "Aanshi Shah",
    "email": "aanshi@promptcommit.dev",
    "role": "Senior AI Engineer",
    "avatar": "AS",
    "bio": "Specializing in structured LLM workflows...",
    "theme": "light"
  }
}
```

#### `POST /api/auth/logout`
- **Description**: Logout confirmation endpoint.
- **Authentication**: Public / Optional
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 3. User Profile

#### `PUT /api/users/profile`
- **Description**: Update current user's name, email, bio, or workspace theme.
- **Authentication**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "name": "Aanshi S. Shah",
  "bio": "Prompt Architect & Research Evaluator",
  "theme": "dark"
}
```
- **Response**: `200 OK`

---

### 4. Prompts Management (CRUD)

#### `POST /api/prompts`
- **Description**: Create a new prompt in the private vault. Automatically generates baseline version `v1.0` in `prompt_versions`.
- **Authentication**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "title": "SQL Query Generator",
  "description": "Converts natural language questions to SQL.",
  "content": "You are a senior database engineer...",
  "category": "Coding",
  "collection": "Coding",
  "targetModel": "gemini-3.6-flash",
  "tags": ["SQL", "Database", "PostgreSQL"],
  "isPrivate": true
}
```
- **Response**: `201 Created`

#### `GET /api/prompts`
- **Description**: List prompts owned by the authenticated user with optional search, category, and collection filters.
- **Authentication**: Required (`Bearer <token>`)
- **Query Parameters**:
  - `search`: Filter by title, description, or content substring
  - `category`: Filter by category (e.g. `Coding`, `Research`)
  - `collection`: Filter by collection name
- **Response**: `200 OK` (Array of prompt objects with versions and tags)

#### `GET /api/prompts/{id}`
- **Description**: Retrieve detailed prompt information including commit history and shared collaborators.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

#### `PUT /api/prompts/{id}`
- **Description**: Update prompt configuration, tags, and instructions.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

#### `DELETE /api/prompts/{id}`
- **Description**: Delete prompt and associated versions, tags, and favorites from database.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

#### `POST /api/prompts/{id}/rate`
- **Description**: Submit a 1.0 - 5.0 star rating for a prompt.
- **Authentication**: Required (`Bearer <token>`)
- **Query Parameter**: `?rating=5.0`
- **Response**: `200 OK`

#### `POST /api/prompts/{id}/share`
- **Description**: Add or update collaborator permission for a prompt.
- **Authentication**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "email": "colleague@promptcommit.dev",
  "role": "View Only",
  "name": "Colleague"
}
```
- **Response**: `200 OK`

#### `DELETE /api/prompts/{id}/share/{share_id}`
- **Description**: Revoke collaborator access.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

---

### 5. Git-Inspired Prompt Versioning

#### `GET /api/prompts/{prompt_id}/versions`
- **Description**: Retrieve chronological commit history for a prompt.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`
```json
[
  {
    "id": "ver_39b56f8271a0",
    "prompt_id": "p1",
    "version": "v2.0",
    "commitMessage": "Added indexing guidelines and CTE preference",
    "description": "Enhanced prompt constraints for production PostgreSQL.",
    "diffNotes": "+ Added CTE preference\n+ Added indexing strategy check",
    "content": "You are an elite Staff Database Engineer...",
    "author": "Aanshi Shah",
    "isCurrent": true,
    "timestamp": "Sep 22, 2026 08:42 PM"
  }
]
```

#### `POST /api/prompts/{prompt_id}/versions`
- **Description**: Commit a new iteration of a prompt with commit message and diff notes. Updates active prompt version and content.
- **Authentication**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "version_tag": "v2.1",
  "commit_message": "Enforced strict JSON schema output",
  "description": "Added JSON validation schema.",
  "diff_notes": "+ Added JSON format constraint",
  "content": "You are an elite Staff Database Engineer. Output valid JSON only."
}
```
- **Response**: `201 Created`

#### `POST /api/prompts/{prompt_id}/versions/{version_id}/restore`
- **Description**: Roll back prompt content and active version to an earlier commit in history.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

---

### 6. Collections

#### `POST /api/collections`
- **Description**: Create a curated folder collection.
- **Authentication**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "name": "Database Prompts",
  "description": "Queries, migrations, and indexing prompts.",
  "icon": "Code2",
  "color": "blue"
}
```
- **Response**: `201 Created`

#### `GET /api/collections`
- **Description**: List all collections for current user with live prompt counts.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

#### `PUT /api/collections/{id}`
- **Description**: Update collection name, description, icon, or color.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

#### `DELETE /api/collections/{id}`
- **Description**: Delete collection (resets member prompts to 'General').
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

---

### 7. Favorites

#### `GET /api/favorites`
- **Description**: Get all prompts pinned as favorites by current user.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

#### `POST /api/prompts/{id}/favorite`
- **Description**: Toggle favorite status (adds if missing, removes if present).
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`
```json
{
  "success": true,
  "isFavorite": true,
  "message": "Added to favorites."
}
```

#### `DELETE /api/prompts/{id}/favorite`
- **Description**: Explicitly remove a prompt from favorites.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

---

### 8. Prompt Testing / Playground

#### `POST /api/tests`
- **Description**: Execute a prompt against the configured cloud AI provider (Google Gemini, Groq, OpenRouter, Mistral AI). Stores execution result and measured latency in `prompt_tests`.
- **Authentication**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "prompt_id": "p1",
  "input_text": "Find top 5 customers by revenue in 2025",
  "provider": "gemini",
  "model": "gemini-3.6-flash",
  "temperature": 0.7,
  "max_tokens": 1024
}
```
- **Response**: `201 Created`
```json
{
  "id": "tst_51c67d30f14a",
  "promptId": "p1",
  "provider": "gemini",
  "model": "gemini-3.6-flash",
  "inputText": "Find top 5 customers by revenue in 2025",
  "outputText": "SELECT customer_name, SUM(revenue) FROM orders WHERE YEAR(order_date) = 2025 GROUP BY customer_name ORDER BY SUM(revenue) DESC LIMIT 5;",
  "responseTimeMs": 420,
  "status": "success",
  "errorMessage": null,
  "createdAt": "Sep 22, 2026 08:45 PM"
}
```

#### `GET /api/tests`
- **Description**: List recent test executions for the authenticated user.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`

---

### 9. Analytics

#### `GET /api/analytics/overview`
- **Description**: Retrieve real database statistics (counts, model usage, latency, category breakdown). No hardcoded numbers or fake charts.
- **Authentication**: Required (`Bearer <token>`)
- **Response**: `200 OK`
```json
{
  "totalPrompts": 3,
  "totalVersions": 4,
  "totalFavorites": 1,
  "totalTested": 2,
  "totalCollections": 5,
  "avgLatencyMs": 195,
  "avgPromptRating": 5.0,
  "avgVersionsPerPrompt": 1.3,
  "categories": [
    { "name": "Coding", "count": 2, "percentage": 67, "color": "bg-blue-600", "text": "text-blue-600 dark:text-blue-400" },
    { "name": "Research", "count": 1, "percentage": 33, "color": "bg-cyan-500", "text": "text-cyan-600 dark:text-cyan-400" }
  ],
  "modelStats": [
    { "model": "gemini-3.6-flash", "provider": "Google Gemini", "testsCount": 2, "avgLatencyMs": 195 }
  ],
  "recentActivities": [...]
}
```
