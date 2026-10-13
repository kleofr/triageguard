"""Sanitizer API endpoints."""

import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

try:
    from backend.app.services.sanitizer import (
        DeterministicSanitizer,
        SanitizerConfig,
        SanitizationResult,
    )
except ImportError:
    from app.services.sanitizer import (
        DeterministicSanitizer,
        SanitizerConfig,
        SanitizationResult,
    )

router = APIRouter()


class SanitizeRequest(BaseModel):
    """Payload for sanitization request."""
    customer_id: str = Field(
        ...,
        description="Unique identifier for the customer / tenant",
        examples=["cust_10492", "tenant_alpha"]
    )
    text: str = Field(
        ...,
        description="Raw incoming user prompt or ticket text to sanitize",
        examples=["Hello, my email is john.doe@example.com and check http://suspicious-site.com"]
    )
    config: Optional[SanitizerConfig] = Field(
        default=None,
        description="Optional custom sanitizer rules configuration"
    )


class SanitizeResponse(BaseModel):
    """Response payload containing sanitization results and audit metadata."""
    customer_id: str
    timestamp: str
    processing_time_ms: float
    result: SanitizationResult


@router.post(
    "",
    response_model=SanitizeResponse,
    summary="Sanitize input text",
    description="Runs deterministic sanitization (PII redaction, URL defanging, injection scanning, Unicode normalization) on text for a given customerID."
)
@router.post(
    "/",
    response_model=SanitizeResponse,
    include_in_schema=False
)
async def sanitize_endpoint(payload: SanitizeRequest) -> SanitizeResponse:
    start_time = time.perf_counter()

    try:
        sanitizer = DeterministicSanitizer(config=payload.config)
        sanitization_result = sanitizer.sanitize(payload.text)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sanitization failed: {str(exc)}"
        )

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 3)

    return SanitizeResponse(
        customer_id=payload.customer_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        processing_time_ms=elapsed_ms,
        result=sanitization_result
    )
