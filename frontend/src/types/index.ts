export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type InjectionRuleCategory =
  | 'instruction_override'
  | 'jailbreak_roleplay'
  | 'delimiter_injection'
  | 'prompt_exfiltration'
  | 'code_exploit'
  | 'obfuscation_evasion';

export interface InjectionFinding {
  rule_id: string;
  category: InjectionRuleCategory;
  severity: RiskSeverity;
  matched_text: string;
  description: string;
}

export interface SanitizerConfig {
  defang_urls?: boolean;
  defang_ips?: boolean;
  redact_emails?: boolean;
  redact_phones?: boolean;
  redact_credit_cards?: boolean;
  redact_ssn?: boolean;
  redact_secrets?: boolean;
  redact_ips?: boolean;
  scan_prompt_injections?: boolean;
  strip_zero_width_chars?: boolean;
  max_text_length?: number;
}

export interface SanitizationResult {
  clean_text: string;
  raw_text_length: number;
  defanged_urls_count: number;
  redacted_pii_count: number;
  risk_flags: string[];
  injection_findings: InjectionFinding[];
  is_hard_stop: boolean;
}

export interface SanitizeResponse {
  customer_id: string;
  timestamp: string;
  processing_time_ms: number;
  result: SanitizationResult;
}

export interface ApiRoute {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  status: 'active' | 'planned';
  description: string;
  tag: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  routeId: string;
  customerId: string;
  inputText: string;
  status: 'success' | 'error';
  latencyMs?: number;
  responsePayload?: any;
  errorMessage?: string;
}

export interface TestPreset {
  id: string;
  title: string;
  customerId: string;
  text: string;
  description: string;
  category: 'pii' | 'injection' | 'evasion' | 'clean' | 'secrets' | 'triage';
  suggestedRoute?: 'sanitize' | 'triage';
}

export interface RouterOutput {
  category: string;
  category_conf: number;
  urgency: string;
  urgency_conf: number;
  team: string;
}

export interface TraceRecord {
  node: string;
  started_at: string;
  duration_ms: number;
  summary: Record<string, any>;
  error?: string | null;
}

export interface TriageResponse {
  ticket_id: string;
  sanitized_text: string | null;
  intent: 'good' | 'bad';
  risk_flags?: string[];
  router: RouterOutput | null;
  route: string | null;
  route_reason: string | null;
  draft: string | null;
  citations?: string[];
  guard_result: Record<string, any> | null;
  trace: TraceRecord[];
}

export interface BatchTicketItem {
  customer_id: string;
  input_text: string;
  subject?: string;
  expected_category?: string;
  is_malicious?: number;
}

export interface BatchDatasetResponse {
  found: boolean;
  file_path: string;
  total_count: number;
  tickets: BatchTicketItem[];
  message: string;
}

export interface BatchTestResultItem {
  index: number;
  customer_id: string;
  input_text: string;
  subject?: string;
  status: 'success' | 'error';
  latencyMs: number;
  ticket_id?: string;
  sanitized_text?: string | null;
  intent?: 'good' | 'bad';
  risk_flags?: string[];
  router?: RouterOutput | null;
  route?: string | null;
  route_reason?: string | null;
  draft?: string | null;
  citations?: string[];
  guard_result?: Record<string, any> | null;
  trace?: TraceRecord[];
  errorMessage?: string;
  rawResponse?: any;
  is_malicious?: number;
}


export interface BatchEvaluationMetrics {
  totalLabeled: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
}

export interface BatchReportSummary {
  total: number;
  successful: number;
  failed: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  categoryCounts: Record<string, number>;
  urgencyCounts: Record<string, number>;
  teamCounts: Record<string, number>;
  riskFlagCounts: Record<string, number>;
  quarantinedCount: number;
  autoDraftCount: number;
  escalationCount: number;
  cleanCount: number;
  totalDurationMs: number;
  evaluation?: BatchEvaluationMetrics | null;
}


