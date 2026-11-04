import "server-only";

const BASE_URL = "https://api.withallo.com";

export class WithAlloError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "WithAlloError";
  }
}

export function normalizeWithAlloPhone(value: unknown) {
  const source = String(value || "").replace(/[\s().-]/g, "");
  const number = source.startsWith("00") ? "+" + source.slice(2) : source;
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
}

export function isWithAlloConfigured() {
  return Boolean(process.env.WITHALLO_API_KEY?.trim());
}

export async function withAlloRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.WITHALLO_API_KEY?.trim();
  if (!key) throw new WithAlloError("La clé WITHALLO_API_KEY manque sur Vercel.", 503);
  if (!path.startsWith("/") || path.startsWith("//")) throw new WithAlloError("Chemin API Allo invalide.", 400);
  const response = await fetch(BASE_URL + path, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: "Api-Key " + key,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: init.signal || AbortSignal.timeout(10000),
  });
  if (response.status === 204) return {} as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : "Requête Allo refusée.";
    throw new WithAlloError(response.status === 401 ? "Clé Allo non autorisée." : response.status === 403 ? "Permissions insuffisantes sur la clé Allo." : detail.slice(0, 240), response.status);
  }
  return data as T;
}

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}; }
function first(value: RecordValue, names: string[]): unknown {
  for (const name of names) {
    const candidate = value[name];
    if (candidate !== undefined && candidate !== null && candidate !== "") return candidate;
  }
  return null;
}
function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}
function readArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const source = record(value);
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
  }
  if (source.data) return readArray(source.data, keys);
  return [];
}
function iso(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const number = value < 1e11 ? value * 1000 : value;
    return new Date(number).toISOString();
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

export type WithAlloNumber = { number: string; name: string };
export type WithAlloCall = {
  id: string; startedAt: string | null; direction: string | null; status: string | null;
  from: string | null; to: string | null; externalNumber: string | null;
  durationSeconds: number | null; ownerEmail: string | null; summary: string | null;
  transcript: string | null; recordingUrl: string | null; recordingAvailable: boolean;
};

export async function getWithAlloStatus() {
  if (!isWithAlloConfigured()) return { configured: false, connected: false, scopes: [] as string[], error: "Clé Allo absente." };
  try {
    const payload = record(await withAlloRequest("/v2/api/me"));
    const scopes = Array.isArray(payload.scopes) ? payload.scopes.filter((scope): scope is string => typeof scope === "string") : [];
    return { configured: true, connected: true, scopes, error: null };
  } catch (error) {
    return { configured: true, connected: false, scopes: [] as string[], error: error instanceof Error ? error.message : "Allo indisponible" };
  }
}

export async function listWithAlloNumbers(): Promise<WithAlloNumber[]> {
  const payload = await withAlloRequest("/v2/api/numbers");
  return readArray(payload, ["numbers", "items", "results"]).map(item => {
    const value = record(item);
    const digits = text(first(value, ["number", "phone_number", "phoneNumber", "e164", "digits", "alloNumber"]));
    const name = text(first(value, ["name", "label", "title"])) || digits || "Ligne Allo";
    return digits ? { number: digits, name } : null;
  }).filter((item): item is WithAlloNumber => Boolean(item && normalizeWithAlloPhone(item.number)));
}

function transcriptValue(value: unknown): string | null {
  const plain = text(value);
  if (plain) return plain.slice(0, 60000);
  if (!Array.isArray(value)) return null;
  const lines = value.map(item => {
    const line = record(item);
    return [text(first(line, ["speaker", "role", "name"])), text(first(line, ["text", "content", "transcript"]))].filter(Boolean).join(" : ");
  }).filter(Boolean);
  return lines.join("\n").slice(0, 60000) || null;
}

function parseCall(value: unknown, lineNumber: string): WithAlloCall | null {
  const call = record(value);
  const id = text(first(call, ["id", "call_id", "callId", "uuid", "conversation_id", "conversationId"]));
  if (!id) return null;
  const direction = text(first(call, ["direction", "call_direction", "callDirection", "type"]));
  const from = text(first(call, ["from_number", "from", "fromNumber", "caller", "caller_number", "callerNumber"]));
  const to = text(first(call, ["to", "to_number", "toNumber", "callee", "callee_number", "calleeNumber"]));
  const contact = record(first(call, ["contact", "person", "customer"]));
  const contactPhone = text(first(contact, ["phone", "phone_number", "phoneNumber", "number"]));
  const explicitExternal = text(first(call, ["external_number", "externalNumber", "contact_number", "contactNumber"]));
  const inbound = /inbound|incoming|entrant/i.test(direction || "");
  const other = explicitExternal || contactPhone || (inbound ? from : to) || (from === lineNumber ? to : from);
  const owner = record(first(call, ["user", "agent", "owner", "team_member", "teamMember"]));
  const email = text(first(call, ["user_email", "agent_email", "agentEmail", "userEmail", "owner_email"])) || text(first(owner, ["email"]));
  const summarySource = first(call, ["summary", "ai_summary", "aiSummary", "call_summary", "callSummary"]);
  const summary = text(summarySource) || text(first(record(summarySource), ["text", "content", "summary"]));
  const transcript = transcriptValue(first(call, ["concatenated_transcript", "transcript", "transcriptions", "transcription", "transcript_text", "transcriptText"]));
  const recording = text(first(call, ["recording_url", "recordingUrl", "recording", "audio_url", "audioUrl", "recording_download_url"]));
  const durationRaw = first(call, ["duration_seconds", "durationSeconds", "duration", "call_duration", "callDuration"]);
  const duration = Number(durationRaw);
  return {
    id,
    startedAt: iso(first(call, ["start_date", "started_at", "startedAt", "created_at", "createdAt", "timestamp", "date"])),
    direction,
    status: text(first(call, ["result", "status", "outcome", "call_status", "callStatus"])),
    from, to,
    externalNumber: other,
    durationSeconds: durationRaw != null && Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : null,
    ownerEmail: email,
    summary, transcript,
    recordingUrl: recording && /^https:\/\//.test(recording) ? recording : null,
    recordingAvailable: Boolean(recording) || Number(call.recording_duration || 0) > 0 || Boolean(call.recording === true),
  };
}

export async function getWithAlloCalls(limit = 80) {
  const size = Math.min(Math.max(Math.floor(limit), 1), 100);
  const lines = await listWithAlloNumbers();
  const selectedLines = lines.slice(0, 8);
  const requests = selectedLines.length ? selectedLines.map(line => ({
    number: line.number,
    path: "/v1/api/calls?alloNumber=" + encodeURIComponent(line.number) + "&size=" + String(size),
  })) : [{ number: "", path: "/v1/api/calls?size=" + String(size) }];
  const outcomes = await Promise.allSettled(requests.map(request => withAlloRequest(request.path)));
  const good = outcomes.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    return readArray(result.value, ["calls", "items", "results"]).map(item => parseCall(item, requests[index].number)).filter((item): item is WithAlloCall => Boolean(item));
  });
  if (outcomes.every(result => result.status === "rejected")) {
    const issue = outcomes.find(result => result.status === "rejected");
    throw issue?.status === "rejected" ? issue.reason : new WithAlloError("Historique Allo indisponible.");
  }
  return [...new Map(good.map(item => [item.id, item])).values()]
    .sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || "")).slice(0, size);
}

export function matchesWithAlloPhone(left: string | null, right: string) {
  const l = String(left || "").replace(/\D/g, "");
  const r = String(right || "").replace(/\D/g, "");
  return l.length >= 9 && r.length >= 9 && l.slice(-9) === r.slice(-9);
}
