#!/usr/bin/env python3
"""Latency benchmark script for TriageGuard triage pipeline.

Reads labeled tickets from backend/tests/test_ticket_data_labeled.csv,
sends them to POST /api/v1/triage at a configurable concurrency (default 1, supports 4, 16, etc.),
excludes the first 3 requests as warmup,
reports p50, p95, and p99 for:
  (a) client end-to-end latency
  (b) each trace node duration (sanitize_and_guard, route_with_laya, etc.),
prints device info (CPU/GPU) and detector mode from /api/health,
and writes full results to eval/reports/latency_<timestamp>.json.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
from typing import Any, Dict, List

import httpx
import numpy as np

# Ensure repo root is in sys.path
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

DEFAULT_CSV_PATH = _REPO_ROOT / "backend" / "tests" / "test_ticket_data_labeled.csv"
DEFAULT_REPORTS_DIR = _REPO_ROOT / "eval" / "reports"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark latency of TriageGuard /api/v1/triage endpoint."
    )
    parser.add_argument(
        "-c",
        "--concurrency",
        type=int,
        default=1,
        choices=[1, 4, 16],
        help="Number of concurrent requests (default: 1; supports 1, 4, 16).",
    )
    parser.add_argument(
        "--url",
        type=str,
        default="http://localhost:8000",
        help="Base URL of running TriageGuard service (default: http://localhost:8000).",
    )
    parser.add_argument(
        "--csv-path",
        type=str,
        default=str(DEFAULT_CSV_PATH),
        help=f"Path to ticket CSV dataset (default: {DEFAULT_CSV_PATH}).",
    )
    parser.add_argument(
        "--warmup",
        type=int,
        default=3,
        help="Number of warmup requests to exclude from metrics (default: 3).",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Custom path for output JSON report (default: eval/reports/latency_<timestamp>.json).",
    )
    return parser.parse_args()


def load_tickets(csv_path: Path) -> List[Dict[str, str]]:
    """Load tickets from labeled CSV file."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Tickets CSV not found at: {csv_path}")

    tickets: List[Dict[str, str]] = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            input_text = row.get("input_text", "").strip()
            if input_text:
                tickets.append({
                    "customer_id": row.get("customer_id", "").strip(),
                    "body": input_text,
                    "is_malicious": row.get("is_malicious", "0").strip(),
                })
    return tickets


async def fetch_health_metadata(client: httpx.AsyncClient, base_url: str) -> Dict[str, Any]:
    """Fetch system health, device, and detector mode info from /api/health."""
    health_url = f"{base_url.rstrip('/')}/api/health"
    try:
        resp = await client.get(health_url)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"[WARNING] Could not fetch /api/health from {health_url}: {exc}")
        return {}


def compute_percentiles(values: List[float]) -> Dict[str, float]:
    """Calculate count, p50, p95, p99, mean, min, max for a list of latency values (in ms)."""
    if not values:
        return {
            "count": 0,
            "p50": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "mean": 0.0,
            "min": 0.0,
            "max": 0.0,
        }
    arr = np.array(values)
    return {
        "count": len(values),
        "p50": round(float(np.percentile(arr, 50)), 2),
        "p95": round(float(np.percentile(arr, 95)), 2),
        "p99": round(float(np.percentile(arr, 99)), 2),
        "mean": round(float(np.mean(arr)), 2),
        "min": round(float(np.min(arr)), 2),
        "max": round(float(np.max(arr)), 2),
    }


async def send_triage_request(
    client: httpx.AsyncClient,
    triage_url: str,
    ticket: Dict[str, str],
    sem: asyncio.Semaphore,
) -> Dict[str, Any]:
    """Send a single ticket to POST /api/v1/triage and capture client latency + trace node durations."""
    payload = {
        "body": ticket["body"],
        "customer_ref": ticket.get("customer_id") or None,
        "channel": "web",
    }

    async with sem:
        start_perf = time.perf_counter()
        try:
            resp = await client.post(triage_url, json=payload)
            elapsed_ms = (time.perf_counter() - start_perf) * 1000
            status_code = resp.status_code
            if status_code == 200:
                data = resp.json()
                return {
                    "success": True,
                    "status_code": status_code,
                    "elapsed_ms": round(elapsed_ms, 2),
                    "route": data.get("route"),
                    "route_reason": data.get("route_reason"),
                    "risk_flags": data.get("risk_flags") or [],
                    "trace": data.get("trace") or [],
                    "guard_result": data.get("guard_result"),
                }
            else:
                return {
                    "success": False,
                    "status_code": status_code,
                    "elapsed_ms": round(elapsed_ms, 2),
                    "error": f"HTTP {status_code}: {resp.text[:200]}",
                    "trace": [],
                }
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start_perf) * 1000
            return {
                "success": False,
                "status_code": 0,
                "elapsed_ms": round(elapsed_ms, 2),
                "error": str(exc),
                "trace": [],
            }


async def main_async() -> int:
    args = parse_args()
    csv_path = Path(args.csv_path)
    tickets = load_tickets(csv_path)
    if not tickets:
        print(f"[ERROR] No tickets found in {csv_path}")
        return 1

    triage_url = f"{args.url.rstrip('/')}/api/v1/triage"

    # Configure timeout to allow concurrent neural inference queues
    timeout = httpx.Timeout(connect=10.0, read=90.0, write=10.0, pool=90.0)
    limits = httpx.Limits(max_connections=args.concurrency * 2, max_keepalive_connections=args.concurrency * 2)

    async with httpx.AsyncClient(timeout=timeout, limits=limits) as client:
        # 1. Fetch and print system health, device, and detector mode
        health_data = await fetch_health_metadata(client, args.url)
        device_info = health_data.get("device") or health_data.get("models", {}).get("device", "unknown")
        detector_mode = health_data.get("prompt_guard_mode") or health_data.get("models", {}).get("prompt_guard_mode", "unknown")
        model_id = health_data.get("model_id") or health_data.get("models", {}).get("model_id", "unknown")
        revision = health_data.get("revision") or health_data.get("models", {}).get("revision", "unknown")

        print("=" * 80)
        print("                 TriageGuard Latency Benchmark Runner")
        print("=" * 80)
        print(f"  * Endpoint:         {triage_url}")
        print(f"  * Concurrency:      {args.concurrency}")
        print(f"  * Device:           {device_info.upper()}")
        print(f"  * Detector Mode:    {detector_mode}")
        print(f"  * Model ID:         {model_id}")
        print(f"  * Model Revision:   {revision}")
        print(f"  * Total Tickets:    {len(tickets)}")
        print(f"  * Warmup Requests:  {args.warmup} (excluded from benchmark statistics)")
        print("-" * 80)

        # 2. Warmup phase (first N requests excluded)
        warmup_count = min(args.warmup, len(tickets))
        warmup_tickets = tickets[:warmup_count]
        bench_tickets = tickets[warmup_count:]

        print(f"\n[Phase 1] Executing {warmup_count} warmup requests...", flush=True)
        warmup_sem = asyncio.Semaphore(1)
        warmup_results = []
        for idx, ticket in enumerate(warmup_tickets, start=1):
            res = await send_triage_request(client, triage_url, ticket, warmup_sem)
            warmup_results.append(res)
            print(f"  Warmup {idx}/{warmup_count}: status={res.get('status_code')} latency={res.get('elapsed_ms')}ms", flush=True)

        # 3. Benchmark phase
        print(f"\n[Phase 2] Dispatching {len(bench_tickets)} benchmark requests at concurrency {args.concurrency}...", flush=True)
        bench_sem = asyncio.Semaphore(args.concurrency)
        start_bench_time = time.perf_counter()

        completed_count = 0
        total_bench = len(bench_tickets)

        async def tracked_request(ticket: Dict[str, str]) -> Dict[str, Any]:
            nonlocal completed_count
            res = await send_triage_request(client, triage_url, ticket, bench_sem)
            completed_count += 1
            if completed_count % max(1, total_bench // 5) == 0 or completed_count == total_bench:
                elapsed_so_far = time.perf_counter() - start_bench_time
                print(f"  Progress: {completed_count}/{total_bench} completed ({elapsed_so_far:.1f}s elapsed)", flush=True)
            return res

        bench_results = await asyncio.gather(*(tracked_request(t) for t in bench_tickets))
        total_bench_duration_s = time.perf_counter() - start_bench_time

    # 4. Aggregate metrics (excluding warmup requests)
    client_latencies: List[float] = []
    node_durations: Dict[str, List[float]] = {}
    failed_requests: int = 0

    for res in bench_results:
        if res.get("success"):
            client_latencies.append(res["elapsed_ms"])
            for trace_item in res.get("trace", []):
                node = trace_item.get("node")
                duration = trace_item.get("duration_ms")
                if node and duration is not None:
                    node_durations.setdefault(node, []).append(float(duration))
        else:
            failed_requests += 1

    client_e2e_stats = compute_percentiles(client_latencies)
    nodes_stats = {
        node: compute_percentiles(durations)
        for node, durations in sorted(node_durations.items())
    }

    # 5. Display benchmark summary table
    print("\n" + "=" * 80)
    print("                     Benchmark Results & Percentiles")
    print("=" * 80)
    print(f"{'Metric / Node':<24} | {'Count':<6} | {'p50 (ms)':<9} | {'p95 (ms)':<9} | {'p99 (ms)':<9} | {'Mean (ms)':<9}")
    print("-" * 80)
    print(
        f"{'Client End-to-End':<24} | "
        f"{client_e2e_stats['count']:<6} | "
        f"{client_e2e_stats['p50']:<9.2f} | "
        f"{client_e2e_stats['p95']:<9.2f} | "
        f"{client_e2e_stats['p99']:<9.2f} | "
        f"{client_e2e_stats['mean']:<9.2f}"
    )

    for node_name, stats in nodes_stats.items():
        print(
            f"{node_name:<24} | "
            f"{stats['count']:<6} | "
            f"{stats['p50']:<9.2f} | "
            f"{stats['p95']:<9.2f} | "
            f"{stats['p99']:<9.2f} | "
            f"{stats['mean']:<9.2f}"
        )
    print("-" * 80)
    print(f"Total benchmark wall-clock time: {total_bench_duration_s:.2f}s | Failed requests: {failed_requests}")

    # 6. Save results to JSON file
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    DEFAULT_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_file = Path(args.output) if args.output else DEFAULT_REPORTS_DIR / f"latency_{timestamp_str}.json"

    report_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "concurrency": args.concurrency,
        "endpoint": triage_url,
        "device": device_info,
        "detector_mode": detector_mode,
        "model_id": model_id,
        "revision": revision,
        "dataset": {
            "csv_path": str(csv_path),
            "total_tickets_sent": len(tickets),
            "warmup_requests_excluded": warmup_count,
            "benchmarked_requests": len(bench_tickets),
            "successful_requests": len(client_latencies),
            "failed_requests": failed_requests,
        },
        "wall_clock_duration_seconds": round(total_bench_duration_s, 2),
        "summary": {
            "client_e2e_latency_ms": client_e2e_stats,
            "trace_nodes_ms": nodes_stats,
        },
        "raw_samples": [
            {
                "elapsed_ms": r.get("elapsed_ms"),
                "status_code": r.get("status_code"),
                "route": r.get("route"),
                "route_reason": r.get("route_reason"),
                "risk_flags": r.get("risk_flags"),
                "trace": r.get("trace"),
            }
            for r in bench_results
        ],
    }

    report_file.parent.mkdir(parents=True, exist_ok=True)
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)

    print(f"\n[REPORT SAVED] Detailed results written to: {report_file}")
    print("=" * 80)
    return 0


def main() -> None:
    sys.exit(asyncio.run(main_async()))


if __name__ == "__main__":
    main()
