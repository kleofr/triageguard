"""FastAPI endpoint for batch dataset loading and benchmarking."""

from __future__ import annotations

import csv
import io
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()


class BatchTicketItem(BaseModel):
    customer_id: str
    input_text: str
    subject: Optional[str] = None
    expected_category: Optional[str] = None
    is_malicious: Optional[int] = None


class BatchDatasetResponse(BaseModel):
    found: bool
    file_path: str
    total_count: int
    tickets: List[BatchTicketItem]
    message: str


class RawCsvUploadRequest(BaseModel):
    csv_text: str = Field(..., description="Raw CSV text content")
    filename: Optional[str] = Field(default="uploaded.csv", description="Original filename")


def _parse_csv_content(content: str) -> List[BatchTicketItem]:
    """Parse CSV text into normalized BatchTicketItem objects."""
    reader = csv.DictReader(io.StringIO(content))
    tickets: List[BatchTicketItem] = []

    if not reader.fieldnames:
        return []

    # Map column headers case-insensitively
    field_map = {name.strip().lower().replace(" ", "_").replace("-", "_"): name for name in reader.fieldnames}

    cust_col = next(
        (field_map[k] for k in ["customer_id", "customerid", "customer", "cust_id", "id", "user_id"] if k in field_map),
        None
    )
    text_col = next(
        (field_map[k] for k in ["input_text", "inputtext", "text", "body", "message", "ticket_text", "prompt", "description"] if k in field_map),
        None
    )
    subj_col = next(
        (field_map[k] for k in ["subject", "title", "ticket_subject"] if k in field_map),
        None
    )
    cat_col = next(
        (field_map[k] for k in ["expected_category", "category", "label", "target"] if k in field_map),
        None
    )
    malicious_col = next(
        (field_map[k] for k in ["is_malicious", "ismalicious", "malicious", "is_attack", "attack", "ground_truth", "groundtruth"] if k in field_map),
        None
    )

    for i, row in enumerate(reader):
        cust_id = (row.get(cust_col, "") or f"cust_{i+1:03d}").strip() if cust_col else f"cust_{i+1:03d}"
        text = (row.get(text_col, "") or "").strip() if text_col else ""
        subj = (row.get(subj_col, "") or "").strip() if subj_col else None
        expected_cat = (row.get(cat_col, "") or "").strip() if cat_col else None

        is_malicious = None
        if malicious_col:
            raw_mal = (row.get(malicious_col, "") or "").strip().lower()
            if raw_mal in ("1", "true", "yes", "malicious"):
                is_malicious = 1
            elif raw_mal in ("0", "false", "no", "benign"):
                is_malicious = 0

        if text:
            tickets.append(
                BatchTicketItem(
                    customer_id=cust_id,
                    input_text=text,
                    subject=subj or None,
                    expected_category=expected_cat or None,
                    is_malicious=is_malicious,
                )
            )

    return tickets


@router.get(
    "/dataset",
    response_model=BatchDatasetResponse,
    status_code=status.HTTP_200_OK,
    summary="Load benchmark test dataset from backend/tests/test_ticket_data_labeled.csv or test_ticket_data.csv",
)
async def get_test_dataset():
    """Retrieve test tickets from backend/tests/test_ticket_data_labeled.csv if present on disk."""
    possible_paths = [
        Path("backend/tests/test_ticket_data_labeled.csv"),
        Path("tests/test_ticket_data_labeled.csv"),
        Path(__file__).parent.parent.parent.parent / "tests" / "test_ticket_data_labeled.csv",
        Path.cwd() / "backend" / "tests" / "test_ticket_data_labeled.csv",
        Path("backend/tests/test_ticket_data.csv"),
        Path("tests/test_ticket_data.csv"),
        Path(__file__).parent.parent.parent.parent / "tests" / "test_ticket_data.csv",
        Path.cwd() / "backend" / "tests" / "test_ticket_data.csv",
    ]

    found_path = None
    for p in possible_paths:
        if p.exists() and p.is_file():
            found_path = p
            break

    if not found_path:
        return BatchDatasetResponse(
            found=False,
            file_path="backend/tests/test_ticket_data.csv",
            total_count=0,
            tickets=[],
            message="File backend/tests/test_ticket_data.csv not found on server disk. You can upload one via the UI.",
        )

    try:
        with open(found_path, mode="r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        tickets = _parse_csv_content(content)

        return BatchDatasetResponse(
            found=True,
            file_path=str(found_path),
            total_count=len(tickets),
            tickets=tickets,
            message=f"Successfully loaded {len(tickets)} tickets from {found_path.name}",
        )
    except Exception as exc:
        logger.error(f"Error reading CSV file at {found_path}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read dataset file: {str(exc)}",
        )


@router.post(
    "/upload",
    response_model=BatchDatasetResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload custom CSV and parse into batch tickets",
)
async def upload_csv_dataset(req: RawCsvUploadRequest):
    """Upload a CSV dataset as text and return parsed tickets."""
    try:
        tickets = _parse_csv_content(req.csv_text)

        return BatchDatasetResponse(
            found=True,
            file_path=req.filename or "uploaded.csv",
            total_count=len(tickets),
            tickets=tickets,
            message=f"Successfully parsed {len(tickets)} tickets from uploaded data ({req.filename})",
        )
    except Exception as exc:
        logger.error(f"Error processing uploaded CSV: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse uploaded CSV: {str(exc)}",
        )

