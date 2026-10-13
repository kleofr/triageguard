"""LangGraph workflow assembly and execution entrypoints for TriageGuard."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

try:
    from backend.app.graph.nodes import (
        auto_draft_node,
        route_with_laya_node,
        sanitize_and_guard_node,
        store_raw_ticket_text,
    )
    from backend.app.graph.state import TriageState
    from backend.app.services.drafting import DraftingService
    from backend.app.services.prompt_guard import PromptGuardService
    from backend.app.services.router import LayaRouterService
except ImportError:
    from app.graph.nodes import (
        auto_draft_node,
        route_with_laya_node,
        sanitize_and_guard_node,
        store_raw_ticket_text,
    )
    from app.graph.state import TriageState
    from app.services.drafting import DraftingService
    from app.services.prompt_guard import PromptGuardService
    from app.services.router import LayaRouterService

logger = logging.getLogger(__name__)


def build_triage_graph(
    router_service: Optional[LayaRouterService] = None,
    guard_service: Optional[PromptGuardService] = None,
    drafting_service: Optional[DraftingService] = None,
    checkpointer: Any = None,
) -> CompiledStateGraph:
    """Build and compile the unified LangGraph triage workflow:

    START -> sanitize_and_guard -> (if Tier 1: SECURITY_REVIEW) -> END (Quarantined)
                                -> (if Tier 2: HUMAN_QUEUE)     -> END (Human Review)
                                -> (if Tier 3: Clean)           -> route_with_laya
                                    -> (if AUTO_DRAFT)          -> auto_draft -> END
                                    -> (if HUMAN_QUEUE / other) -> END

    Every ticket executes sanitization followed by Llama Prompt Guard 2-86M in a
    single node with one-way monotonic risk flags.

    Args:
        router_service: Optional custom or mocked LayaRouterService.
        guard_service: Optional custom or mocked PromptGuardService.
        drafting_service: Optional custom or mocked DraftingService.
        checkpointer: Optional LangGraph checkpointer for state persistence.

    Returns:
        CompiledStateGraph instance ready for invocation.
    """
    builder = StateGraph(TriageState)

    # Node wrappers
    def _sanitize_and_guard_step(state: TriageState) -> Dict[str, Any]:
        return sanitize_and_guard_node(state, guard_service=guard_service)

    def _route_step(state: TriageState) -> Dict[str, Any]:
        return route_with_laya_node(state, router_service=router_service)

    def _auto_draft_step(state: TriageState) -> Dict[str, Any]:
        return auto_draft_node(state, drafting_service=drafting_service)

    def _should_route_after_guard(state: TriageState) -> str:
        """Route to END if ticket is quarantined or escalated to human queue, else to Laya."""
        if state.get("intent") == "bad":
            return END

        # Tier 1 (SECURITY_REVIEW) or Tier 2 (HUMAN_QUEUE) halt before Laya
        route = state.get("route")
        if route in ("SECURITY_REVIEW", "HUMAN_QUEUE"):
            return END

        guard_result = state.get("guard_result") or {}
        if guard_result.get("passed") is False:
            return END

        # Tier 3 (Clean) proceeds to Laya intent classification
        return "route_with_laya"

    def _should_route_after_laya(state: TriageState) -> str:
        """Route to auto_draft if route is AUTO_DRAFT, else to END."""
        route = state.get("route")
        if route and route.upper() == "AUTO_DRAFT":
            return "auto_draft"
        return END

    # Register nodes
    builder.add_node("sanitize_and_guard", _sanitize_and_guard_step)
    builder.add_node("route_with_laya", _route_step)
    builder.add_node("auto_draft", _auto_draft_step)

    # Define graph edges
    builder.add_edge(START, "sanitize_and_guard")
    builder.add_conditional_edges(
        "sanitize_and_guard",
        _should_route_after_guard,
        {
            "route_with_laya": "route_with_laya",
            END: END,
        },
    )
    builder.add_conditional_edges(
        "route_with_laya",
        _should_route_after_laya,
        {
            "auto_draft": "auto_draft",
            END: END,
        },
    )
    builder.add_edge("auto_draft", END)

    return builder.compile(checkpointer=checkpointer)


# Global cached graph instance
_default_compiled_graph: Optional[CompiledStateGraph] = None


def get_triage_graph(
    router_service: Optional[LayaRouterService] = None,
    guard_service: Optional[PromptGuardService] = None,
    drafting_service: Optional[DraftingService] = None,
) -> CompiledStateGraph:
    """Get or build the compiled LangGraph workflow instance."""
    global _default_compiled_graph
    if (
        _default_compiled_graph is None
        or router_service is not None
        or guard_service is not None
        or drafting_service is not None
    ):
        compiled = build_triage_graph(
            router_service=router_service,
            guard_service=guard_service,
            drafting_service=drafting_service,
        )
        if router_service is None and guard_service is None and drafting_service is None:
            _default_compiled_graph = compiled
        return compiled
    return _default_compiled_graph


def run_triage(
    raw_text: str,
    ticket_id: Optional[str] = None,
    channel: str = "web",
    attachments_meta: Optional[list] = None,
    router_service: Optional[LayaRouterService] = None,
    guard_service: Optional[PromptGuardService] = None,
    drafting_service: Optional[DraftingService] = None,
) -> TriageState:
    """Convenience helper to run the LangGraph triage pipeline end-to-end for incoming text.

    Args:
        raw_text: Raw incoming untrusted ticket text.
        ticket_id: Optional unique identifier for the ticket.
        channel: Ingestion channel (email, chat, api, web).
        attachments_meta: Optional list of attachment metadata.
        router_service: Optional custom or mocked router service.
        guard_service: Optional custom or mocked prompt guard service.
        drafting_service: Optional custom or mocked drafting service.

    Returns:
        Final TriageState containing sanitized text, intent, router output, guard_result, and trace.
    """
    assigned_ticket_id = ticket_id or f"t_{uuid.uuid4().hex[:10]}"
    ref_id = f"raw_ref_{uuid.uuid4().hex[:12]}"

    # Isolate raw text in restricted store (security invariant: keep raw text out of state)
    store_raw_ticket_text(ref_id, raw_text)

    initial_state: TriageState = {
        "ticket": {
            "ticket_id": assigned_ticket_id,
            "channel": channel,
            "received_at": datetime.now(timezone.utc).isoformat(),
            "raw_text_ref": ref_id,
            "attachments_meta": attachments_meta or [],
        },
        "sanitized_text": None,
        "intent": None,
        "router": None,
        "route": None,
        "route_reason": None,
        "draft": None,
        "citations": [],
        "guard_result": None,
        "trace": [],
    }

    graph = get_triage_graph(
        router_service=router_service,
        guard_service=guard_service,
        drafting_service=drafting_service,
    )
    result = graph.invoke(initial_state)
    return result