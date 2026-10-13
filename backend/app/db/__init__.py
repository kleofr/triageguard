"""Database persistence and Supabase client package for TriageGuard."""

from backend.app.db.supabase import (
    get_supabase_client,
    is_supabase_configured,
    check_supabase_health,
    save_ticket,
    get_ticket,
    list_tickets,
    save_sanitization_log,
    list_sanitization_logs,
)

__all__ = [
    "get_supabase_client",
    "is_supabase_configured",
    "check_supabase_health",
    "save_ticket",
    "get_ticket",
    "list_tickets",
    "save_sanitization_log",
    "list_sanitization_logs",
]
