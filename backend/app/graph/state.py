# TriageState and friends

from typing import TypedDict, Literal, Optional

Route = Literal["AUTO_DRAFT", "HUMAN_QUEUE", "SECURITY_REVIEW"]
IntentType = Literal["good", "bad"]

class Ticket(TypedDict):
    ticket_id: str
    channel: str                 # email | chat | api
    received_at: str             # ISO 8601
    raw_text_ref: str            # pointer into restricted store, never the text itself
    attachments_meta: list[dict]

class RouterOutput(TypedDict):
    category: str
    category_conf: float
    urgency: str
    urgency_conf: float
    team: str                    # derived from category via lookup

class TraceRecord(TypedDict):
    node: str
    started_at: str
    duration_ms: float
    summary: dict                # redacted, no raw text or PII
    error: Optional[str]

class TriageState(TypedDict):
    ticket: Ticket
    sanitized_text: Optional[str]
    intent: Optional[IntentType]
    router: Optional[RouterOutput]
    route: Optional[Route]
    route_reason: Optional[str]  # which policy row matched
    draft: Optional[str]
    citations: list[str]
    guard_result: Optional[dict] # {passed: bool, violations: list[str]}
    trace: list[TraceRecord]