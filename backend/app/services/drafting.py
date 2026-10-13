"""OpenRouter drafting service for generating automated replies in TriageGuard."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Protocol

try:
    from openrouter import OpenRouter
except ImportError:
    OpenRouter = None

import httpx

logger = logging.getLogger(__name__)


class DraftingService(Protocol):
    """Protocol interface for draft response generation services."""

    def generate_draft(
        self,
        sanitized_text: str,
        category: str,
        team: str,
        ticket_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> tuple[str, List[str]]:
        """Generate a draft response and corresponding citations.

        Returns:
            tuple[draft_text, citations_list]
        """
        ...


class OpenRouterDraftingService:
    """Generates customer support draft replies exclusively via OpenRouter."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_s: int = 20,
    ):
        if api_key is not None:
            self.api_key = api_key.strip()
        else:
            self.api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        self.model = model or os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")
        raw_base = base_url or os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        self.base_url = raw_base.rstrip("/")
        self.timeout_s = timeout_s


        # Initialize official OpenRouter client if SDK is installed and key is provided
        self.client: Optional[Any] = None
        if self.api_key and OpenRouter is not None:
            try:
                self.client = OpenRouter(
                    api_key=self.api_key,
                    http_referer="https://github.com/triageguard",
                    x_open_router_title="TriageGuard Customer Support",
                )
            except Exception as exc:
                logger.warning(f"Failed to instantiate OpenRouter SDK client: {exc}")
                self.client = None

    def generate_draft(
        self,
        sanitized_text: str,
        category: str,
        team: str,
        ticket_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> tuple[str, List[str]]:
        """Generate a draft response using OpenRouter chat completion."""
        if not self.api_key:
            raise ValueError(
                "OPENROUTER_API_KEY is not configured. Please add your OpenRouter API key in .env"
            )

        clean_cat = category.replace("_", " ").title()
        clean_team = team.title()
        t_id = ticket_id or "unassigned"

        system_prompt = (
            "You are a professional customer support agent for an enterprise platform. "
            "Write a concise, polite, empathetic draft response addressing the user's issue. "
            "Provide helpful next steps or an assurance of investigation. Return only the response message body."
        )
        user_prompt = (
            f"Ticket: {t_id}\n"
            f"Category: {clean_cat}\n"
            f"Department: {clean_team}\n"
            f"Customer Inquiry: {sanitized_text}\n\n"
            "Draft response:"
        )

        # 1. Primary: Use official OpenRouter SDK
        if self.client is not None and hasattr(self.client, "chat") and hasattr(self.client.chat, "send"):
            try:
                result = self.client.chat.send(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.3,
                    max_tokens=400,
                    timeout_ms=int(self.timeout_s * 1000),
                )
                if result and hasattr(result, "choices") and result.choices:
                    first_choice = result.choices[0]
                    msg = getattr(first_choice, "message", None)
                    content = getattr(msg, "content", None)
                    if isinstance(content, str) and content.strip():
                        return content.strip(), [f"openrouter:{self.model}"]
                    elif isinstance(content, list):
                        text = "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content)
                        if text.strip():
                            return text.strip(), [f"openrouter:{self.model}"]
            except Exception as exc:
                if ":free" in self.model:
                    fallback_model = self.model.replace(":free", "")
                    try:
                        logger.info(f"OpenRouter SDK returned error ({exc}); retrying with {fallback_model}...")
                        result = self.client.chat.send(
                            model=fallback_model,
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            temperature=0.3,
                            max_tokens=400,
                            timeout_ms=int(self.timeout_s * 1000),
                        )
                        if result and hasattr(result, "choices") and result.choices:
                            first_choice = result.choices[0]
                            msg = getattr(first_choice, "message", None)
                            content = getattr(msg, "content", None)
                            if isinstance(content, str) and content.strip():
                                return content.strip(), [f"openrouter:{fallback_model}"]
                    except Exception:
                        pass
                logger.warning(
                    f"OpenRouter SDK chat.send error ({exc}); attempting direct HTTP request.",
                    exc_info=True,
                )

        # 2. Secondary: Direct HTTP POST to OpenRouter completions endpoint
        active_model = self.model
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/triageguard",
            "X-Title": "TriageGuard Customer Support",
        }
        payload = {
            "model": active_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 400,
        }

        with httpx.Client(timeout=float(self.timeout_s)) as http_client:
            response = http_client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            # If a model slug ended with :free and OpenRouter returned 404, retry with standard slug
            if response.status_code == 404 and ":free" in active_model:
                fallback_model = active_model.replace(":free", "")
                logger.info(f"OpenRouter returned 404 for {active_model}; retrying with {fallback_model}...")
                payload["model"] = fallback_model
                response = http_client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                active_model = fallback_model

            response.raise_for_status()
            data = response.json()
            draft_content = data["choices"][0]["message"]["content"].strip()
            citations = [f"openrouter:{active_model}"]
            return draft_content, citations



# Global instance
_default_drafting_service: Optional[DraftingService] = None


def reset_drafting_service() -> None:
    """Reset cached drafting service instance."""
    global _default_drafting_service
    _default_drafting_service = None


def get_drafting_service() -> DraftingService:
    """Retrieve the active OpenRouter drafting service instance."""
    global _default_drafting_service
    if _default_drafting_service is None:
        _default_drafting_service = OpenRouterDraftingService()
    return _default_drafting_service
