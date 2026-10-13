"""FastAPI endpoints for querying and managing triaged tickets in Supabase."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.app.db.supabase import (
    check_supabase_health,
    get_ticket,
    is_supabase_configured,
    list_tickets,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class DatabaseStatusResponse(BaseModel):
    configured: bool
    connected: bool
    message: str
    url: Optional[str] = None
    tickets_table: Optional[str] = None
    sanitization_logs_table: Optional[str] = None


class TicketListItem(BaseModel):
    ticket_id: str
    channel: Optional[str] = "web"
    subject: Optional[str] = ""
    intent: Optional[str] = "good"
    category: Optional[str] = None
    category_conf: Optional[float] = None
    urgency: Optional[str] = None
    urgency_conf: Optional[float] = None
    team: Optional[str] = None
    route: Optional[str] = None
    route_reason: Optional[str] = None
    customer_ref: Optional[str] = None
    status: Optional[str] = "triaged"
    created_at: Optional[str] = None


class TicketDetailResponse(TicketListItem):
    body: Optional[str] = ""
    sanitized_text: Optional[str] = None
    draft: Optional[str] = None
    guard_result: Optional[Dict[str, Any]] = None
    trace: Optional[List[Dict[str, Any]]] = None
    risk_flags: Optional[List[str]] = Field(default_factory=list)
    updated_at: Optional[str] = None


class TicketListResponse(BaseModel):
    total: int
    offset: int
    limit: int
    supabase_configured: bool
    tickets: List[Dict[str, Any]]


@router.get(
    "/status",
    response_model=DatabaseStatusResponse,
    summary="Check Supabase database connectivity and configuration status",
)
async def get_database_status():
    """Returns whether Supabase is configured in .env and can reach the database."""
    health = check_supabase_health()
    return DatabaseStatusResponse(
        configured=health.get("configured", False),
        connected=health.get("connected", False),
        message=health.get("message", "Unknown status"),
        url=health.get("url"),
        tickets_table=health.get("tickets_table"),
        sanitization_logs_table=health.get("sanitization_logs_table"),
    )


@router.get(
    "",
    response_model=TicketListResponse,
    summary="List triaged tickets stored in Supabase",
)
async def get_triaged_tickets(
    limit: int = Query(default=20, ge=1, le=100, description="Max tickets to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    route: Optional[str] = Query(default=None, description="Filter by route: AUTO_REPLY, HUMAN_QUEUE, SECURITY_REVIEW"),
    customer_ref: Optional[str] = Query(default=None, description="Filter by customer/tenant ID"),
    intent: Optional[str] = Query(default=None, description="Filter by intent: good, bad"),
):
    """Retrieve historical triaged tickets from the Supabase database."""
    if not is_supabase_configured():
        return TicketListResponse(
            total=0,
            offset=offset,
            limit=limit,
            supabase_configured=False,
            tickets=[],
        )

    items = list_tickets(limit=limit, offset=offset, route=route, customer_ref=customer_ref, intent=intent)
    return TicketListResponse(
        total=len(items),
        offset=offset,
        limit=limit,
        supabase_configured=True,
        tickets=items,
    )


@router.get(
    "/{ticket_id}",
    summary="Get single triaged ticket by ticket_id from Supabase",
)
async def get_ticket_by_id(ticket_id: str):
    """Retrieve full details of a triaged ticket from Supabase."""
    if not is_supabase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.",
        )

    record = get_ticket(ticket_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket '{ticket_id}' was not found in database.",
        )
    return record
