from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.core.migration import migrate_legacy_collections
from app.routes import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize schema tables and run idempotent migrations
    init_db()
    migrate_legacy_collections()
    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for PromptCommit: AI Prompt Testing Platform",
    lifespan=lifespan
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = []
    for err in errors:
        msg = err.get("msg", "")
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        loc = err.get("loc", [])
        field = loc[-1] if loc else ""
        if field and str(field).lower() not in msg.lower() and field != "__root__":
            messages.append(f"{str(field).capitalize()}: {msg}")
        else:
            messages.append(msg)
    clean_message = " ".join(messages) if messages else "Invalid input data."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": clean_message}
    )

# CORS middleware for React Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def root():
    return {
        "message": "Welcome to PromptCommit API",
        "docs": "/docs",
        "health": "/api/health"
    }
