"""Llama Prompt Guard 2-86M classifier service for ML-based prompt injection detection.

This module provides the ML security classifier layer for TriageGuard. It evaluates
incoming text using Meta's Llama-Prompt-Guard-2-86M model (or a fast mock heuristic
in test mode) to categorize risk into three tiers:
1. High risk (score >= threshold_high) -> SECURITY_REVIEW quarantine
2. Ambiguous risk (threshold_mid <= score < threshold_high) -> HUMAN_QUEUE review
3. Clean risk (score < threshold_mid) -> Proceed to Laya routing
Adheres to strict fail-closed invariants on error or timeout.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from dataclasses import dataclass
from typing import List, Optional, Tuple, TypedDict

# Configure HF cache to repository models directory if not already set
if not os.environ.get("HF_HOME"):
    _repo_models_dir = Path(__file__).resolve().parents[3] / "models" / "huggingface"
    _repo_models_dir.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(_repo_models_dir)

# Sync HF token from user cache if present
_user_token_file = Path.home() / ".cache" / "huggingface" / "token"
_hf_home_token_file = Path(os.environ["HF_HOME"]) / "token"
if _user_token_file.exists() and not _hf_home_token_file.exists():
    try:
        _hf_home_token_file.write_text(_user_token_file.read_text())
    except Exception:
        pass
if _hf_home_token_file.exists() and not os.environ.get("HF_TOKEN"):
    try:
        os.environ["HF_TOKEN"] = _hf_home_token_file.read_text().strip()
    except Exception:
        pass

logger = logging.getLogger(__name__)

# Definite injection keywords for mock heuristic (Tier 1: High)
MOCK_INJECTION_KEYWORDS = [
    "ignore all previous instructions",
    "ignore previous instructions",
    "disregard previous instructions",
    "reveal admin",
    "admin token",
    "system prompt",
    "developer mode",
    "jailbreak",
    "override rules",
    "bypass security",
    "exfiltrate",
    "you are now DAN",
    "disable the safety guardrail",
    "disable safety guardrail",
    "disable guardrail",
    "disable guardrails",
    "bypass guardrail",
    "bypass guardrails",
    "turn off guardrail",
    "safety guardrail",
    "penetration testing exercise",
    "authorized penetration testing",
    "secops",
    "for this conversation only",
    "administrator override",
    "admin override",
    "system administrator override",
    "override code",
    "override confirmed",
    "confirm this override",
    "disabling filters",
    "disable filters",
    "disabling guardrails",
    "disabling safety",
]

# Ambiguous keywords for mock heuristic (Tier 2: Ambiguous middle zone)
MOCK_AMBIGUOUS_KEYWORDS = [
    "disregard",
    "override",
    "system instructions",
    "guidelines",
    "developer",
    "filter",
    "debug mode",
    "penetration testing",
]


class PromptGuardResult(TypedDict, total=False):
    passed: bool
    malicious_score: float
    benign_score: float
    threshold_high: float
    threshold_mid: float
    threshold: float
    classification: str  # "MALICIOUS" | "AMBIGUOUS" | "BENIGN"
    tier: str            # "SECURITY_REVIEW" | "HUMAN_QUEUE" | "CLEAN"
    violations: List[str]
    latency_ms: float
    error: Optional[str]
    detector_mode: str   # "model" | "mock" | "unavailable"
    detector_version: str
    chunk_count: int
    max_chunk_index: int


FAIL_CLOSED_GUARD_RESULT: PromptGuardResult = {
    "passed": False,
    "malicious_score": 1.0,
    "benign_score": 0.0,
    "threshold_high": 0.80,
    "threshold_mid": 0.40,
    "threshold": 0.80,
    "classification": "MALICIOUS",
    "tier": "SECURITY_REVIEW",
    "violations": ["PROMPT_GUARD_FAIL_CLOSED: classifier error or timeout"],
    "latency_ms": 0.0,
    "error": "Fail-closed fallback",
    "detector_mode": "unavailable",
    "detector_version": "unknown",
    "chunk_count": 0,
    "max_chunk_index": 0,
}


@dataclass
class PromptGuardConfig:
    model_name: str = "meta-llama/Llama-Prompt-Guard-2-86M"
    revision: str = "main"
    threshold_high: float = 0.80
    threshold_mid: float = 0.40
    threshold: float = 0.80  # Backwards compatibility alias
    timeout_s: float = 30.0
    device: Optional[str] = None
    max_length: int = 512
    overlap_tokens: int = 64
    max_windows: int = 32
    mock_mode: bool = False
    cache_dir: Optional[str] = None

    def __post_init__(self) -> None:
        if self.threshold != 0.80 and self.threshold_high == 0.80:
            self.threshold_high = self.threshold


class PromptGuardService:
    """Service adapter for Llama Prompt Guard 2-86M binary sequence classifier."""

    def __init__(
        self,
        config: Optional[PromptGuardConfig] = None,
        mock_mode: bool = False,
        preload: bool = False,
    ) -> None:
        self.config = config or PromptGuardConfig()

        app_env = os.environ.get("APP_ENV", "").strip().lower()
        mock_env = os.environ.get("PROMPT_GUARD_MOCK", "").strip().lower() in ("true", "1")
        mock_requested = bool(mock_mode or getattr(self.config, "mock_mode", False) or mock_env)

        if app_env == "prod" and mock_requested:
            raise ValueError("Prompt Guard mock mode is not allowed in production (APP_ENV='prod').")

        if mock_requested:
            if not mock_env:
                raise ValueError(
                    "Prompt Guard mock mode is only allowed when PROMPT_GUARD_MOCK=true and APP_ENV is not 'prod'."
                )
            self.mock_mode = True
            self.config.mock_mode = True
        else:
            self.mock_mode = False
            self.config.mock_mode = False

        self._tokenizer = None
        self._model = None
        self._device = None
        self._load_error: Optional[str] = None
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="prompt-guard")

        # Resolve initial revision from local model snapshot if available
        self._resolve_revision()

        if preload and not self.mock_mode:
            self.warmup()

    def _resolve_revision(self) -> None:
        """Resolve revision/snapshot SHA from local Hugging Face repo if available."""
        try:
            repo_root = Path(__file__).resolve().parents[3]
            hub_dir_name = f"models--{self.config.model_name.replace('/', '--')}"
            model_hub_dir = (
                repo_root
                / "models"
                / "huggingface"
                / "hub"
                / hub_dir_name
            )
            refs_main = model_hub_dir / "refs" / "main"
            if refs_main.exists():
                self.config.revision = refs_main.read_text().strip()
                return

            snapshots_dir = model_hub_dir / "snapshots"
            if snapshots_dir.exists():
                snapshots = [s for s in snapshots_dir.iterdir() if s.is_dir()]
                if snapshots:
                    self.config.revision = snapshots[0].name
        except Exception:
            pass

    @property
    def mode(self) -> str:
        """Return detector mode: 'model' | 'mock' | 'unavailable'."""
        if self.mock_mode:
            return "mock"
        if self.is_ready():
            return "model"
        return "unavailable"

    @property
    def device(self) -> str:
        """Return running device (e.g. 'cuda' or 'cpu')."""
        if self._device:
            return str(self._device)
        if self.config.device:
            return str(self.config.device)
        try:
            import torch
            return "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            return "cpu"

    @property
    def model_id(self) -> str:
        """Return model identifier."""
        return self.config.model_name

    @property
    def revision(self) -> str:
        """Return model revision or commit hash."""
        return getattr(self.config, "revision", "main")

    @property
    def version(self) -> str:
        """Return detector version description."""
        if self.mock_mode:
            return "mock-heuristic"
        return f"{self.config.model_name}@{self.revision}"

    def is_ready(self) -> bool:
        """Check if model and tokenizer are primed and ready for immediate inference."""
        if self.mock_mode:
            return True
        return (
            self._model is not None
            and self._tokenizer is not None
            and self._load_error is None
        )

    def warmup(self) -> bool:
        """Pre-load tokenizer and model onto target device and run a probe inference.

        Ensures weights and tokenizers are completely downloaded, cached locally,
        and primed in memory so incoming user requests face zero cold-start delay.
        """
        if self.mock_mode:
            return True

        logger.info(
            f"Pre-warming PromptGuardService: loading '{self.config.model_name}'..."
        )
        self._ensure_model()
        if not self.is_ready():
            logger.warning(
                f"PromptGuardService warmup failed: model not ready ({self._load_error})"
            )
            return False

        try:
            # Dry-run inference pass to compile and warm PyTorch execution graph
            self._model_predict("Warmup probe for Llama Prompt Guard")
            logger.info("PromptGuardService warmed up and ready for inference.")
            return True
        except Exception as exc:
            logger.warning(f"PromptGuardService warmup probe failed: {exc}")
            self._load_error = str(exc)
            return False

    def _ensure_model(self) -> None:
        """Thread-safely load tokenizer and model onto GPU (or CPU) if not in mock mode."""
        if self.mock_mode:
            return
        if self.is_ready():
            return

        with self._lock:
            if self.is_ready():
                return

            try:
                import torch
                from transformers import AutoModelForSequenceClassification, AutoTokenizer

                # Resolve device: prioritize config, then CUDA if available, else CPU
                if self.config.device:
                    self._device = self.config.device
                else:
                    self._device = "cuda" if torch.cuda.is_available() else "cpu"

                # Check if local model snapshot already exists in the repo models directory
                repo_root = Path(__file__).resolve().parents[3]
                hub_dir_name = f"models--{self.config.model_name.replace('/', '--')}"
                local_snapshot_dir = (
                    repo_root
                    / "models"
                    / "huggingface"
                    / "hub"
                    / hub_dir_name
                    / "snapshots"
                )
                model_source = self.config.model_name
                if local_snapshot_dir.exists():
                    snapshots = [
                        s
                        for s in local_snapshot_dir.iterdir()
                        if s.is_dir() and (s / "model.safetensors").exists()
                    ]
                    if snapshots:
                        model_source = str(snapshots[0])
                        self.config.revision = snapshots[0].name

                logger.info(
                    f"Loading Prompt Guard model from '{model_source}' on device '{self._device}'..."
                )
                self._tokenizer = AutoTokenizer.from_pretrained(model_source)
                self._model = AutoModelForSequenceClassification.from_pretrained(model_source)
                self._model.to(self._device)
                self._model.eval()
                self._load_error = None
                logger.info("Prompt Guard model successfully loaded.")
            except Exception as exc:
                logger.error(
                    f"Could not load Prompt Guard model '{self.config.model_name}': {exc}. Service is NOT ready."
                )
                self._model = None
                self._tokenizer = None
                self._load_error = str(exc)
                # Fail-closed invariant: DO NOT fall back to mock mode!

    def _split_into_windows(self, text: str) -> Tuple[List[List[int]], int, bool]:
        """Tokenize text without truncation and split into overlapping windows."""
        # Account for special tokens: [CLS] and [SEP]
        num_special_tokens = 2
        max_content_tokens = max(1, self.config.max_length - num_special_tokens)
        overlap = min(self.config.overlap_tokens, max_content_tokens - 1)
        stride = max(1, max_content_tokens - overlap)

        raw_token_ids = self._tokenizer.encode(text, add_special_tokens=False)
        total_tokens = len(raw_token_ids)

        if total_tokens == 0:
            return [[]], 1, False

        chunks: List[List[int]] = []
        start = 0
        while start < total_tokens:
            end = min(start + max_content_tokens, total_tokens)
            chunks.append(raw_token_ids[start:end])
            if end >= total_tokens:
                break
            start += stride

        total_chunks = len(chunks)
        is_over_cap = total_chunks > self.config.max_windows
        capped_chunks = chunks[: self.config.max_windows] if is_over_cap else chunks
        return capped_chunks, total_chunks, is_over_cap

    def _mock_predict(self, text: str) -> Tuple[float, float, int, int, bool]:
        """Deterministic keyword-based heuristic fallback with windowing for mock/test environments."""
        words = text.split()
        if not words:
            return 0.05, 0.95, 1, 0, False

        max_words = 380
        overlap_words = 48
        stride = max(1, max_words - overlap_words)

        chunks: List[str] = []
        start = 0
        while start < len(words):
            end = min(start + max_words, len(words))
            chunks.append(" ".join(words[start:end]))
            if end >= len(words):
                break
            start += stride

        total_chunks = len(chunks)
        is_over_cap = total_chunks > self.config.max_windows
        capped_chunks = chunks[: self.config.max_windows] if is_over_cap else chunks

        chunk_scores: List[Tuple[float, float]] = []
        for chunk in capped_chunks:
            chunk_lower = chunk.lower()
            if any(kw in chunk_lower for kw in MOCK_INJECTION_KEYWORDS):
                chunk_scores.append((0.92, 0.08))
            elif any(kw in chunk_lower for kw in MOCK_AMBIGUOUS_KEYWORDS):
                chunk_scores.append((0.55, 0.45))
            else:
                chunk_scores.append((0.05, 0.95))

        import numpy as np
        malicious_scores = [s[0] for s in chunk_scores]
        max_idx = int(np.argmax(malicious_scores))
        max_malicious = float(malicious_scores[max_idx])
        benign_score = float(chunk_scores[max_idx][1])

        return max_malicious, benign_score, total_chunks, max_idx, is_over_cap

    def _model_predict(self, text: str) -> Tuple[float, float, int, int, bool]:
        """Run inference using the PyTorch Prompt Guard model across batched windowed chunks."""
        import torch
        import numpy as np

        self._ensure_model()
        if not self.is_ready():
            raise RuntimeError(
                f"Prompt Guard model unavailable: {self._load_error or 'model not loaded'}"
            )

        capped_chunks, total_chunks, is_over_cap = self._split_into_windows(text)

        cls_id = self._tokenizer.bos_token_id if self._tokenizer.bos_token_id is not None else (self._tokenizer.cls_token_id or 1)
        sep_id = self._tokenizer.eos_token_id if self._tokenizer.eos_token_id is not None else (self._tokenizer.sep_token_id or 2)
        pad_id = self._tokenizer.pad_token_id if self._tokenizer.pad_token_id is not None else 0

        batch_with_specials = [
            [cls_id] + chunk + [sep_id]
            for chunk in capped_chunks
        ]
        max_batch_len = max(len(b) for b in batch_with_specials)
        padded_inputs = [b + [pad_id] * (max_batch_len - len(b)) for b in batch_with_specials]
        attn_masks = [[1] * len(b) + [0] * (max_batch_len - len(b)) for b in batch_with_specials]

        t_inputs = torch.tensor(padded_inputs, dtype=torch.long, device=self._device)
        t_mask = torch.tensor(attn_masks, dtype=torch.long, device=self._device)

        with torch.no_grad():
            outputs = self._model(input_ids=t_inputs, attention_mask=t_mask)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)

        # In Llama-Prompt-Guard-2-86M:
        # LABEL_0 = BENIGN, LABEL_1 = MALICIOUS
        if probs.shape[-1] >= 2:
            malicious_scores = probs[:, 1].tolist()
            benign_scores = probs[:, 0].tolist()
        elif probs.shape[-1] == 1:
            malicious_scores = probs[:, 0].tolist()
            benign_scores = (1.0 - probs[:, 0]).tolist()
        else:
            malicious_scores = [0.0] * len(capped_chunks)
            benign_scores = [1.0] * len(capped_chunks)

        # malicious_score = max over windows
        max_idx = int(np.argmax(malicious_scores))
        max_malicious_score = float(malicious_scores[max_idx])
        corresponding_benign_score = float(benign_scores[max_idx])

        return max_malicious_score, corresponding_benign_score, total_chunks, max_idx, is_over_cap

    def _raw_predict(self, text: str) -> Tuple[float, float, int, int, bool]:
        """Dispatch prediction to either mock heuristic or neural network."""
        if self.mock_mode:
            return self._mock_predict(text)
        return self._model_predict(text)

    def classify(self, text: str, timeout_s: Optional[float] = None) -> PromptGuardResult:
        """Evaluate text for prompt injection / jailbreak risk using the 3-tier policy across windows.

        Args:
            text: Sanitized input text to evaluate.
            timeout_s: Optional per-call timeout in seconds.

        Returns:
            PromptGuardResult containing classification, tier, scores, detector metadata, and chunk metadata.
            Fails closed on timeout or internal errors.
        """
        if not text or not text.strip():
            return {
                "passed": True,
                "malicious_score": 0.0,
                "benign_score": 1.0,
                "threshold_high": self.config.threshold_high,
                "threshold_mid": self.config.threshold_mid,
                "threshold": self.config.threshold_high,
                "classification": "BENIGN",
                "tier": "CLEAN",
                "violations": [],
                "latency_ms": 0.0,
                "error": None,
                "detector_mode": self.mode,
                "detector_version": self.version,
                "chunk_count": 0,
                "max_chunk_index": 0,
            }

        effective_timeout = timeout_s if timeout_s is not None else self.config.timeout_s
        start_perf = time.perf_counter()

        try:
            future = self._executor.submit(self._raw_predict, text)
            raw_res = future.result(timeout=effective_timeout)
            if len(raw_res) == 2:
                malicious_score, benign_score = raw_res
                chunk_count, max_chunk_index, is_over_cap = 1, 0, False
            else:
                malicious_score, benign_score, chunk_count, max_chunk_index, is_over_cap = raw_res
            latency_ms = round((time.perf_counter() - start_perf) * 1000, 3)

            violations: List[str] = []
            if is_over_cap:
                violations.append(
                    f"LONG_INPUT_PARTIAL_SCAN: input produced {chunk_count} windows, exceeding max scan cap of {self.config.max_windows}"
                )

            if malicious_score >= self.config.threshold_high:
                classification = "MALICIOUS"
                tier = "SECURITY_REVIEW"
                passed = False
                violations.append(
                    f"PROMPT_GUARD_MALICIOUS: score {malicious_score:.4f} >= high threshold {self.config.threshold_high:.4f}"
                )
            elif is_over_cap:
                classification = "AMBIGUOUS"
                tier = "HUMAN_QUEUE"
                passed = False
            elif malicious_score >= self.config.threshold_mid:
                classification = "AMBIGUOUS"
                tier = "HUMAN_QUEUE"
                passed = False
                violations.append(
                    f"PROMPT_GUARD_AMBIGUOUS: score {malicious_score:.4f} in middle zone [{self.config.threshold_mid:.4f}, {self.config.threshold_high:.4f})"
                )
            else:
                classification = "BENIGN"
                tier = "CLEAN"
                passed = True

            return {
                "passed": passed,
                "malicious_score": round(malicious_score, 4),
                "benign_score": round(benign_score, 4),
                "threshold_high": self.config.threshold_high,
                "threshold_mid": self.config.threshold_mid,
                "threshold": self.config.threshold_high,
                "classification": classification,
                "tier": tier,
                "violations": violations,
                "latency_ms": latency_ms,
                "error": None,
                "detector_mode": self.mode,
                "detector_version": self.version,
                "chunk_count": chunk_count,
                "max_chunk_index": max_chunk_index,
            }

        except FuturesTimeoutError:
            latency_ms = round((time.perf_counter() - start_perf) * 1000, 3)
            logger.error(
                f"PromptGuardService timed out after {effective_timeout}s; failing closed."
            )
            fallback = dict(FAIL_CLOSED_GUARD_RESULT)
            fallback["latency_ms"] = latency_ms
            fallback["threshold_high"] = self.config.threshold_high
            fallback["threshold_mid"] = self.config.threshold_mid
            fallback["threshold"] = self.config.threshold_high
            fallback["error"] = f"Timeout after {effective_timeout}s"
            fallback["detector_mode"] = self.mode
            fallback["detector_version"] = self.version
            fallback["chunk_count"] = 0
            fallback["max_chunk_index"] = 0
            return fallback

        except Exception as exc:
            latency_ms = round((time.perf_counter() - start_perf) * 1000, 3)
            logger.error(f"PromptGuardService prediction failed: {exc}; failing closed.")
            fallback = dict(FAIL_CLOSED_GUARD_RESULT)
            fallback["latency_ms"] = latency_ms
            fallback["threshold_high"] = self.config.threshold_high
            fallback["threshold_mid"] = self.config.threshold_mid
            fallback["threshold"] = self.config.threshold_high
            fallback["error"] = str(exc)
            fallback["detector_mode"] = self.mode
            fallback["detector_version"] = self.version
            fallback["chunk_count"] = 0
            fallback["max_chunk_index"] = 0
            return fallback

    def close(self) -> None:
        """Shutdown thread executor."""
        self._executor.shutdown(wait=False)


_default_guard_service: Optional[PromptGuardService] = None


def reset_prompt_guard_service() -> None:
    """Reset the singleton instance (useful in tests)."""
    global _default_guard_service
    if _default_guard_service is not None:
        try:
            _default_guard_service.close()
        except Exception:
            pass
        _default_guard_service = None


def get_prompt_guard_service(
    mock_mode: bool = False,
    threshold_high: float = 0.80,
    threshold_mid: float = 0.40,
    preload: bool = False,
) -> PromptGuardService:
    """Get or initialize the singleton PromptGuardService instance."""
    global _default_guard_service

    mock_env = os.environ.get("PROMPT_GUARD_MOCK", "").strip().lower() in ("true", "1")
    target_mock = bool(mock_mode or mock_env)

    if (
        _default_guard_service is None
        or _default_guard_service.mock_mode != target_mock
        or _default_guard_service.config.threshold_high != threshold_high
        or _default_guard_service.config.threshold_mid != threshold_mid
    ):
        config = PromptGuardConfig(
            threshold_high=threshold_high,
            threshold_mid=threshold_mid,
            mock_mode=target_mock,
        )
        _default_guard_service = PromptGuardService(
            config=config,
            mock_mode=target_mock,
            preload=preload,
        )
    elif preload and not _default_guard_service.is_ready():
        _default_guard_service.warmup()
    return _default_guard_service


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    logger.info("Explicitly downloading and pre-warming Llama Prompt Guard model...")
    service = get_prompt_guard_service(preload=True)
    res = service.classify("Warmup CLI test text")
    logger.info(f"Readiness check passed: {service.is_ready()}, mode: {service.mode}, classification: {res['classification']}")
