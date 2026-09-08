import "server-only";

const DEFAULT_ALLO_BASE_URL = "https://api.withallo.com";
const ALLO_ME_PATH = "/v2/api/me";
const ALLO_USERS_PATH = "/v2/api/users";
const ALLO_DIALING_QUEUE_PATH = "/v2/api/dialing-queues/current";
const ALLO_DIALING_QUEUE_NUMBERS_PATH = "/v2/api/dialing-queues/current/numbers";
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

export type WithAlloEndpoint = {
  method?: string;
  path?: string;
  description?: string;
  scope?: string;
};

export type WithAlloMe = {
  data?: {
    api_key_id?: string;
    scopes?: string[];
    endpoints?: WithAlloEndpoint[];
    team?: { id?: string; name?: string };
    rate_limits?: { read_per_second?: number; write_per_second?: number };
  };
};

export type WithAlloUser = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  image_url?: string | null;
};

export type WithAlloQueue = {
  data?: Array<{
    number_to?: string;
    position?: number;
    created_at?: string;
    updated_at?: string;
    call_start_date?: string | null;
    call_id?: string | null;
    routing_result?: string | null;
    sync_status?: string | null;
  }>;
  pagination?: { page?: number; size?: number; total_count?: number; total_pages?: number; has_more?: boolean };
  queue?: {
    id?: string;
    name?: string;
    creator_id?: string;
    assignee_id?: string;
    voicemail_handling?: string;
    do_not_disturb?: string;
  } | null;
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

export async function listWithAlloUsers() {
  const result = await withAlloRequest<{ data?: WithAlloUser[] }>(ALLO_USERS_PATH, { method: "GET" });
  return result.data || [];
}

export function hasWithAlloDirectCallEndpoint(me: WithAlloMe) {
  return (me.data?.endpoints || []).some(endpoint => {
    const method = String(endpoint.method || "").toUpperCase();
    const path = String(endpoint.path || "").toLowerCase();
    const description = String(endpoint.description || "").toLowerCase();
    if (!["POST", "PUT", "PATCH"].includes(method)) return false;
    if (path.includes("dialing-queues")) return false;
    return /(^|\/)calls?(\/|$)/.test(path) && /(start|initiat|create|dial|outbound|place)/.test(`${path} ${description}`);
  });
}

export async function resolveWithAlloTarget(cockpitEmail?: string | null) {
  const configuredEmail = process.env.WITHALLO_QUEUE_EMAIL?.trim().toLowerCase() || "";
  const wantedEmail = configuredEmail || String(cockpitEmail || "").trim().toLowerCase();
  try {
    const users = await listWithAlloUsers();
    const active = users.filter(user => !user.status || user.status === "ACTIVE");
    const exact = wantedEmail ? active.find(user => user.email?.trim().toLowerCase() === wantedEmail) : undefined;
    if (exact) return { userId: exact.id, email: exact.email || wantedEmail, user: exact, source: configuredEmail ? "env" : "cockpit_email", users };
    if (active.length === 1) {
      const only = active[0];
      return { userId: only.id, email: only.email || null, user: only, source: "single_user", users };
    }
    return { userId: null, email: configuredEmail || null, user: null, source: configuredEmail ? "env_unmatched" : "api_key_owner", users };
  } catch {
    return { userId: null, email: configuredEmail || null, user: null, source: configuredEmail ? "env_fallback" : "api_key_owner", users: [] as WithAlloUser[] };
  }
}

function targetQuery(input?: { userId?: string | null; email?: string | null }) {
  const params = new URLSearchParams();
  if (input?.userId?.trim()) params.set("user_id", input.userId.trim());
  else if (input?.email?.trim()) params.set("email", input.email.trim().toLowerCase());
  return params.size ? `?${params.toString()}` : "";
}

export function getWithAlloCurrentQueue(input?: { userId?: string | null; email?: string | null }) {
  return withAlloRequest<WithAlloQueue>(`${ALLO_DIALING_QUEUE_PATH}${targetQuery(input)}`, { method: "GET" });
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
    results.push(await withAlloRequest(ALLO_DIALING_QUEUE_NUMBERS_PATH, {
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
