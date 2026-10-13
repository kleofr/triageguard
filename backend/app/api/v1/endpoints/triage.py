"""FastAPI endpoint for TriageGuard LangGraph pipeline execution."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, Field

try:
    from backend.app.db.supabase import save_ticket
    from backend.app.graph.build import run_triage
    from backend.app.services import prompt_guard
except ImportError:
    from app.db.supabase import save_ticket
    from app.graph.build import run_triage
    from app.services import prompt_guard

logger = logging.getLogger(__name__)

router = APIRouter()


class TriageRequest(BaseModel):
    channel: str = Field(default="web", description="Ingestion channel: email | chat | api | web")
    subject: Optional[str] = Field(default="", description="Optional ticket subject line")
    body: str = Field(..., min_length=1, max_length=20000, description="Inbound ticket message body")
    customer_ref: Optional[str] = Field(default=None, description="Optional customer or tenant ID")


class RouterResponseSchema(BaseModel):
    category: str
    category_conf: float
    urgency: str
    urgency_conf: float
    team: str


class TraceItemSchema(BaseModel):
    node: str
    started_at: str
    duration_ms: float
    summary: Dict[str, Any]
    error: Optional[str] = None


class TriageResponse(BaseModel):
    ticket_id: str
    sanitized_text: Optional[str]
    intent: Literal["good", "bad"]
    router: Optional[RouterResponseSchema]
    route: Optional[str] = None
    route_reason: Optional[str] = None
    draft: Optional[str] = None
    citations: List[str] = Field(default_factory=list)
    guard_result: Optional[Dict[str, Any]] = None
    trace: List[TraceItemSchema]
    risk_flags: Optional[List[str]] = Field(default_factory=list)



@router.post(
    "",
    response_model=TriageResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit support ticket and execute LangGraph triage pipeline",
)
async def triage_ticket(request: TriageRequest, background_tasks: BackgroundTasks):
    """Run the TriageGuard LangGraph pipeline (Sanitize & Guard -> Route with Laya) on incoming ticket text."""
    try:
        # Combine subject and body if subject is present
        full_text = f"{request.subject}\n\n{request.body}".strip() if request.subject else request.body.strip()
        
        if not full_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Ticket content cannot be blank.",
            )

        # Invariant: when the detector is unavailable, /api/v1/triage must not process the ticket.
        guard = prompt_guard.get_prompt_guard_service()
        if not guard.is_ready():
            logger.warning(
                "Prompt Guard detector is unavailable; halting triage and routing to HUMAN_QUEUE."
            )
            ticket_id = f"t_{uuid.uuid4().hex[:10]}"
            now_iso = datetime.now(timezone.utc).isoformat()
            detector_version = getattr(guard, "version", "unknown")
            return TriageResponse(
                ticket_id=ticket_id,
                sanitized_text=None,
                intent="bad",
                risk_flags=[],
                router=None,
                route="HUMAN_QUEUE",
                route_reason="DETECTOR_UNAVAILABLE",
                draft=None,
                guard_result={
                    "passed": False,
                    "malicious_score": 1.0,
                    "benign_score": 0.0,
                    "threshold_high": guard.config.threshold_high,
                    "threshold_mid": guard.config.threshold_mid,
                    "threshold": guard.config.threshold_high,
                    "classification": "MALICIOUS",
                    "tier": "HUMAN_QUEUE",
                    "violations": ["DETECTOR_UNAVAILABLE"],
                    "latency_ms": 0.0,
                    "error": "DETECTOR_UNAVAILABLE",
                    "detector_mode": "unavailable",
                    "detector_version": detector_version,
                },
                trace=[
                    TraceItemSchema(
                        node="sanitize_and_guard",
                        started_at=now_iso,
                        duration_ms=0.0,
                        summary={
                            "intent": "bad",
                            "route_decision": "HUMAN_QUEUE",
                            "route_reason": "DETECTOR_UNAVAILABLE",
                            "detector_mode": "unavailable",
                            "detector_version": detector_version,
                            "error": "DETECTOR_UNAVAILABLE",
                        },
                        error="DETECTOR_UNAVAILABLE",
                    )
                ],
            )

        final_state = run_triage(
            raw_text=full_text,
            channel=request.channel,
        )

        ticket_data = final_state.get("ticket", {})
        ticket_id = ticket_data.get("ticket_id", "unknown_ticket")
        state_intent = final_state.get("intent")
        if not state_intent:
            state_intent = "bad" if final_state.get("route") in ("SECURITY_REVIEW", "HUMAN_QUEUE") else "good"

        # Asynchronously persist ticket into Supabase DB if enabled
        ticket_record = {
            "ticket_id": ticket_id,
            "channel": request.channel,
            "subject": request.subject or "",
            "body": request.body,
            "sanitized_text": final_state.get("sanitized_text"),
            "intent": state_intent,
            "router": final_state.get("router"),
            "route": final_state.get("route"),
            "route_reason": final_state.get("route_reason"),
            "draft": final_state.get("draft"),
            "guard_result": final_state.get("guard_result"),
            "trace": final_state.get("trace") or [],
            "risk_flags": [],
            "customer_ref": request.customer_ref,
            "status": "triaged",
        }
        background_tasks.add_task(save_ticket, ticket_record)

        return TriageResponse(
            ticket_id=ticket_id,
            sanitized_text=final_state.get("sanitized_text"),
            intent=state_intent,
            risk_flags=[],
            router=final_state.get("router"),
            route=final_state.get("route"),
            route_reason=final_state.get("route_reason"),
            draft=final_state.get("draft"),
            citations=final_state.get("citations") or [],
            guard_result=final_state.get("guard_result"),
            trace=final_state.get("trace") or [],
        )


    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error executing triage pipeline: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while executing the triage pipeline.",
        )
