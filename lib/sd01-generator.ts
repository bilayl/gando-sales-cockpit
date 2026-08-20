import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeManualSD01 } from "@/lib/sd01-agent";
import type { SD01Content } from "@/lib/sd-room-types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const SD01_PROMPT_VERSION = "sd01-v1.3-free-single-pass";
const FAST_DEFAULT_MODEL = "google/gemma-4-31b-it:free";
const REQUEST_BUDGET_MS = 88_000;
const MAX_SOURCE_CHARS = 42_000;

type AgentSource = { id: string; title: string; transcript: string };
type JsonRecord = Record<string, unknown>;

const stringArray = { type: "array", items: { type: "string" } } as const;

const SD01_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary", "companyProfile", "gandoContext", "stakeholders", "currentProcess",
    "productsAndOffers", "businessModel", "painPoints", "solutionFit", "roi", "urgency",
    "decisions", "openQuestions", "nextSteps", "evidence",
  ],
  properties: {
    executiveSummary: { type: "string" },
    companyProfile: {
      type: "object",
      additionalProperties: false,
      required: ["sector", "description", "context"],
      properties: {
        sector: { type: "string" },
        description: { type: "string" },
        context: { type: "string" },
      },
    },
    gandoContext: { type: "string" },
    stakeholders: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role", "organization", "notes"],
        properties: {
          name: { type: "string" }, role: { type: "string" }, organization: { type: "string" }, notes: { type: "string" },
        },
      },
    },
    currentProcess: stringArray,
    productsAndOffers: stringArray,
    businessModel: stringArray,
    painPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "title", "details"],
        properties: { priority: { type: "integer" }, title: { type: "string" }, details: stringArray },
      },
    },
    solutionFit: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["need", "response"],
        properties: { need: { type: "string" }, response: { type: "string" } },
      },
    },
    roi: {
      type: "object",
      additionalProperties: false,
      required: ["valueLevers", "metricsRequired"],
      properties: {
        valueLevers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["lever", "mechanism", "value"],
            properties: { lever: { type: "string" }, mechanism: { type: "string" }, value: { type: "string" } },
          },
        },
        metricsRequired: stringArray,
      },
    },
    urgency: stringArray,
    decisions: stringArray,
    openQuestions: stringArray,
    nextSteps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["owner", "action", "dueDate", "status"],
        properties: {
          owner: { type: "string" }, action: { type: "string" }, dueDate: { type: ["string", "null"] },
          status: { type: "string", enum: ["not_started", "in_progress", "done"] },
        },
      },
    },
    evidence: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "sourceId", "quote"],
        properties: { field: { type: "string" }, sourceId: { type: "string" }, quote: { type: "string" } },
      },
    },
  },
} as const;

async function getOpenRouterApiKey() {
  const envKey = process.env.OPENROUTER_API_KEY?.trim();
  if (envKey) return envKey;
  const { data, error } = await getSupabaseAdmin().rpc("get_server_secret", { p_name: "openrouter_api_key" });
  if (error) throw new Error(`OpenRouter non configuré : ${error.message}`);
  const key = typeof data === "string" ? data.trim() : "";
  if (!key) throw new Error("OpenRouter non configuré côté serveur.");
  return key;
}

function isTimeoutLike(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /timeout|timed out|aborted|abort/i.test(`${error.name} ${error.message}`);
}

function timeoutError() {
  return Object.assign(
    new Error("Le modèle gratuit OpenRouter n’a pas terminé dans le délai disponible. Relancez la génération ; si le trafic gratuit est saturé, réessayez quelques secondes plus tard."),
    { status: 504 },
  );
}

function extractText(payload: unknown) {
  const choice = (payload as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> })?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : typeof record.content === "string" ? record.content : "";
    }).filter(Boolean).join("\n").trim();
  }
  if (typeof choice?.text === "string") return choice.text.trim();
  return "";
}

function directJson(payload: unknown): JsonRecord | null {
  const message = (payload as { choices?: Array<{ message?: Record<string, unknown> }> })?.choices?.[0]?.message;
  if (!message) return null;
  for (const candidate of [message.parsed, message.json, message.output]) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return candidate as JsonRecord;
  }
  return null;
}

function parseCandidate(value: string): JsonRecord | null {
  const clean = value.trim();
  if (!clean) return null;
  try {
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as JsonRecord;
    if (typeof parsed === "string" && parsed !== clean) return parseCandidate(parsed);
  } catch {
    return null;
  }
  return null;
}

function extractBalancedObject(value: string) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) return value.slice(start, index + 1);
    }
  }
  return "";
}

function parseJsonObject(value: string) {
  const clean = value.replace(/^\s*```(?:json|javascript|js)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const direct = parseCandidate(clean);
  if (direct) return direct;
  const balanced = extractBalancedObject(clean);
  const extracted = parseCandidate(balanced);
  if (extracted) return extracted;
  throw Object.assign(new Error("Le modèle a répondu, mais le format JSON SD01 est invalide."), { status: 502 });
}

function compactTranscript(transcript: string, budget: number) {
  const clean = transcript.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= budget) return clean;
  const head = Math.floor(budget * 0.72);
  const tail = Math.max(0, budget - head);
  return `${clean.slice(0, head)}\n\n[… transcription raccourcie pour la génération …]\n\n${clean.slice(-tail)}`;
}

function compactSources(sources: AgentSource[]) {
  const usable = sources.filter(source => source.transcript.trim()).slice(0, 20);
  if (!usable.length) return "";
  const overhead = usable.reduce((sum, source) => sum + source.id.length + source.title.length + 45, 0);
  const available = Math.max(12_000, MAX_SOURCE_CHARS - overhead);
  const perSource = Math.max(3_500, Math.floor(available / usable.length));
  return usable.map(source => `=== [SOURCE:${source.id}] ${source.title} ===\n${compactTranscript(source.transcript, perSource)}`).join("\n\n");
}

async function callOpenRouter(input: { token: string; model: string; companyName: string; dealName: string; sourceText: string }) {
  const system = `Tu es l'agent Deal Room de Gando. Transforme la conversation en brouillon SD01 de vente complexe, lisible par un COMEX. Sois synthétique : vise environ 1200 à 1800 mots maximum.
Règles absolues : n'invente aucun fait, chiffre, engagement, date, nom ou fonction. Toute information manquante devient une question ouverte. Conserve les contradictions. Reformule clairement. Les preuves doivent utiliser les sourceId exacts et des citations courtes. Maximum 24 preuves. Français professionnel et direct. Réponds uniquement avec le JSON demandé.`;
  const user = `DEAL : ${input.dealName}\nCLIENT : ${input.companyName}\n\nCONVERSATIONS :\n${input.sourceText}`;
  const startedAt = Date.now();

  const execute = async (useSchema: boolean) => {
    const remaining = REQUEST_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < 8_000) throw timeoutError();
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://gando.app",
          "X-Title": "Gando Sales Cockpit - Agent SD01",
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0.1,
          max_tokens: 2_600,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: useSchema
            ? { type: "json_schema", json_schema: { name: "sd01", strict: true, schema: SD01_SCHEMA } }
            : { type: "json_object" },
          provider: {
            require_parameters: true,
            allow_fallbacks: true,
            sort: "throughput",
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(remaining - 2_000, useSchema ? 78_000 : 14_000)),
      });
      const raw = await response.text();
      let payload: unknown = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch {
        throw Object.assign(new Error(`OpenRouter a renvoyé une réponse HTTP non JSON (${response.status}).`), { status: 502 });
      }
      return { response, payload, raw };
    } catch (error) {
      if (isTimeoutLike(error)) throw timeoutError();
      throw error;
    }
  };

  let result = await execute(true);
  if (!result.response.ok && [400, 404, 422].includes(result.response.status) && Date.now() - startedAt < 68_000) {
    result = await execute(false);
  }
  if (!result.response.ok) {
    const message = (result.payload as { error?: { message?: string } })?.error?.message || result.response.statusText || result.raw.slice(0, 300);
    throw Object.assign(new Error(`OpenRouter ${result.response.status}: ${message}`), { status: 502 });
  }

  const structured = directJson(result.payload);
  if (structured) return { data: structured, returnedModel: (result.payload as { model?: string }).model || input.model };
  const content = extractText(result.payload);
  if (!content) throw Object.assign(new Error("OpenRouter a répondu sans contenu exploitable pour le SD01."), { status: 502 });
  return { data: parseJsonObject(content), returnedModel: (result.payload as { model?: string }).model || input.model };
}

function sanitizeGeneratedSD01(value: JsonRecord, companyName: string, sourceIds: Set<string>): SD01Content {
  const normalized = normalizeManualSD01(value, companyName);
  normalized.evidence = normalized.evidence.filter(item => sourceIds.has(item.sourceId)).slice(0, 24);
  return normalized;
}

export async function generateSD01(input: { companyName: string; dealName: string; sources: AgentSource[] }) {
  const sources = input.sources.filter(source => source.transcript.trim()).slice(0, 20);
  if (!sources.length) throw Object.assign(new Error("Ajoutez ou sélectionnez au moins une conversation exploitable."), { status: 400 });

  const token = await getOpenRouterApiKey();
  // Only a dedicated SD01 override may replace the free model. The generic OpenRouter
  // model is intentionally ignored so another feature cannot accidentally select a slow model.
  const model = process.env.OPENROUTER_SD01_MODEL?.trim() || FAST_DEFAULT_MODEL;
  const result = await callOpenRouter({
    token,
    model,
    companyName: input.companyName,
    dealName: input.dealName,
    sourceText: compactSources(sources),
  });

  return {
    content: sanitizeGeneratedSD01(result.data, input.companyName, new Set(sources.map(source => source.id))),
    model: result.returnedModel,
    promptVersion: SD01_PROMPT_VERSION,
  };
}
