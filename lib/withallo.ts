import "server-only";

const DEFAULT_ALLO_BASE_URL = "https://api.withallo.com";
const ALLO_ME_PATH = "/v2/api/me";
const ALLO_DIALING_QUEUE_PATH = "/v2/api/dialing-queues/current/numbers";
const MAX_QUEUE_BATCH = 100;

export type WithAlloQueueNumber = {
  number: string;
  name?: string;
  last_name?: string;
  company?: string;
  job_title?: string;
  emails?: string[];
  website?: string;
};

export type WithAlloMe = {
  data?: {
    api_key_id?: string;
    scopes?: string[];
    endpoints?: Array<{ method?: string; path?: string; description?: string; scope?: string }>;
    team?: { id?: string; name?: string };
    rate_limits?: { read_per_second?: number; write_per_second?: number };
  };
};

type AlloErrorPayload = {
  error?: {
    type?: string;
    code?: string;
    message?: string;
    retryable?: boolean;
    request_id?: string;
    retry_after_seconds?: number;
    suggestion?: string;
  };
};

export class WithAlloApiError extends Error {
  status: number;
  code?: string;
  retryable?: boolean;
  suggestion?: string;

  constructor(message: string, status: number, payload?: AlloErrorPayload) {
    super(message);
    this.name = "WithAlloApiError";
    this.status = status;
    this.code = payload?.error?.code;
    this.retryable = payload?.error?.retryable;
    this.suggestion = payload?.error?.suggestion;
  }
}

function apiKey() {
  return process.env.WITHALLO_API_KEY?.trim() || process.env.ALLO_API_KEY?.trim() || "";
}

function baseUrl() {
  return (process.env.WITHALLO_BASE_URL?.trim() || process.env.ALLO_BASE_URL?.trim() || DEFAULT_ALLO_BASE_URL).replace(/\/$/, "");
}

export function isWithAlloConfigured() {
  return Boolean(apiKey());
}

async function withAlloRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = apiKey();
  if (!key) throw new WithAlloApiError("WITHALLO_API_KEY manquante", 503);

  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Api-Key ${key}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: init.signal || AbortSignal.timeout(10_000),
  });

  const payload = await response.json().catch(() => ({})) as T & AlloErrorPayload;
  if (!response.ok) {
    const message = payload?.error?.message || `Allo API HTTP ${response.status}`;
    throw new WithAlloApiError(message, response.status, payload);
  }
  return payload as T;
}

export function getWithAlloMe() {
  return withAlloRequest<WithAlloMe>(ALLO_ME_PATH, { method: "GET" });
}

export async function appendWithAlloDialingQueue(input: {
  numbers: WithAlloQueueNumber[];
  userId?: string | null;
  email?: string | null;
}) {
  const unique = new Map<string, WithAlloQueueNumber>();
  for (const item of input.numbers) {
    const number = String(item.number || "").trim();
    if (!number) continue;
    const dedupeKey = number.replace(/[^+\d]/g, "");
    if (!dedupeKey || unique.has(dedupeKey)) continue;
    unique.set(dedupeKey, { ...item, number });
  }

  const numbers = [...unique.values()];
  const results: Array<{ data?: { added?: unknown[]; skipped?: unknown[] } }> = [];
  for (let offset = 0; offset < numbers.length; offset += MAX_QUEUE_BATCH) {
    const batch = numbers.slice(offset, offset + MAX_QUEUE_BATCH);
    results.push(await withAlloRequest(ALLO_DIALING_QUEUE_PATH, {
      method: "POST",
      body: JSON.stringify({
        numbers: batch,
        ...(input.userId?.trim() ? { user_id: input.userId.trim() } : {}),
        ...(!input.userId?.trim() && input.email?.trim() ? { email: input.email.trim().toLowerCase() } : {}),
      }),
    }));
  }

  return {
    requested: numbers.length,
    added: results.reduce((sum, result) => sum + (result.data?.added?.length || 0), 0),
    skipped: results.reduce((sum, result) => sum + (result.data?.skipped?.length || 0), 0),
    batches: results.length,
  };
}

export function safeWithAlloError(error: unknown) {
  if (error instanceof WithAlloApiError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code || null,
      retryable: error.retryable ?? false,
      suggestion: error.suggestion || null,
    };
  }
  return {
    message: error instanceof Error ? error.message : "Erreur Allo inconnue",
    status: 500,
    code: null,
    retryable: false,
    suggestion: null,
  };
}
