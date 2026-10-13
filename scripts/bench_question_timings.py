"""Benchmark script to measure Laya prediction latency per question and in batch."""

import sys
import time
from pathlib import Path

# Ensure repo root is in sys.path
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.app.services.router import get_router_service
from backend.app.policy.taxonomy import LAYA_ROUTING_QUESTIONS


def main():
    service = get_router_service()
    print("Warming up Laya Router...")
    service.warmup()
    router = service._ensure_router()

    if router is None:
        print("Error: Router could not be initialized.")
        return

    text = "My account was charged twice for the monthly subscription. Please refund the $49 duplicate charge immediately."
    print(f"\nTest text: \"{text}\"\n")
    print(f"Device: {getattr(service, 'device', 'unknown')}")
    print("-" * 60)

    # 1. Warm-up forward pass to prime PyTorch threadpool & caches
    _ = router.predict(text, {"category": LAYA_ROUTING_QUESTIONS["category"]})

    timings = {}

    # Measure each defined question individually
    for q_name, q_def in LAYA_ROUTING_QUESTIONS.items():
        # Run 3 iterations and take median / average
        runs = []
        for _ in range(3):
            t0 = time.perf_counter()
            res = router.predict(text, {q_name: q_def})
            runs.append((time.perf_counter() - t0) * 1000)

        avg_time = sum(runs) / len(runs)
        timings[q_name] = avg_time
        num_options = len(q_def.get("criteria", {}))
        choice = res.get("answers", {}).get(q_name, {}).get("choice")
        conf = res.get("answers", {}).get(q_name, {}).get("confidence", 0.0)
        print(f"Question: '{q_name}' ({num_options} options)")
        print(f"  Runs: {[f'{r:.1f}ms' for r in runs]}")
        print(f"  Average Time: {avg_time:.1f} ms")
        print(f"  Result: choice='{choice}', confidence={conf:.3f}\n")

    # Measure all configured questions combined (parallel multi-question pass)
    runs_all = []
    for _ in range(3):
        t0 = time.perf_counter()
        _ = router.predict(text, LAYA_ROUTING_QUESTIONS)
        runs_all.append((time.perf_counter() - t0) * 1000)
    avg_all = sum(runs_all) / len(runs_all)

    print("-" * 60)
    print(f"All questions together in 1 predict() call (category + urgency):")
    print(f"  Runs: {[f'{r:.1f}ms' for r in runs_all]}")
    print(f"  Average Combined Time: {avg_all:.1f} ms")

    # Measure with an additional 3rd hypothetical question (e.g. sentiment / escalation)
    q3 = {
        "type": "choice",
        "instructions": "What is the sentiment and customer tone of this message?",
        "criteria": {
            "frustrated": "The customer is angry, upset, or impatient.",
            "neutral": "The customer is matter-of-fact and calm.",
            "positive": "The customer is polite, grateful, or appreciative.",
        },
    }
    three_questions = {**LAYA_ROUTING_QUESTIONS, "sentiment": q3}

    runs_q3 = []
    for _ in range(3):
        t0 = time.perf_counter()
        _ = router.predict(text, {"sentiment": q3})
        runs_q3.append((time.perf_counter() - t0) * 1000)
    avg_q3 = sum(runs_q3) / len(runs_q3)
    print(f"\nHypothetical 3rd Question: 'sentiment' (3 options):")
    print(f"  Runs: {[f'{r:.1f}ms' for r in runs_q3]}")
    print(f"  Average Time: {avg_q3:.1f} ms")

    runs_3_combined = []
    for _ in range(3):
        t0 = time.perf_counter()
        _ = router.predict(text, three_questions)
        runs_3_combined.append((time.perf_counter() - t0) * 1000)
    avg_3_combined = sum(runs_3_combined) / len(runs_3_combined)

    print(f"\nAll 3 questions together in 1 predict() call (category + urgency + sentiment):")
    print(f"  Runs: {[f'{r:.1f}ms' for r in runs_3_combined]}")
    print(f"  Average 3-Question Combined Time: {avg_3_combined:.1f} ms")
    print("=" * 60)


if __name__ == "__main__":
    main()
