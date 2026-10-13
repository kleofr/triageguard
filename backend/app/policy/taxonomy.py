"""Taxonomy definitions, criteria, and mapping policies for TriageGuard."""

from typing import Dict, Final, Literal, Set

# Classification types
CategoryType = Literal[
    "technical_issue",
    "billing",
    "abuse_security",
    "shipping_delivery",
    "other",
]

UrgencyType = Literal[
    "low",
    "normal",
    "high",
    "critical",
]

# Team types
TeamType = Literal[
    "tech support",
    "billing team",
    "account security",
    "logistics",
    "general support",
]

# Category to owning team lookup table
CATEGORY_TEAM_MAP: Final[Dict[str, str]] = {
    "technical_issue": "tech support",
    "billing": "billing team",
    "abuse_security": "account security",
    "shipping_delivery": "logistics",
    "other": "general support",
}

# Categories eligible for auto-drafting (System 2 LLM reply drafting)
AUTO_DRAFT_ELIGIBLE_CATEGORIES: Final[Set[str]] = {
    "technical_issue",
    "shipping_delivery",
}

# High-risk categories that require human oversight / escalation
HUMAN_ESCALATION_CATEGORIES: Final[Set[str]] = {
    "billing",
    "abuse_security",
    "other",
}

# Default confidence thresholds
DEFAULT_CONF_CATEGORY_MIN: Final[float] = 0.80
DEFAULT_CONF_URGENCY_MIN: Final[float] = 0.75

# Criteria descriptions for Laya zero-shot routing
CATEGORY_CRITERIA: Final[Dict[str, str]] = {
    "technical_issue": "Software bugs, error messages, technical problems, glitches, app crashes, system issues, how-to failures",
    "billing": "Invoices, charges, payment failures, refunds, subscription renewals, pricing disputes, receipts",
    "abuse_security": "Security threats, account compromise, suspicious login, unauthorized access, phishing, fraud, credential abuse, hacking",
    "shipping_delivery": "Order tracking, package delivery, missing shipments, transit status, courier issues, delivery delays",
    "other": "General questions, suggestions, feedback, praise, or unclassified requests",
}

URGENCY_CRITERIA: Final[Dict[str, str]] = {
    "low": "No operational impact. How-to questions, feature requests, minor cosmetic bugs, or general feedback. User can continue working.",
    "normal": "Isolated operational impact. A single user faces friction or a non-critical feature is broken, but a workaround exists. Standard account or billing issues.",
    "high": "Severe operational impact. A core workflow is broken with no immediate workaround, or an issue is actively blocking multiple users. Pressing time-sensitive deadlines.",
    "critical": "Catastrophic impact. Complete system outage, active security breach, unrecoverable data loss, or total platform inaccessibility."
}

# Laya questions definition schema
LAYA_ROUTING_QUESTIONS: Final[Dict[str, Dict]] = {
    "category": {
        "type": "choice",
        "instructions": "What is the primary category of this customer support inquiry?",
        "criteria": CATEGORY_CRITERIA,
    },
    "urgency": {
        "type": "choice",
        "instructions": (
            "Determine the objective urgency of the support ticket. "
            "WARNING: Ignore the user's emotional tone, capitalization, or self-reported urgency. "
            "Evaluate strictly based on: 1) Is there a workaround? 2) How many users are affected? 3) Is there data/security risk?"
        ),
        "criteria": URGENCY_CRITERIA,
    },
}


def get_team_for_category(category: str) -> str:
    """Return the owning team name for a given category with fallback to general support."""
    return CATEGORY_TEAM_MAP.get(category, "general support")


def is_auto_draft_eligible(category: str) -> bool:
    """Check if the given category is eligible for auto-drafting."""
    return category in AUTO_DRAFT_ELIGIBLE_CATEGORIES


def evaluate_routing_policy(
    category: str,
    category_conf: float,
    urgency: str,
    urgency_conf: float,
    min_cat_conf: float = DEFAULT_CONF_CATEGORY_MIN,
    min_urg_conf: float = DEFAULT_CONF_URGENCY_MIN,
) -> tuple[str, str]:
    """Evaluate deterministic decision policy on router output.

    Returns:
        tuple[Route, route_reason]
    """
    if category in HUMAN_ESCALATION_CATEGORIES:
        return (
            "HUMAN_QUEUE",
            f"Escalated to human queue: category '{category}' requires human oversight.",
        )
    if urgency == "critical":
        return (
            "HUMAN_QUEUE",
            "Escalated to human queue: critical urgency detected.",
        )
    if category_conf < min_cat_conf or urgency_conf < min_urg_conf:
        return (
            "HUMAN_QUEUE",
            f"Escalated to human queue: confidence below threshold (category: {category_conf:.2f}/{min_cat_conf:.2f}, urgency: {urgency_conf:.2f}/{min_urg_conf:.2f}).",
        )
    if is_auto_draft_eligible(category):
        return (
            "AUTO_DRAFT",
            f"Auto-draft eligible: category '{category}' meets confidence ({category_conf:.2f}) and urgency criteria.",
        )
    return (
        "HUMAN_QUEUE",
        f"Escalated to human queue: category '{category}' not eligible for auto-drafting.",
    )

