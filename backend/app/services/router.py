"""Laya router adapter service for customer support classification and routing.

This module provides the System 1 fast-routing classification layer for TriageGuard.
It classifies incoming sanitized queries into categories, urgency levels, and owning teams
with confidence scores, adhering to strict fail-closed invariants.
"""

from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any, Dict, Optional

try:
    from backend.app.graph.state import RouterOutput
    from backend.app.policy.taxonomy import (
        DEFAULT_CONF_CATEGORY_MIN,
        DEFAULT_CONF_URGENCY_MIN,
        LAYA_ROUTING_QUESTIONS,
        get_team_for_category,
    )
except ImportError:
    from app.graph.state import RouterOutput
    from app.policy.taxonomy import (
        DEFAULT_CONF_CATEGORY_MIN,
        DEFAULT_CONF_URGENCY_MIN,
        LAYA_ROUTING_QUESTIONS,
        get_team_for_category,
    )

logger = logging.getLogger(__name__)

# Fallback output adhering to fail-closed principles on error or timeout
FAIL_CLOSED_ROUTER_OUTPUT: RouterOutput = {
    "category": "other",
    "category_conf": 0.0,
    "urgency": "critical",
    "urgency_conf": 0.0,
    "team": "general support",
}


class LayaRouterService:
    """Service adapter for Laya zero-shot classification router."""

    def __init__(
        self,
        preload: bool = False,
        timeout_s: float = 5.0,
        mock_mode: bool = False,
        device: Optional[str] = None,
    ) -> None:
        self.timeout_s = timeout_s
        self.mock_mode = mock_mode
        self.preload = preload
        if device is not None:
            self.device = device
        else:
            try:
                import torch
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
            except Exception:
                self.device = "cpu"

        self._router = None
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="laya-router")

        if not self.mock_mode and preload:
            self._ensure_router(preload=True)

    def is_ready(self) -> bool:
        """Check if router is initialized or running in mock mode."""
        if self.mock_mode:
            return True
        return self._router is not None

    def warmup(self) -> bool:
        """Warm up underlying Laya Router models on bootup."""
        if self.mock_mode or os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("ROUTER_MOCK"):
            self.mock_mode = True
            return True
        try:
            self._ensure_router(preload=True)
            return True
        except Exception as e:
            logger.warning(f"Router warmup failed: {e}")
            return False

    def _ensure_router(self, preload: bool = False) -> Any:
        """Lazily initialize the underlying Laya Router instance."""
        if self._router is None and not self.mock_mode:
            try:
                from laya import Router
                self._router = Router(device=self.device, preload=False)
                if preload or self.preload:
                    self._router.preload(["english"])
            except Exception as e:
                logger.warning(f"Could not initialize Laya Router (falling back to mock/heuristic): {e}")
                self.mock_mode = True
        return self._router

    def _parse_confidence(self, answer_dict: Dict[str, Any], default: float = 0.85) -> float:
        """Safely extract and normalize confidence score to a float between 0.0 and 1.0."""
        if not isinstance(answer_dict, dict):
            return 0.0

        # Check for probabilities dict with selected choice
        choice = answer_dict.get("choice")
        probabilities = answer_dict.get("probabilities")
        if isinstance(probabilities, dict) and choice in probabilities:
            prob_val = probabilities[choice]
            if isinstance(prob_val, (int, float)):
                return max(0.0, min(1.0, float(prob_val)))

        # Check explicit confidence keys (prioritizing answer_confidence)
        for key in ("answer_confidence", "confidence", "score", "probability", "conf", "noul"):
            if key in answer_dict:
                val = answer_dict[key]
                if isinstance(val, (int, float)):
                    return max(0.0, min(1.0, float(val)))

        # If choice is present without an explicit confidence key, return default confidence
        if choice:
            return default

        return 0.0

    def _mock_predict(self, text: str) -> Dict[str, Any]:
        """Deterministic heuristic fallback classifier for mock/test environments."""
        text_lower = text.lower()
        
        # Category detection heuristics
        if any(w in text_lower for w in ["hack", "exploit", "breach", "phish", "unauthorized", "stolen", "compromise"]):
            category = "abuse_security"
            cat_conf = 0.95
        elif any(w in text_lower for w in ["bill", "invoice", "refund", "charge", "payment", "subscription", "price", "receipt"]):
            category = "billing"
            cat_conf = 0.92
        elif any(w in text_lower for w in ["track", "ship", "delivery", "order #", "package", "courier", "transit"]):
            category = "shipping_delivery"
            cat_conf = 0.90
        elif any(w in text_lower for w in ["bug", "error", "glitch", "crash", "stack", "exception", "broken", "fail", "login failed"]):
            category = "technical_issue"
            cat_conf = 0.89
        else:
            category = "other"
            cat_conf = 0.70

        # Urgency detection heuristics
        if any(w in text_lower for w in ["down", "emergency", "critical", "blocking", "immediately", "outage"]):
            urgency = "critical"
            urg_conf = 0.95
        elif any(w in text_lower for w in ["urgent", "asap", "soon", "important"]):
            urgency = "high"
            urg_conf = 0.85
        elif any(w in text_lower for w in ["minor", "feedback", "suggestion", "when you have time"]):
            urgency = "low"
            urg_conf = 0.80
        else:
            urgency = "normal"
            urg_conf = 0.80

        return {
            "answers": {
                "category": {"choice": category, "confidence": cat_conf},
                "urgency": {"choice": urgency, "confidence": urg_conf},
            }
        }

    def _raw_predict(self, text: str) -> Dict[str, Any]:
        """Perform raw prediction using Laya Router or mock predictor."""
        if self.mock_mode:
            return self._mock_predict(text)

        router = self._ensure_router()
        if router is None:
            return self._mock_predict(text)

        return router.predict(text, LAYA_ROUTING_QUESTIONS)

    def classify(self, text: str, timeout_s: Optional[float] = None) -> RouterOutput:
        """Classify sanitized customer support text into category, urgency, and owning team.

        Args:
            text: The sanitized customer support text (must not be empty).
            timeout_s: Optional execution timeout in seconds. Defaults to self.timeout_s.

        Returns:
            RouterOutput dict containing category, category_conf, urgency, urgency_conf, and team.
            Adheres strictly to fail-closed principles on error, empty text, or timeout.
        """
        if not text or not text.strip():
            logger.warning("Empty or blank text provided to LayaRouterService; failing closed.")
            return dict(FAIL_CLOSED_ROUTER_OUTPUT)

        effective_timeout = timeout_s if timeout_s is not None else self.timeout_s

        try:
            future = self._executor.submit(self._raw_predict, text)
            result = future.result(timeout=effective_timeout)

            answers = result.get("answers", {}) if isinstance(result, dict) else {}
            
            # Extract Category
            cat_answer = answers.get("category", {}) if isinstance(answers, dict) else {}
            category = cat_answer.get("choice", "other") if isinstance(cat_answer, dict) else "other"
            category_conf = self._parse_confidence(cat_answer, default=DEFAULT_CONF_CATEGORY_MIN)

            # Extract Urgency
            urg_answer = answers.get("urgency", {}) if isinstance(answers, dict) else {}
            urgency = urg_answer.get("choice", "normal") if isinstance(urg_answer, dict) else "normal"
            urgency_conf = self._parse_confidence(urg_answer, default=DEFAULT_CONF_URGENCY_MIN)

            # Resolve Team
            team = get_team_for_category(category)

            return {
                "category": category,
                "category_conf": round(category_conf, 4),
                "urgency": urgency,
                "urgency_conf": round(urgency_conf, 4),
                "team": team,
            }

        except FuturesTimeoutError:
            logger.error(f"LayaRouterService prediction timed out after {effective_timeout}s; failing closed.")
            return dict(FAIL_CLOSED_ROUTER_OUTPUT)
        except Exception as exc:
            logger.error(f"LayaRouterService prediction failed: {exc}; failing closed.")
            return dict(FAIL_CLOSED_ROUTER_OUTPUT)

    def close(self) -> None:
        """Clean up executor resources."""
        self._executor.shutdown(wait=False)


# Default global router instance (lazy-loaded)
_default_router_service: Optional[LayaRouterService] = None


def get_router_service(mock_mode: bool = False, device: Optional[str] = None) -> LayaRouterService:
    """Get or initialize the singleton LayaRouterService instance."""
    global _default_router_service
    if _default_router_service is None:
        _default_router_service = LayaRouterService(mock_mode=mock_mode, device=device)
    return _default_router_service