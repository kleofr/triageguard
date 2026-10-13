"""Main FastAPI application entrypoint for TriageGuard."""

import asyncio
from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path

# Ensure HF_HOME points to repo models folder on Drive K with plenty of disk space
# and auto-sync the Hugging Face user token if available.
if not os.environ.get("HF_HOME"):
    _repo_hf_cache = Path(__file__).resolve().parents[2] / "models" / "huggingface"
    _repo_hf_cache.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(_repo_hf_cache)

# Sync HF token from user home if not already in HF_HOME
_user_token_file = Path.home() / ".cache" / "huggingface" / "token"
_hf_home_token_file = Path(os.environ["HF_HOME"]) / "token"
if _user_token_file.exists() and not _hf_home_token_file.exists():
    try:
        _hf_home_token_file.write_text(_user_token_file.read_text())
    except Exception:
        pass
if _hf_home_token_file.exists() and not os.environ.get("HF_TOKEN"):
    try:
        os.environ["HF_TOKEN"] = _hf_home_token_file.read_text().strip()
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.v1.router import api_router
from backend.app.core.config import get_settings
from backend.app.db.supabase import check_supabase_health
from backend.app.services.prompt_guard import get_prompt_guard_service
from backend.app.services.router import get_router_service

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI application lifespan context manager.

    Pre-warms ML models (Llama Prompt Guard 2-86M classifier and Laya router) on bootup
    so they are fully downloaded, cached, loaded into memory, and ready before receiving traffic.
    """
    logger.info("Initializing TriageGuard ML pipelines on bootup...")

    # 1. Warm up Prompt Guard classifier (downloads weights/tokenizers if not cached, loads onto device)
    guard = get_prompt_guard_service()
    await asyncio.to_thread(guard.warmup)

    # 2. Warm up Laya router service
    router = get_router_service()
    if hasattr(router, "warmup"):
        await asyncio.to_thread(router.warmup)

    # 3. Check Supabase connection state
    settings = get_settings()
    if settings.is_supabase_configured:
        logger.info(f"Supabase database configured ({settings.supabase_url}).")
    else:
        logger.info("Supabase running in unconfigured/offline mode (set SUPABASE_URL & SUPABASE_KEY in .env).")

    logger.info("TriageGuard ML pipelines and guardrails are primed and ready on bootup.")

    yield

    # Clean up executors on shutdown
    logger.info("Shutting down TriageGuard services...")
    try:
        guard.close()
    except Exception:
        pass
    try:
        router.close()
    except Exception:
        pass


app = FastAPI(
    title="TriageGuard API",
    version="0.1.0",
    description="Deterministic MLSecOps guardrails, sanitization, and triage pipeline gateway.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable CORS for local dev servers (Vite default :5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 API routes
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api")  # Convenience alias
app.include_router(api_router, prefix="/v1")   # OpenAI / standard v1 client alias


@app.get("/v1/models", tags=["OpenAI Compatibility"])
@app.get("/models", tags=["OpenAI Compatibility"])
@app.get("/api/v1/models", tags=["OpenAI Compatibility"])
async def list_models():
    """OpenAI-compatible models discovery endpoint for LLM clients and extensions."""
    settings = get_settings()
    configured_model = settings.openrouter_model or "meta-llama/llama-3.3-70b-instruct:free"
    return {
        "object": "list",
        "data": [
            {
                "id": configured_model,
                "object": "model",
                "created": 1700000000,
                "owned_by": "openrouter",
                "permission": [],
                "root": configured_model,
                "parent": None,
            },
            {
                "id": "meta-llama/prompt-guard-2-86m",
                "object": "model",
                "created": 1700000000,
                "owned_by": "meta",
                "permission": [],
                "root": "meta-llama/prompt-guard-2-86m",
                "parent": None,
            },
            {
                "id": "laya-intent-router",
                "object": "model",
                "created": 1700000000,
                "owned_by": "triageguard",
                "permission": [],
                "root": "laya-intent-router",
                "parent": None,
            },
        ],
    }


@app.get("/v1/models/{model_id:path}", tags=["OpenAI Compatibility"])
@app.get("/api/v1/models/{model_id:path}", tags=["OpenAI Compatibility"])
async def get_model(model_id: str):
    """Retrieve details for a single model."""
    return {
        "id": model_id,
        "object": "model",
        "created": 1700000000,
        "owned_by": "triageguard",
    }



@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
async def health_check():
    """Health check endpoint for container probes and UI connectivity checks."""
    guard = get_prompt_guard_service()
    router = get_router_service()
    pg_ready = guard.is_ready()
    pg_mode = guard.mode
    pg_device = guard.device
    pg_model_id = guard.model_id
    pg_revision = guard.revision
    supabase_status = check_supabase_health()

    return {
        "status": "healthy",
        "service": "TriageGuard",
        "version": "0.1.0",
        "prompt_guard_ready": pg_ready,
        "prompt_guard_mode": pg_mode,
        "device": pg_device,
        "model_id": pg_model_id,
        "revision": pg_revision,
        "supabase": supabase_status,
        "models": {
            "prompt_guard_ready": pg_ready,
            "prompt_guard_mode": pg_mode,
            "prompt_guard_mock": guard.mock_mode,
            "device": pg_device,
            "model_id": pg_model_id,
            "revision": pg_revision,
            "router_ready": router.is_ready(),
            "router_mock": router.mock_mode,
        },
        "endpoints": {
            "sanitize": "/api/v1/sanitize",
            "triage": "/api/v1/triage",
            "tickets": "/api/v1/tickets",
            "db_status": "/api/v1/tickets/status",
            "health": "/health",
            "docs": "/docs",
        },
    }


@app.get("/", tags=["System"])
async def root():
    """Root metadata endpoint."""
    return {
        "message": "Welcome to TriageGuard API Gateway",
        "documentation": "/docs",
        "health": "/health",
        "active_routes": [
            {"name": "Deterministic Sanitizer", "path": "/api/v1/sanitize", "method": "POST"},
            {"name": "Triage Pipeline", "path": "/api/v1/triage", "method": "POST"},
        ],
    }

