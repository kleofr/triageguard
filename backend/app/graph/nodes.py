"""LangGraph nodes for TriageGuard workflow."""

import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    from backend.app.graph.state import IntentType, RouterOutput, TraceRecord, TriageState
    from backend.app.policy.taxonomy import evaluate_routing_policy
    from backend.app.services.drafting import DraftingService, get_drafting_service
    from backend.app.services.prompt_guard import (
        PromptGuardResult,
        PromptGuardService,
        get_prompt_guard_service,
    )
    from backend.app.services.router import LayaRouterService, get_router_service
    from backend.app.services.sanitizer import (
        DeterministicSanitizer,
        RiskSeverity,
        SanitizerConfig,
    )
except ImportError:
    from app.graph.state import IntentType, RouterOutput, TraceRecord, TriageState
    from app.policy.taxonomy import evaluate_routing_policy
    from app.services.drafting import DraftingService, get_drafting_service
    from app.services.prompt_guard import (
        PromptGuardResult,
        PromptGuardService,
        get_prompt_guard_service,
    )
    from app.services.router import LayaRouterService, get_router_service
    from app.services.sanitizer import (
        DeterministicSanitizer,
        RiskSeverity,
        SanitizerConfig,
    )


# In-memory restricted raw ticket store (decouples raw untrusted text from state)
_RAW_TICKET_STORE: Dict[str, str] = {}


def store_raw_ticket_text(ref_id: str, raw_text: str) -> None:
    """Store raw ticket text in the restricted store."""
    _RAW_TICKET_STORE[ref_id] = raw_text


def get_raw_ticket_text(ref_id: str) -> Optional[str]:
    """Retrieve raw ticket text from the restricted store."""
    return _RAW_TICKET_STORE.get(ref_id)


def sanitize_and_guard_node(
    state: TriageState,
    sanitizer_config: Optional[SanitizerConfig] = None,
    guard_service: Optional[PromptGuardService] = None,
) -> Dict[str, Any]:
    """Unified LangGraph intake & security node running for EVERY ticket.

    1. Resolves raw text from the restricted ticket store.
    2. Runs DeterministicSanitizer (PII masking, defanging, regex injection scanning).
    3. Runs Llama Prompt Guard 2-86M classification on the sanitized text.
    4. Enforces one-way monotonic risk flags (flags are never erased or downgraded).
    5. Applies the 3-tier routing rule:
       - Tier 1: Regex HIGH/CRITICAL or Prompt Guard score >= threshold_high
                 -> route = 'SECURITY_REVIEW' (quarantine queue)
       - Tier 2: threshold_mid <= Prompt Guard score < threshold_high
                 -> route = 'HUMAN_QUEUE' (ambiguous review)
       - Tier 3: Clean ticket (score < threshold_mid and no regex HIGH)
                 -> route = None (proceeds to Laya router)
    6. Appends a structured, redacted TraceRecord.
    7. Fails closed upon any unexpected error or timeout.
    """
    started_at = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()

    ticket = state.get("ticket", {})
    raw_text_ref = ticket.get("raw_text_ref", "") if isinstance(ticket, dict) else ""

    raw_text = get_raw_ticket_text(raw_text_ref)
    if raw_text is None:
        raw_text = raw_text_ref

    existing_trace = list(state.get("trace") or [])
    service = guard_service or get_prompt_guard_service()

    # Step 0: Ensure detector is available (fail closed to HUMAN_QUEUE if not ready)
    if not service.is_ready():
        duration_ms = round((time.perf_counter() - start_perf) * 1000, 3)
        detector_version = getattr(service, "version", "unknown")
        fail_guard: PromptGuardResult = {
            "passed": False,
            "malicious_score": 1.0,
            "benign_score": 0.0,
            "threshold_high": service.config.threshold_high,
            "threshold_mid": service.config.threshold_mid,
            "threshold": service.config.threshold_high,
            "classification": "MALICIOUS",
            "tier": "HUMAN_QUEUE",
            "violations": ["DETECTOR_UNAVAILABLE"],
            "latency_ms": duration_ms,
            "error": "DETECTOR_UNAVAILABLE",
            "detector_mode": "unavailable",
            "detector_version": detector_version,
            "chunk_count": 0,
            "max_chunk_index": 0,
        }
        trace_entry: TraceRecord = {
            "node": "sanitize_and_guard",
            "started_at": started_at,
            "duration_ms": duration_ms,
            "summary": {
                "pii_masked": 0,
                "urls_defanged": 0,
                "intent": "bad",
                "has_regex_high": False,
                "guard_score": 1.0,
                "guard_tier": "HUMAN_QUEUE",
                "detector_mode": "unavailable",
                "detector_version": detector_version,
                "chunk_count": 0,
                "max_chunk_index": 0,
                "route_decision": "HUMAN_QUEUE",
            },
            "error": "DETECTOR_UNAVAILABLE",
        }
        return {
            "sanitized_text": None,
            "intent": "bad",
            "route": "HUMAN_QUEUE",
            "route_reason": "DETECTOR_UNAVAILABLE",
            "guard_result": fail_guard,
            "trace": existing_trace + [trace_entry],
        }

    try:
        # Step 1: Deterministic Sanitization
        sanitizer = DeterministicSanitizer(config=sanitizer_config)
        san_result = sanitizer.sanitize(raw_text)

        has_regex_high = san_result.is_hard_stop or any(
            finding.severity in (RiskSeverity.HIGH, RiskSeverity.CRITICAL)
            for finding in san_result.injection_findings
        )

        # Step 2: Llama Prompt Guard 2-86M Evaluation (executed for every ticket)
        guard_result: PromptGuardResult = service.classify(san_result.clean_text)
        score = guard_result["malicious_score"]
        threshold_high = guard_result.get("threshold_high", 0.80)
        threshold_mid = guard_result.get("threshold_mid", 0.40)

        is_over_cap = any("LONG_INPUT_PARTIAL_SCAN" in v for v in guard_result.get("violations", []))

        # Binary Intent Classification: good (clean) vs bad (infected)
        is_infected = (
            has_regex_high
            or len(san_result.injection_findings) > 0
            or score >= threshold_mid
            or is_over_cap
            or not guard_result.get("passed", True)
        )
        intent: IntentType = "bad" if is_infected else "good"

        route: Optional[str] = None
        route_reason: Optional[str] = None

        # Step 3: Three-Tier Decision Routing
        if has_regex_high or score >= threshold_high:
            # Tier 1: Confirmed / Severe Threat -> Quarantine
            route = "SECURITY_REVIEW"
            if score >= threshold_high:
                route_reason = (
                    f"Quarantined for security review: classifier score {score:.4f} >= "
                    f"high threshold {threshold_high:.4f}"
                )
            else:
                route_reason = "Quarantined for security review: regex HIGH/CRITICAL injection detected"

        elif is_over_cap:
            # Over-cap input gets routed to HUMAN_QUEUE
            route = "HUMAN_QUEUE"
            route_reason = (
                f"Routed to human queue: input exceeded scan cap (LONG_INPUT_PARTIAL_SCAN: {guard_result.get('chunk_count', 0)} chunks > {getattr(service.config, 'max_windows', 32)})"
            )

        elif score >= threshold_mid:
            # Tier 2: Ambiguous Threat -> Human Queue
            route = "HUMAN_QUEUE"
            route_reason = (
                f"Routed to human queue: classifier score {score:.4f} in ambiguous "
                f"middle zone [{threshold_mid:.4f}, {threshold_high:.4f})"
            )

        else:
            # Tier 3: Clean / Benign -> route remains None so pipeline proceeds to Laya
            route = None
            route_reason = None

        duration_ms = round((time.perf_counter() - start_perf) * 1000, 3)

        trace_entry: TraceRecord = {
            "node": "sanitize_and_guard",
            "started_at": started_at,
            "duration_ms": duration_ms,
            "summary": {
                "pii_masked": san_result.redacted_pii_count,
                "urls_defanged": san_result.defanged_urls_count,
                "intent": intent,
                "has_regex_high": has_regex_high,
                "guard_score": score,
                "guard_tier": guard_result.get("tier", "CLEAN"),
                "detector_mode": guard_result.get("detector_mode", service.mode),
                "detector_version": guard_result.get("detector_version", service.version),
                "chunk_count": guard_result.get("chunk_count", 1),
                "max_chunk_index": guard_result.get("max_chunk_index", 0),
                "route_decision": route or "PROCEED_TO_LAYA",
            },
            "error": guard_result.get("error"),
        }

        return {
            "sanitized_text": san_result.clean_text,
            "intent": intent,
            "route": route,
            "route_reason": route_reason,
            "guard_result": guard_result,
            "trace": existing_trace + [trace_entry],
        }

    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_perf) * 1000, 3)

        fail_guard: PromptGuardResult = {
            "passed": False,
            "malicious_score": 1.0,
            "benign_score": 0.0,
            "threshold_high": getattr(service.config, "threshold_high", 0.80),
            "threshold_mid": getattr(service.config, "threshold_mid", 0.40),
            "threshold": getattr(service.config, "threshold_high", 0.80),
            "classification": "MALICIOUS",
            "tier": "SECURITY_REVIEW",
            "violations": [f"PROMPT_GUARD_FAIL_CLOSED: {str(exc)}"],
            "latency_ms": duration_ms,
            "error": str(exc),
            "detector_mode": getattr(service, "mode", "unavailable"),
            "detector_version": getattr(service, "version", "unknown"),
            "chunk_count": 0,
            "max_chunk_index": 0,
        }

        trace_entry: TraceRecord = {
            "node": "sanitize_and_guard",
            "started_at": started_at,
            "duration_ms": duration_ms,
            "summary": {
                "pii_masked": 0,
                "urls_defanged": 0,
                "intent": "bad",
                "has_regex_high": True,
                "guard_score": 1.0,
                "guard_tier": "SECURITY_REVIEW",
                "detector_mode": getattr(service, "mode", "unavailable"),
                "detector_version": getattr(service, "version", "unknown"),
                "chunk_count": 0,
                "max_chunk_index": 0,
                "route_decision": "SECURITY_REVIEW",
            },
            "error": str(exc),
        }

        return {
            "sanitized_text": "",
            "intent": "bad",
            "route": "SECURITY_REVIEW",
            "route_reason": f"Fail-closed on intake guard error: {str(exc)}",
            "guard_result": fail_guard,
            "trace": existing_trace + [trace_entry],
        }


def route_with_laya_node(
    state: TriageState,
    router_service: Optional[LayaRouterService] = None,
) -> Dict[str, Any]:
    """LangGraph node that classifies sanitized ticket text using the Laya Router.

    1. Reads sanitized_text from state (never raw text).
    2. Calls LayaRouterService to determine category, urgency, owning team, and confidence.
    3. Appends a structured, redacted TraceRecord with latency metrics.
    4. Fails closed (category='other', urgency='critical', conf=0.0) upon error or timeout.
    """
    started_at = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()

    sanitized_text = state.get("sanitized_text") or ""
    existing_trace = list(state.get("trace") or [])
    service = router_service or get_router_service()

    try:
        if not sanitized_text.strip():
            raise ValueError("No sanitized text available for routing.")

        router_output: RouterOutput = service.classify(sanitized_text)
        duration_ms = round((time.perf_counter() - start_perf) * 1000, 3)

        current_route = state.get("route")
        current_reason = state.get("route_reason")
        if not current_route:
            current_route, current_reason = evaluate_routing_policy(
                category=router_output.get("category", "other"),
                category_conf=router_output.get("category_conf", 0.0),
                urgency=router_output.get("urgency", "normal"),
                urgency_conf=router_output.get("urgency_conf", 0.0),
            )

        trace_entry: TraceRecord = {
            "node": "route_with_laya",
            "started_at": started_at,
            "duration_ms": duration_ms,
            "summary": {
                "category": router_output.get("category"),
                "category_conf": router_output.get("category_conf"),
                "urgency": router_output.get("urgency"),
                "urgency_conf": router_output.get("urgency_conf"),
                "team": router_output.get("team"),
                "route_decision": current_route,
            },
            "error": None,
        }

        return {
            "router": router_output,
            "route": current_route,
            "route_reason": current_reason,
            "trace": existing_trace + [trace_entry],
        }

    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_perf) * 1000, 3)
        fail_output: RouterOutput = {
            "category": "other",
            "category_conf": 0.0,
            "urgency": "critical",
            "urgency_conf": 0.0,
            "team": "general support",
        }

        trace_entry: TraceRecord = {
            "node": "route_with_laya",
            "started_at": started_at,
            "duration_ms": duration_ms,
            "summary": {
                "category": fail_output["category"],
                "category_conf": fail_output["category_conf"],
                "urgency": fail_output["urgency"],
                "urgency_conf": fail_output["urgency_conf"],
                "team": fail_output["team"],
                "route_decision": "HUMAN_QUEUE",
            },
            "error": str(exc),
        }

        return {
            "router": fail_output,
            "route": "HUMAN_QUEUE",
            "route_reason": f"Fail-closed on router error: {str(exc)}",
            "trace": existing_trace + [trace_entry],
        }


def auto_draft_node(
    state: TriageState,
    drafting_service: Optional[DraftingService] = None,
) -> Dict[str, Any]:
    """LangGraph node that generates a draft reply for tickets flagged as AUTO_DRAFT.

    1. Reads sanitized_text and router classification metadata from state.
    2. Generates draft reply and citations using DraftingService (template now, LLM/API in future).
    3. Appends structured TraceRecord.
    4. Mutates state with draft, citations, and trace.
    """
    started_at = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()

    sanitized_text = state.get("sanitized_text") or ""
    router_output = state.get("router") or {}
    ticket = state.get("ticket") or {}
    ticket_id = ticket.get("ticket_id", "unknown_ticket")
    existing_trace = list(state.get("trace") or [])

    category = router_output.get("category", "general inquiry")
    team = router_output.get("team", "support team")

    service = drafting_service or get_drafting_service()

    try:
        draft, citations = service.generate_draft(
            sanitized_text=sanitized_text,
            category=category,
            team=team,
            ticket_id=ticket_id,
        )
        duration_ms = round((time.perf_counter() - start_perf) * 1000, 3)

        mode_str = "openrouter" if any("openrouter" in str(c) for c in citations) else "template_completion"
        trace_entry: TraceRecord = {
            "node": "auto_draft",
            "started_at": started_at,
            "duration_ms": duration_ms,
            "summary": {
                "status": "draft_created",
                "draft_len": len(draft) if draft else 0,
                "citations_count": len(citations),
                "mode": mode_str,
                "category": category,
            },
            "error": None,
        }


        return {
            "draft": draft,
            "citations": citations,
            "trace": existing_trace + [trace_entry],
        }

    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_perf) * 1000, 3)
        trace_entry: TraceRecord = {
            "node": "auto_draft",
            "started_at": started_at,
            "duration_ms": duration_ms,
            "summary": {
                "status": "failed",
                "error": str(exc),
            },
            "error": str(exc),
        }

        return {
            "draft": None,
            "citations": [],
            "trace": existing_trace + [trace_entry],
        }



# Backwards compatibility wrappers
def sanitize_node(
    state: TriageState,
    config: Optional[SanitizerConfig] = None,
) -> Dict[str, Any]:
    """Legacy standalone sanitizer node (retained for backward compatibility)."""
    return sanitize_and_guard_node(state, sanitizer_config=config)


def security_classifier_node(
    state: TriageState,
    guard_service: Optional[PromptGuardService] = None,
) -> Dict[str, Any]:
    """Legacy standalone classifier node (retained for backward compatibility)."""
    return sanitize_and_guard_node(state, guard_service=guard_service)
