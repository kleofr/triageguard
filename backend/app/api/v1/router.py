"""API v1 router definitions for TriageGuard."""

from fastapi import APIRouter
from backend.app.api.v1.endpoints import batch, sanitizer, tickets, triage

api_router = APIRouter()

# Register endpoints
api_router.include_router(sanitizer.router, prefix="/sanitize", tags=["Sanitizer"])
api_router.include_router(triage.router, prefix="/triage", tags=["Triage Pipeline"])
api_router.include_router(batch.router, prefix="/batch", tags=["Batch Evaluation"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["Tickets & Supabase DB"])


