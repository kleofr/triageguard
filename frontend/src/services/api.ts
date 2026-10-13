import type {
  SanitizeResponse,
  SanitizerConfig,
  TriageResponse,
  BatchDatasetResponse,
  BatchTicketItem,
} from '../types';

export const DEFAULT_API_URL = 'http://localhost:8000';

export interface HealthStatus {
  online: boolean;
  service?: string;
  version?: string;
  latencyMs?: number;
  prompt_guard_ready?: boolean;
  prompt_guard_mode?: string;
  device?: string;
  model_id?: string;
  models?: {
    prompt_guard_ready?: boolean;
    prompt_guard_mode?: string;
    prompt_guard_mock?: boolean;
    device?: string;
    router_ready?: boolean;
    router_mock?: boolean;
  };
  error?: string;
}

export async function checkBackendHealth(baseUrl: string): Promise<HealthStatus> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const elapsed = Math.round(performance.now() - start);

    if (response.ok) {
      const data = await response.json();
      return {
        online: true,
        service: data.service || 'TriageGuard',
        version: data.version || '0.1.0',
        latencyMs: elapsed,
        prompt_guard_ready: data.prompt_guard_ready,
        prompt_guard_mode: data.prompt_guard_mode,
        device: data.device,
        model_id: data.model_id,
        models: data.models,
      };
    } else {
      return {
        online: false,
        latencyMs: elapsed,
        error: `Server responded with ${response.status} ${response.statusText}`,
      };
    }
  } catch (err: any) {
    return {
      online: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : 'Backend unreachable (Is FastAPI server running?)',
    };
  }
}

export async function callSanitizeApi(
  baseUrl: string,
  customerId: string,
  text: string,
  config?: SanitizerConfig
): Promise<SanitizeResponse> {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/sanitize`;

  const payload: any = {
    customer_id: customerId,
    text: text,
  };

  if (config && Object.keys(config).length > 0) {
    payload.config = config;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Ignored
    }
    throw new Error(errorDetail);
  }

  const data = await response.json();
  return data as SanitizeResponse;
}

export async function callTriageApi(
  baseUrl: string,
  customerId: string,
  text: string,
  channel: string = 'web',
  subject?: string
): Promise<TriageResponse> {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/triage`;

  const payload = {
    channel,
    subject: subject || '',
    body: text,
    customer_ref: customerId,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Ignored
    }
    throw new Error(errorDetail);
  }

  const data = await response.json();
  return data as TriageResponse;
}

export async function fetchBatchDataset(baseUrl: string): Promise<BatchDatasetResponse> {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/batch/dataset`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load dataset: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as BatchDatasetResponse;
}

export async function uploadBatchCsv(baseUrl: string, file: File): Promise<BatchDatasetResponse> {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/batch/upload`;
  const text = await file.text();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      csv_text: text,
      filename: file.name,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Upload failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Ignored
    }
    throw new Error(errorDetail);
  }

  return (await response.json()) as BatchDatasetResponse;
}


export function parseCsvString(csvText: string): BatchTicketItem[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    values.push(cur.trim());
    return values;
  };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));
  const custIndex = headers.findIndex((h) => ['customerid', 'customer', 'custid', 'id', 'user'].includes(h));
  const textIndex = headers.findIndex((h) => ['inputtext', 'text', 'body', 'message', 'tickettext', 'prompt', 'description'].includes(h));
  const subjIndex = headers.findIndex((h) => ['subject', 'title'].includes(h));
  const catIndex = headers.findIndex((h) => ['category', 'expectedcategory', 'label'].includes(h));
  const maliciousIndex = headers.findIndex((h) => ['ismalicious', 'malicious', 'isattack', 'attack', 'groundtruth'].includes(h));

  const resolvedTextIdx = textIndex !== -1 ? textIndex : 1;
  const resolvedCustIdx = custIndex !== -1 ? custIndex : 0;

  const tickets: BatchTicketItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const cols = parseCsvLine(rawLine);
    const text = cols[resolvedTextIdx] || (cols.length === 1 ? cols[0] : '');
    const custId = cols[resolvedCustIdx] || `cust_${i.toString().padStart(3, '0')}`;
    const subj = subjIndex !== -1 ? cols[subjIndex] : undefined;
    const cat = catIndex !== -1 ? cols[catIndex] : undefined;

    let isMalicious: number | undefined = undefined;
    if (maliciousIndex !== -1 && cols[maliciousIndex] !== undefined) {
      const rawVal = cols[maliciousIndex].trim().toLowerCase();
      if (['1', 'true', 'yes', 'malicious'].includes(rawVal)) {
        isMalicious = 1;
      } else if (['0', 'false', 'no', 'benign'].includes(rawVal)) {
        isMalicious = 0;
      }
    }

    if (text) {
      tickets.push({
        customer_id: custId,
        input_text: text,
        subject: subj,
        expected_category: cat,
        is_malicious: isMalicious,
      });
    }
  }

  return tickets;
}

