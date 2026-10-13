"""Deterministic Sanitizer Service for TriageGuard.

Provides zero-latency, rule-based, and deterministic sanitization:
1. Disarming / Defanging active URLs and indicators
2. Redacting sensitive PII (Emails, Phone numbers, SSNs, Credit Cards, Secrets/API Keys, IPs)
3. Deterministic scanning for Prompt Injections, Jailbreaks, and Delimiter attacks
4. Normalizing Unicode and detecting hidden zero-width evasion characters
"""

from __future__ import annotations

import re
import unicodedata
from enum import Enum
from typing import List, Optional, Pattern, Tuple
from pydantic import BaseModel, Field


class RiskSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InjectionRuleCategory(str, Enum):
    INSTRUCTION_OVERRIDE = "instruction_override"
    JAILBREAK_ROLEPLAY = "jailbreak_roleplay"
    DELIMITER_INJECTION = "delimiter_injection"
    PROMPT_EXFILTRATION = "prompt_exfiltration"
    CODE_EXPLOIT = "code_exploit"
    OBFUSCATION_EVASION = "obfuscation_evasion"


class InjectionFinding(BaseModel):
    """Details of a matched prompt injection rule."""
    rule_id: str
    category: InjectionRuleCategory
    severity: RiskSeverity
    matched_text: str
    description: str


class SanitizerConfig(BaseModel):
    """Configuration options for the sanitizer."""
    defang_urls: bool = True
    defang_ips: bool = True
    redact_emails: bool = True
    redact_phones: bool = True
    redact_credit_cards: bool = True
    redact_ssn: bool = True
    redact_secrets: bool = True
    redact_ips: bool = False  # If false and defang_ips is true, IPs are defanged instead of redacted
    scan_prompt_injections: bool = True
    strip_zero_width_chars: bool = True
    max_text_length: int = 50_000
    hard_stop_severities: List[RiskSeverity] = Field(
        default_factory=lambda: [RiskSeverity.HIGH, RiskSeverity.CRITICAL]
    )


class SanitizationResult(BaseModel):
    """Structured result from running the deterministic sanitizer."""
    clean_text: str
    raw_text_length: int
    defanged_urls_count: int = 0
    redacted_pii_count: int = 0
    risk_flags: List[str] = Field(default_factory=list)
    injection_findings: List[InjectionFinding] = Field(default_factory=list)
    is_hard_stop: bool = False


# =====================================================================
# Compiled Regular Expressions for PII Detection & URL Defanging
# =====================================================================

# Zero-width / invisible Unicode characters often used in adversarial prompt injection
ZERO_WIDTH_CHARS_PATTERN: Pattern[str] = re.compile(
    r"[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060-\u2064\u00AD]"
)

# Email address pattern (RFC 5322 compliant subset)
EMAIL_PATTERN: Pattern[str] = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
)

# Phone number patterns (US, UK, International E.164, extensions)
PHONE_PATTERN: Pattern[str] = re.compile(
    r"(?:(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
    r"|(?:\+\d{1,3}[-.\s]?)?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})\b"
)

# US Social Security Number (SSN) pattern: AAA-GG-SSSS or AAAGGSSSS
SSN_PATTERN: Pattern[str] = re.compile(
    r"\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b"
)

# Potential 13-19 digit Credit/Debit Card pattern (checked with Luhn validation)
CREDIT_CARD_CANDIDATE_PATTERN: Pattern[str] = re.compile(
    r"\b(?:\d[ -]*?){13,19}\b"
)

# Common API Keys & Secrets
SECRET_PATTERNS: List[Tuple[str, Pattern[str]]] = [
    ("AWS_KEY", re.compile(r"\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b")),
    ("GITHUB_TOKEN", re.compile(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b")),
    ("JWT_TOKEN", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b")),
    ("BEARER_TOKEN", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9_\-\.]{20,}\b")),
    ("PRIVATE_KEY", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----")),
    ("GENERIC_API_KEY", re.compile(r"(?i)(?:api[_-]?key|secret[_-]?key|auth[_-]?token|access[_-]?token)\s*[:=]\s*['\"]?([A-Za-z0-9\-_]{16,128})['\"]?")),
]

# IPv4 & IPv6 patterns
IPV4_PATTERN: Pattern[str] = re.compile(
    r"\b(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}\b"
)
IPV6_PATTERN: Pattern[str] = re.compile(
    r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b"
)

# URL Pattern (covers http, https, ftp, ftps)
URL_PATTERN: Pattern[str] = re.compile(
    r"(?i)\b((?:https?|ftps?)://[^\s<>'\"`]+)"
)


# =====================================================================
# Prompt Injection Heuristic Rules (Deterministic & Pattern-Based)
# =====================================================================

INJECTION_RULES: List[Tuple[str, InjectionRuleCategory, RiskSeverity, Pattern[str], str]] = [
    # 1. Direct Instruction Overrides
    (
        "RULE_INJ_IGNORE_PREV",
        InjectionRuleCategory.INSTRUCTION_OVERRIDE,
        RiskSeverity.CRITICAL,
        re.compile(r"(?i)\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|former)\s+(?:instructions|rules|prompts|directives|commands)\b"),
        "Attempt to override previous instructions or system prompts"
    ),
    (
        "RULE_INJ_NEW_INSTRUCTIONS",
        InjectionRuleCategory.INSTRUCTION_OVERRIDE,
        RiskSeverity.HIGH,
        re.compile(r"(?i)\b(?:from\s+now\s+on|starting\s+now|new\s+instructions?|system\s+directive|updated\s+guidelines?)\s*:\s*"),
        "Attempt to inject new operating instructions"
    ),
    (
        "RULE_INJ_SYSTEM_PROMPT_OVERRIDE",
        InjectionRuleCategory.INSTRUCTION_OVERRIDE,
        RiskSeverity.CRITICAL,
        re.compile(r"(?i)\b(?:you\s+are\s+now|you\s+must\s+now\s+act\s+as|pretend\s+you\s+are|roleplay\s+as)\s+(?:an?\s+unrestricted|a\s+different|a\s+new|an?\s+evil)\b"),
        "Attempt to override AI identity or constraints"
    ),
    (
        "RULE_INJ_DISABLE_GUARDRAILS",
        InjectionRuleCategory.INSTRUCTION_OVERRIDE,
        RiskSeverity.CRITICAL,
        re.compile(
            r"(?i)\b(?:disabl(?:e|ing|ed)|turn(?:ing)?\s+off|deactivat(?:e|ing|ed)|bypass(?:ing)?|suspend(?:ing)?|overrid(?:e|ing)|remov(?:e|ing|ed)|lift(?:ing)?|dropp(?:ing)?|suppress(?:ing)?|shut(?:ting)?\s+down)\s+"
            r"(?:the\s+|all\s+|any\s+|these\s+|your\s+)?"
            r"(?:(?:safety|security|content|ethical|system|internal|model|ai)\s+)?"
            r"(?:guardrails?|guards?|filters?|protocols?|restrictions?|guidelines?|policies|checks?|safeguards?|protections?|barriers?|constraints?)\b"
        ),
        "Attempt to disable or bypass safety guardrails or security controls"
    ),
    (
        "RULE_INJ_ADMIN_OVERRIDE_CODE",
        InjectionRuleCategory.INSTRUCTION_OVERRIDE,
        RiskSeverity.CRITICAL,
        re.compile(
            r"(?i)\b(?:"
            r"(?:system\s+)?(?:admin(?:istrator)?|root|superuser|operator|master|emergency|security)\s+(?:override|bypass|directive|command|authorization)(?:\s+code)?|"
            r"(?:override|authorization|bypass)\s+code(?:\s*[:=]|\s+[\w\-]+)|"
            r"(?:confirm|accept)\s+(?:this\s+)?override|"
            r"override\s+confirmed"
            r")\b"
        ),
        "Attempt to invoke administrative override codes, tokens, or confirmation commands"
    ),
    (
        "RULE_INJ_TEMPORARY_SCOPE_OVERRIDE",
        InjectionRuleCategory.INSTRUCTION_OVERRIDE,
        RiskSeverity.HIGH,
        re.compile(
            r"(?i)\b(?:disabl(?:e|ing|ed)|bypass(?:ing)?|overrid(?:e|ing)|ignore|disregard|suspend(?:ing)?|deactivat(?:e|ing|ed)|lift(?:ing)?)\s+"
            r"[^\n.!?]{0,50}?\s*"
            r"(?:for\s+this\s+(?:conversation|session|prompt|interaction|request|ticket|chat|turn)(?:\s+only)?|"
            r"just\s+(?:for\s+)?(?:this\s+once|now|today|this\s+turn|this\s+prompt)|temporarily)\b"
        ),
        "Attempt to temporarily suspend guardrails or instructions for a single session"
    ),
    (
        "RULE_INJ_AUTHORITY_SPOOF_OVERRIDE",
        InjectionRuleCategory.INSTRUCTION_OVERRIDE,
        RiskSeverity.CRITICAL,
        re.compile(
            r"(?i)\b(?:(?:internal|authorized|official|mandated|sanctioned)\s+(?:penetration\s+test(?:ing)?|pentest|security\s+(?:audit|test(?:ing)?|exercise|assessment|eval(?:uation)?)|red\s*team(?:ing)?(?:\s+exercise)?)|"
            r"(?:by|per|from)\s+(?:order\s+of\s+|authorization\s+from\s+)?(?:secops|infosec|security\s+operations|ciso|admin(?:istrator)?)|"
            r"(?:secops|infosec)\s+(?:authorization|authorized|directive|override|exercise|clearance))\b"
        ),
        "Attempt to bypass instructions using security pretexting or authority spoofing"
    ),
    (
        "RULE_INJ_DO_NOT_OBEY",
        InjectionRuleCategory.INSTRUCTION_OVERRIDE,
        RiskSeverity.HIGH,
        re.compile(
            r"(?i)\b(?:do\s+not\s+(?:obey|follow|apply|enforce)|stop\s+(?:following|applying|enforcing)|drop\s+all)\s+"
            r"(?:any\s+|all\s+|previous\s+|prior\s+)?(?:instructions|rules|constraints|filters|guardrails|policies|directives)\b"
        ),
        "Direct command to stop enforcing or obeying system constraints"
    ),

    # 2. Jailbreak / Persona Manipulation
    (
        "RULE_JAILBREAK_DAN",
        InjectionRuleCategory.JAILBREAK_ROLEPLAY,
        RiskSeverity.CRITICAL,
        re.compile(r"(?i)\b(?:DAN\s+mode|do\s+anything\s+now|developer\s+mode\s+enabled|unfiltered\s+mode|jailbroken|godmode)\b"),
        "Well-known jailbreak persona pattern (DAN/Developer mode)"
    ),
    (
        "RULE_JAILBREAK_SAFETY_BYPASS",
        InjectionRuleCategory.JAILBREAK_ROLEPLAY,
        RiskSeverity.HIGH,
        re.compile(r"(?i)\b(?:disabl(?:e|ing|ed)|turn(?:ing)?\s+off|bypass(?:ing)?|suspend(?:ing)?|deactivat(?:e|ing|ed)|lift(?:ing)?|remov(?:e|ing|ed)|dropp(?:ing)?)\s+(?:the\s+|all\s+|any\s+)?(?:(?:safety|content|security|ethical)\s+)?(?:filters|protocols|guidelines|restrictions|guardrails?|checks?|safeguards?|policies)\b"),
        "Attempt to disable safety filters, guardrails, or guidelines"
    ),

    # 3. Delimiter & Boundary Injections
    (
        "RULE_DELIM_XML_SYSTEM",
        InjectionRuleCategory.DELIMITER_INJECTION,
        RiskSeverity.HIGH,
        re.compile(r"(?i)<\/?(?:system|instruction|admin|developer|assistant|human|context)>"),
        "Injection of fake system/role boundary tags"
    ),
    (
        "RULE_DELIM_MARKDOWN_SYSTEM",
        InjectionRuleCategory.DELIMITER_INJECTION,
        RiskSeverity.HIGH,
        re.compile(r"(?i)(?:```|~~~)\s*(?:system|prompt|instruction)[\s\S]*?(?:```|~~~)"),
        "Markdown code block disguised as system prompt instruction"
    ),
    (
        "RULE_DELIM_HEADER_SPOOF",
        InjectionRuleCategory.DELIMITER_INJECTION,
        RiskSeverity.MEDIUM,
        re.compile(r"(?i)\n\s*#{1,3}\s*(?:system|admin|developer|guardrail)\s*:\s*"),
        "Markdown heading spoofing system instruction section"
    ),

    # 4. Prompt Exfiltration / Leakage
    (
        "RULE_EXFIL_SYSTEM_PROMPT",
        InjectionRuleCategory.PROMPT_EXFILTRATION,
        RiskSeverity.HIGH,
        re.compile(r"(?i)\b(?:repeat|print|reveal|output|display|show|dump|leak)\s+(?:the\s+)?(?:system\s+prompt|initial\s+instructions|system\s+instructions|hidden\s+prompt|prompt\s+above)\b"),
        "Attempt to exfiltrate system instructions or initial prompt"
    ),
    (
        "RULE_EXFIL_EVERYTHING_ABOVE",
        InjectionRuleCategory.PROMPT_EXFILTRATION,
        RiskSeverity.MEDIUM,
        re.compile(r"(?i)\b(?:print|repeat|output|show)\s+(?:everything|all\s+text)\s+(?:above|before\s+this)\b"),
        "Attempt to dump conversation or system context"
    ),

    # 5. Dangerous Code Execution / Shell Exploits
    (
        "RULE_CODE_EVAL_EXEC",
        InjectionRuleCategory.CODE_EXPLOIT,
        RiskSeverity.HIGH,
        re.compile(r"(?i)\b(?:__import__|eval\s*\(|exec\s*\(|os\.system|subprocess\.Popen|require\s*\(['\"]child_process['\"]\))\b"),
        "Dangerous code execution or shell invocation markers"
    ),
    (
        "RULE_CODE_JNDI_INJECTION",
        InjectionRuleCategory.CODE_EXPLOIT,
        RiskSeverity.CRITICAL,
        re.compile(r"(?i)\$\{(?:jndi|base64|lower|upper):"),
        "JNDI/Template string injection pattern"
    ),
]


# =====================================================================
# Helper Utilities
# =====================================================================

def is_luhn_valid(card_number_str: str) -> bool:
    """Validates a candidate card number using the Luhn checksum algorithm."""
    digits = [int(c) for c in card_number_str if c.isdigit()]
    if not (13 <= len(digits) <= 19):
        return False
    
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += (doubled - 9) if doubled > 9 else doubled
        else:
            checksum += d
            
    return checksum % 10 == 0


def defang_url_string(url: str) -> str:
    """Defang a single URL string into an inactive format.
    
    Example:
        http://example.com/path -> hxxp://example[.]com/path
        https://sub.domain.org -> hxxps://sub[.]domain[.]org
        ftp://files.org -> fxp://files[.]org
    """
    defanged = url
    # Neutralize scheme
    defanged = re.sub(r"^http://", "hxxp://", defanged, flags=re.IGNORECASE)
    defanged = re.sub(r"^https://", "hxxps://", defanged, flags=re.IGNORECASE)
    defanged = re.sub(r"^ftp://", "fxp://", defanged, flags=re.IGNORECASE)
    defanged = re.sub(r"^ftps://", "fxps://", defanged, flags=re.IGNORECASE)
    
    # Split scheme from remainder to safely defang domain dots without defanging query params excessively
    match = re.match(r"^([a-z0-9]+://)([^/\?#]+)(.*)$", defanged, flags=re.IGNORECASE)
    if match:
        scheme, host, path_and_query = match.groups()
        host_defanged = host.replace(".", "[.]")
        return f"{scheme}{host_defanged}{path_and_query}"
    
    return defanged.replace(".", "[.]")


def defang_ipv4_string(ip: str) -> str:
    """Defang an IPv4 address string (e.g. 192.168.1.1 -> 192[.]168[.]1[.]1)."""
    return ip.replace(".", "[.]")


# =====================================================================
# Main Sanitizer Class
# =====================================================================

class DeterministicSanitizer:
    """Deterministic, zero-latency text sanitizer for customer support tickets."""

    def __init__(self, config: Optional[SanitizerConfig] = None) -> None:
        self.config = config or SanitizerConfig()

    def sanitize(self, text: str) -> SanitizationResult:
        """Runs full sanitization pipeline on the provided raw untrusted text."""
        if not text:
            return SanitizationResult(
                clean_text="",
                raw_text_length=0,
                defanged_urls_count=0,
                redacted_pii_count=0,
                risk_flags=[],
                injection_findings=[],
                is_hard_stop=False,
            )

        raw_length = len(text)
        risk_flags: List[str] = []
        injection_findings: List[InjectionFinding] = []
        redacted_pii_count = 0
        defanged_urls_count = 0

        # Step 1: Text truncation if exceeding max size to protect downstream components
        processed_text = text
        if raw_length > self.config.max_text_length:
            processed_text = processed_text[: self.config.max_text_length]
            risk_flags.append("INPUT_TRUNCATED_MAX_LENGTH")

        # Step 2: Unicode normalization (NFKC) to resolve homoglyphs and compatibility chars
        normalized_text = unicodedata.normalize("NFKC", processed_text)

        # Step 3: Check for zero-width / hidden characters
        if ZERO_WIDTH_CHARS_PATTERN.search(normalized_text):
            risk_flags.append("ZERO_WIDTH_CHARS_DETECTED")
            if self.config.strip_zero_width_chars:
                normalized_text = ZERO_WIDTH_CHARS_PATTERN.sub("", normalized_text)

        current_text = normalized_text

        # Step 4: Deterministic Prompt Injection Scan
        if self.config.scan_prompt_injections:
            findings = self._scan_injections(current_text)
            if findings:
                injection_findings.extend(findings)
                for finding in findings:
                    flag = f"PROMPT_INJECTION_{finding.category.name}_{finding.severity.name}"
                    if flag not in risk_flags:
                        risk_flags.append(flag)

        # Step 5: Redact PII
        current_text, pii_count = self._redact_pii(current_text)
        redacted_pii_count += pii_count

        # Step 6: Defang URLs and IPs
        if self.config.defang_urls or self.config.defang_ips:
            current_text, url_count = self._defang_urls_and_ips(current_text)
            defanged_urls_count += url_count

        # Step 7: Evaluate Fail-Closed Hard Stop condition
        is_hard_stop = any(
            finding.severity in self.config.hard_stop_severities
            for finding in injection_findings
        )

        return SanitizationResult(
            clean_text=current_text,
            raw_text_length=raw_length,
            defanged_urls_count=defanged_urls_count,
            redacted_pii_count=redacted_pii_count,
            risk_flags=risk_flags,
            injection_findings=injection_findings,
            is_hard_stop=is_hard_stop,
        )

    def _scan_injections(self, text: str) -> List[InjectionFinding]:
        """Scans text against compiled deterministic injection rules."""
        findings: List[InjectionFinding] = []
        for rule_id, category, severity, pattern, description in INJECTION_RULES:
            match = pattern.search(text)
            if match:
                matched_snippet = match.group(0)[:80]
                findings.append(
                    InjectionFinding(
                        rule_id=rule_id,
                        category=category,
                        severity=severity,
                        matched_text=matched_snippet,
                        description=description,
                    )
                )
        return findings

    def _redact_pii(self, text: str) -> Tuple[str, int]:
        """Redacts configured PII entities from text."""
        redacted_count = 0
        working_text = text

        # 1. API Keys and Secrets (processed before generic patterns)
        if self.config.redact_secrets:
            for secret_name, pattern in SECRET_PATTERNS:
                def replace_secret(m: re.Match[str]) -> str:
                    nonlocal redacted_count
                    redacted_count += 1
                    return "[SECRET_REDACTED]"
                working_text = pattern.sub(replace_secret, working_text)

        # 2. Email Addresses
        if self.config.redact_emails:
            def replace_email(m: re.Match[str]) -> str:
                nonlocal redacted_count
                redacted_count += 1
                return "[EMAIL_REDACTED]"
            working_text = EMAIL_PATTERN.sub(replace_email, working_text)

        # 3. Social Security Numbers
        if self.config.redact_ssn:
            def replace_ssn(m: re.Match[str]) -> str:
                nonlocal redacted_count
                redacted_count += 1
                return "[SSN_REDACTED]"
            working_text = SSN_PATTERN.sub(replace_ssn, working_text)

        # 4. Credit Card Numbers (verified by Luhn algorithm)
        if self.config.redact_credit_cards:
            def replace_card(m: re.Match[str]) -> str:
                nonlocal redacted_count
                raw_candidate = m.group(0)
                if is_luhn_valid(raw_candidate):
                    redacted_count += 1
                    return "[CREDIT_CARD_REDACTED]"
                return raw_candidate
            working_text = CREDIT_CARD_CANDIDATE_PATTERN.sub(replace_card, working_text)

        # 5. Phone Numbers
        if self.config.redact_phones:
            def replace_phone(m: re.Match[str]) -> str:
                nonlocal redacted_count
                # Avoid redacting already placed redaction tokens or short digits
                raw_match = m.group(0)
                digits_only = re.sub(r"\D", "", raw_match)
                if len(digits_only) >= 7:
                    redacted_count += 1
                    return "[PHONE_REDACTED]"
                return raw_match
            working_text = PHONE_PATTERN.sub(replace_phone, working_text)

        # 6. IP Addresses (if configured to redact instead of defang)
        if self.config.redact_ips:
            def replace_ipv4(m: re.Match[str]) -> str:
                nonlocal redacted_count
                redacted_count += 1
                return "[IP_REDACTED]"
            working_text = IPV4_PATTERN.sub(replace_ipv4, working_text)
            working_text = IPV6_PATTERN.sub(replace_ipv4, working_text)

        return working_text, redacted_count

    def _defang_urls_and_ips(self, text: str) -> Tuple[str, int]:
        """Disarms active URLs and standalone IP addresses."""
        defanged_count = 0
        working_text = text

        if self.config.defang_urls:
            def replace_url(m: re.Match[str]) -> str:
                nonlocal defanged_count
                defanged_count += 1
                return defang_url_string(m.group(0))
            working_text = URL_PATTERN.sub(replace_url, working_text)

        if self.config.defang_ips and not self.config.redact_ips:
            def replace_ip(m: re.Match[str]) -> str:
                nonlocal defanged_count
                defanged_count += 1
                return defang_ipv4_string(m.group(0))
            working_text = IPV4_PATTERN.sub(replace_ip, working_text)

        return working_text, defanged_count


# =====================================================================
# Global Convenience Functions
# =====================================================================

_default_sanitizer = DeterministicSanitizer()


def sanitize_text(text: str, config: Optional[SanitizerConfig] = None) -> SanitizationResult:
    """Convenience function to sanitize text using default or custom SanitizerConfig."""
    if config is None:
        return _default_sanitizer.sanitize(text)
    return DeterministicSanitizer(config).sanitize(text)
