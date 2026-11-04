import "server-only";

const BASE = "https://api.aircall.io/v1";

export class AircallError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "AircallError";
  }
}

function aircallAuthorization(): string | null {
  const token = process.env.AIRCALL_ACCESS_TOKEN?.trim();
  if (token) return `Bearer ${token}`;
  const id = process.env.AIRCALL_API_ID?.trim();
  const secret = process.env.AIRCALL_API_TOKEN?.trim();
  return id && secret ? `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` : null;
}

export function isAircallConfigured(): boolean {
  return Boolean(aircallAuthorization());
}

export function isAircallWebhookConfigured(): boolean {
  return Boolean(process.env.AIRCALL_WEBHOOK_TOKEN?.trim());
}

export function normalizeAircallPhone(value: unknown): string | null {
  const source = String(value || "").replace(/[\s().-]/g, "");
  const international = source.startsWith("00") ? `+${source.slice(2)}` : source;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}

export async function aircallRequest<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const authorization = aircallAuthorization();
  if (!authorization) throw new AircallError("Configurez AIRCALL_API_ID et AIRCALL_API_TOKEN dans Vercel.", 503);
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { authorization, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    signal: init.signal || AbortSignal.timeout(10_000),
  });
  if (response.status === 204) return {} as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = String(body?.message || body?.error || "Aircall a refusé la demande.");
    throw new AircallError(details.slice(0, 240), response.status);
  }
  return body as T;
}

type AircallUser = {
  id: number;
  email?: string;
  name?: string;
  numbers?: { id: number; name?: string; digits?: string; number?: string }[];
};

export async function getAircallAgentForEmail(email: string): Promise<AircallUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new AircallError("L’adresse e-mail du compte Gando est manquante.", 403);
  for (let page = 1; page <= 10; page += 1) {
    const payload = await aircallRequest<{ users?: AircallUser[]; meta?: { next_page_link?: string | null } }>(
      `/users?per_page=50&page=${page}`,
    );
    const agent = (payload.users || []).find(user => user.email?.trim().toLowerCase() === normalized);
    if (agent) {
      const details = await aircallRequest<{ user?: AircallUser }>(`/users/${agent.id}`);
      return details.user || agent;
    }
    if (!payload.meta?.next_page_link) break;
  }
  throw new AircallError("Aucun utilisateur Aircall ne correspond à votre e-mail Gando. Demandez à l’administrateur de l’ajouter.", 403);
}

export async function getAircallStatus() {
  if (!isAircallConfigured()) return { configured: false, connected: false, webhookConfigured: isAircallWebhookConfigured(), error: null };
  try {
    await aircallRequest("/ping");
    return { configured: true, connected: true, webhookConfigured: isAircallWebhookConfigured(), error: null };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      webhookConfigured: isAircallWebhookConfigured(),
      error: error instanceof Error ? error.message : "Aircall indisponible",
    };
  }
}
