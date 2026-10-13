"""Supabase database client and data access repository for TriageGuard."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from supabase import Client, create_client
except ImportError:
    Client = Any
    create_client = None

from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

# Global singleton Supabase client
_supabase_client: Optional[Client] = None
_client_initialized: bool = False


def get_supabase_client() -> Optional[Client]:
    """Get or initialize the global Supabase client instance.

    Returns:
        Supabase Client if configured and available, or None if unconfigured.
    """
    global _supabase_client, _client_initialized

    if _client_initialized:
        return _supabase_client

    settings = get_settings()

    if not settings.is_supabase_configured:
        logger.debug("Supabase is not configured or disabled; database operations will run in no-op mode.")
        _supabase_client = None
        _client_initialized = True
        return None

    if create_client is None:
        logger.warning("Supabase package is not installed; database operations disabled.")
        _supabase_client = None
        _client_initialized = True
        return None

    try:
        url = settings.supabase_url.strip()
        # Prefer service role key for backend operations if provided; fallback to general key
        key = (settings.supabase_service_role_key or settings.supabase_key).strip()

        _supabase_client = create_client(url, key)
        _client_initialized = True
        logger.info(f"Supabase client initialized successfully for {url}")
        return _supabase_client
    except Exception as exc:
        logger.warning(f"Failed to initialize Supabase client: {exc}")
        _supabase_client = None
        _client_initialized = True
        return None


def reset_supabase_client() -> None:
    """Reset the singleton client (useful for tests or configuration reloads)."""
    global _supabase_client, _client_initialized
    _supabase_client = None
    _client_initialized = False


def is_supabase_configured() -> bool:
    """Check if Supabase credentials are validly configured."""
    return get_settings().is_supabase_configured


def check_supabase_health() -> Dict[str, Any]:
    """Perform a connectivity check against Supabase.

    Returns:
        Dictionary reporting configuration, connection status, and error if any.
    """
    settings = get_settings()
    if not settings.is_supabase_configured:
        return {
            "configured": False,
            "connected": False,
            "message": "Supabase credentials are not configured or using placeholders in .env",
            "url": settings.supabase_url,
        }

    client = get_supabase_client()
    if client is None:
        return {
            "configured": True,
            "connected": False,
            "message": "Failed to instantiate Supabase client",
            "url": settings.supabase_url,
        }

    try:
        # Perform lightweight query to check table connectivity
        tickets_table = settings.supabase_table_tickets
        client.table(tickets_table).select("ticket_id").limit(1).execute()
        return {
            "configured": True,
            "connected": True,
            "message": "Supabase database connection healthy",
            "url": settings.supabase_url,
            "tickets_table": tickets_table,
            "sanitization_logs_table": settings.supabase_table_sanitization_logs,
        }
    except Exception as exc:
        logger.warning(f"Supabase health check ping failed: {exc}")
        return {
            "configured": True,
            "connected": False,
            "message": f"Connection check failed: {str(exc)}",
            "url": settings.supabase_url,
        }


def save_ticket(ticket_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Persist a triaged support ticket into the Supabase tickets table.

    Args:
        ticket_data: Dictionary containing ticket attributes and triage results.

    Returns:
        The saved record data from Supabase, or None if unconfigured / failed.
    """
    client = get_supabase_client()
    if client is None:
        logger.debug("Supabase client not active; skipping ticket persistence.")
        return None

    settings = get_settings()
    table_name = settings.supabase_table_tickets

    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Extract router fields
        router_info = ticket_data.get("router") or {}
        category = router_info.get("category")
        category_conf = router_info.get("category_conf")
        urgency = router_info.get("urgency")
        urgency_conf = router_info.get("urgency_conf")
        team = router_info.get("team")

        record = {
            "ticket_id": ticket_data.get("ticket_id"),
            "channel": ticket_data.get("channel", "web"),
            "subject": ticket_data.get("subject", ""),
            "body": ticket_data.get("body", ""),
            "sanitized_text": ticket_data.get("sanitized_text"),
            "intent": ticket_data.get("intent", "good"),
            "category": category,
            "category_conf": category_conf,
            "urgency": urgency,
            "urgency_conf": urgency_conf,
            "team": team,
            "route": ticket_data.get("route"),
            "route_reason": ticket_data.get("route_reason"),
            "draft": ticket_data.get("draft"),
            "guard_result": ticket_data.get("guard_result"),
            "trace": ticket_data.get("trace"),
            "risk_flags": ticket_data.get("risk_flags") or [],
            "customer_ref": ticket_data.get("customer_ref"),
            "status": ticket_data.get("status", "triaged"),
            "updated_at": now_iso,
        }

        # Filter out None values that might violate schema if unneeded
        cleaned_record = {k: v for k, v in record.items() if v is not None}

        # Upsert by ticket_id
        res = client.table(table_name).upsert(cleaned_record, on_conflict="ticket_id").execute()
        if res.data and len(res.data) > 0:
            logger.info(f"Persisted ticket {record.get('ticket_id')} to Supabase table '{table_name}'.")
            return res.data[0]
        return None
    except Exception as exc:
        logger.warning(f"Failed to persist ticket to Supabase: {exc}")
        return None


def get_ticket(ticket_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a single ticket by its ticket_id from Supabase."""
    client = get_supabase_client()
    if client is None:
        return None

    settings = get_settings()
    table_name = settings.supabase_table_tickets

    try:
        res = client.table(table_name).select("*").eq("ticket_id", ticket_id).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as exc:
        logger.warning(f"Failed to fetch ticket {ticket_id} from Supabase: {exc}")
        return None


def list_tickets(
    limit: int = 50,
    offset: int = 0,
    route: Optional[str] = None,
    customer_ref: Optional[str] = None,
    intent: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieve a paginated list of tickets from Supabase."""
    client = get_supabase_client()
    if client is None:
        return []

    settings = get_settings()
    table_name = settings.supabase_table_tickets

    try:
        query = client.table(table_name).select("*")
        if route:
            query = query.eq("route", route)
        if customer_ref:
            query = query.eq("customer_ref", customer_ref)
        if intent:
            query = query.eq("intent", intent)

        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return res.data or []
    except Exception as exc:
        logger.warning(f"Failed to query tickets from Supabase: {exc}")
        return []


def save_sanitization_log(log_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Persist a sanitization audit log into Supabase sanitization_logs table."""
    client = get_supabase_client()
    if client is None:
        return None

    settings = get_settings()
    table_name = settings.supabase_table_sanitization_logs

    try:
        record = {
            "customer_id": log_data.get("customer_id"),
            "raw_preview": log_data.get("raw_preview"),
            "sanitized_text": log_data.get("sanitized_text"),
            "pii_detected": log_data.get("pii_detected"),
            "urls_defanged": log_data.get("urls_defanged") or [],
            "injections_detected": log_data.get("injections_detected") or [],
            "processing_time_ms": log_data.get("processing_time_ms", 0.0),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = client.table(table_name).insert(record).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as exc:
        logger.warning(f"Failed to log sanitization event to Supabase: {exc}")
        return None


def list_sanitization_logs(limit: int = 50, customer_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve recent sanitization logs from Supabase."""
    client = get_supabase_client()
    if client is None:
        return []

    settings = get_settings()
    table_name = settings.supabase_table_sanitization_logs

    try:
        query = client.table(table_name).select("*")
        if customer_id:
            query = query.eq("customer_id", customer_id)
        res = query.order("created_at", desc=True).limit(limit).execute()
        return res.data or []
    except Exception as exc:
        logger.warning(f"Failed to query sanitization logs from Supabase: {exc}")
        return []
