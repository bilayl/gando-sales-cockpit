import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeManualSD01 } from "@/lib/sd01-agent";
import type { SD01Content } from "@/lib/sd-room-types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const SD01_PROMPT_VERSION = "sd01-v1.2-runtime-safe";
const DEFAULT_MODEL = "openrouter/auto";

type AgentSource = { id: string; title: string; transcript: string };
type JsonRecord = Record<string, unknown>;
type ResponseMode = "json_schema" | "json_object";

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
      type: "object", additionalProperties: false, required: ["sector", "description", "context"],
      properties: { sector: { type: "string" }, description: { type: "string" }, context: { type: "string" } },
    },
    gandoContext: { type: "string" },
    stakeholders: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["name", "role", "organization", "notes"],
        properties: { name: { type: "string" }, role: { type: "string" }, organization: { type: "string" }, notes: { type: "string" } },
      },
    },
    currentProcess: stringArray,
    productsAndOffers: stringArray,
    businessModel: stringArray,
    painPoints: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["priority", "title", "details"],
        properties: { priority: { type: "integer" }, title: { type: "string" }, details: stringArray },
      },
    },
    solutionFit: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["need", "response"],
        properties: { need: { type: "string" }, response: { type: "string" } },
      },
    },
    roi: {
      type: "object", additionalProperties: false, required: ["valueLevers", "metricsRequired"],
      properties: {
        valueLevers: {
          type: "array",
          items: {
            type: "object", additionalProperties: false, required: ["lever", "mechanism", "value"],
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
        type: "object", additionalProperties: false, required: ["owner", "action", "dueDate", "status"],
        properties: {
          owner: { type: "string" }, action: { type: "string" }, dueDate: { type: ["string", "null"] },
          status: { type: "string", enum: ["not_started", "in_progress", "done"] },
        },
      },
    },
    evidence: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["field", "sourceId", "quote"],
        properties: { field: { type: "string" }, sourceId: { type: "string" }, quote: { type: "string" } },
      },
    },
  },
} as const;

const FACTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["facts"],
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["category", "fact", "sourceId", "quote"],
        properties: {
          category: { type: "string" }, fact: { type: "string" }, sourceId: { type: "string" }, quote: { type: "string" },
        },
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

function messageFromPayload(payload: unknown) {
  return (payload as { choices?: Array<{ message?: Record<string, unknown>; text?: unknown; finish_reason?: unknown }> })?.choices?.[0];
}

function textFromPart(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  return "";
}

function extractText(payload: unknown) {
  const choice = messageFromPayload(payload);
  const content = choice?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map(textFromPart).filter(Boolean).join("\n").trim();
  if (content && typeof content === "object") {
    const direct = textFromPart(content);
    if (direct) return direct.trim();
  }
  if (typeof choice?.text === "string") return choice.text.trim();
  return "";
}

function finishReason(payload: unknown) {
  const value = messageFromPayload(payload)?.finish_reason;
  return typeof value === "string" ? value : "";
}

function directJsonFromPayload(payload: unknown): JsonRecord | null {
  const message = messageFromPayload(payload)?.message;
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
    // Continue with balanced-object extraction.
  }
  return null;
}

function extractBalancedObject(text: string) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
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
      if (depth === 0 && start >= 0) return text.slice(start, index + 1);
    }
  }
  return "";
}

function parseJsonObject(text: string) {
  const clean = text
    .replace(/^\s*```(?:json|javascript|js)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const direct = parseCandidate(clean);
  if (direct) return direct;
  const balanced = extractBalancedObject(clean);
  const extracted = parseCandidate(balanced);
  if (extracted) return extracted;
  throw new Error(clean ? "La réponse IA n’est pas un JSON exploitable." : "La réponse IA est vide.");
}

function formatInstruction(name: string, schema: object) {
  return `\n\nFORMAT OBLIGATOIRE : réponds uniquement avec UN objet JSON valide. Aucun markdown, aucun préambule, aucun commentaire. Respecte exactement ce schéma :\n${JSON.stringify(schema)}\nNom : ${name}.`;
}

function timeoutError() {
  return Object.assign(new Error("La génération SD01 a dépassé le temps disponible. Réessaie avec une transcription plus courte ou relance la génération."), { status: 504 });
}

async function requestStructuredJson(input: {
  token: string;
  model: string;
  name: string;
  schema: object;
  system: string;
  user: string;
  timeoutMs: number;
  maxTokens: number;
}) {
  const startedAt = Date.now();
  const deadline = startedAt + Math.max(8_000, Math.min(input.timeoutMs, 45_000));
  const remaining = () => deadline - Date.now();

  const run = async (mode: ResponseMode, user: string, repair = false, preferredBudget = 30_000) => {
    const available = remaining() - 1_500;
    if (available < 2_500) throw timeoutError();
    const requestTimeout = Math.max(2_500, Math.min(preferredBudget, available));
    const responseFormat = mode === "json_schema"
      ? { type: "json_schema", json_schema: { name: input.name, strict: true, schema: input.schema } }
      : { type: "json_object" };

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://gando.app",
          "X-Title": "Gando Sales Cockpit - Agent SD01",
        },
        body: JSON.stringify({
          model: input.model,
          temperature: repair ? 0 : 0.1,
          max_tokens: input.maxTokens,
          messages: [
            { role: "system", content: `${input.system}${formatInstruction(input.name, input.schema)}` },
            { role: "user", content: user },
          ],
          response_format: responseFormat,
          provider: { require_parameters: true, allow_fallbacks: true },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeout),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw timeoutError();
      throw error;
    }

    const raw = await response.text();
    let payload: unknown = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
    return { response, payload, raw, text: extractText(payload), finish: finishReason(payload) };
  };

  let result = await run("json_schema", input.user, false, Math.min(32_000, input.timeoutMs));
  if (!result.response.ok && [400, 404, 422].includes(result.response.status) && remaining() > 5_000) {
    result = await run("json_object", input.user, false, Math.min(18_000, remaining() - 1_500));
  }
  if (!result.response.ok) {
    const message = (result.payload as { error?: { message?: string } })?.error?.message || result.response.statusText || result.raw.slice(0, 400);
    throw Object.assign(new Error(`OpenRouter ${result.response.status}: ${message}`), { status: 502 });
  }

  const direct = directJsonFromPayload(result.payload);
  if (direct) return { data: direct, returnedModel: (result.payload as { model?: string }).model || input.model };
  try {
    return { data: parseJsonObject(result.text), returnedModel: (result.payload as { model?: string }).model || input.model };
  } catch {
    if (result.finish === "length") {
      throw Object.assign(new Error("La réponse IA a été coupée avant la fin du JSON. La transcription est trop volumineuse pour cette génération."), { status: 422 });
    }
  }

  if (remaining() < 5_000) throw timeoutError();
  const repairPrompt = result.text
    ? `Répare cette sortie en JSON strict, sans rien ajouter hors JSON :\n${result.text.slice(0, 24_000)}`
    : `Produis directement l'objet JSON demandé à partir de cette demande :\n${input.user.slice(0, 24_000)}`;
  const repaired = await run("json_object", repairPrompt, true, Math.min(8_000, remaining() - 1_500));
  if (!repaired.response.ok) {
    const message = (repaired.payload as { error?: { message?: string } })?.error?.message || repaired.response.statusText;
    throw Object.assign(new Error(`OpenRouter ${repaired.response.status}: ${message}`), { status: 502 });
  }
  const repairedDirect = directJsonFromPayload(repaired.payload);
  if (repairedDirect) return { data: repairedDirect, returnedModel: (repaired.payload as { model?: string }).model || input.model };
  try {
    return { data: parseJsonObject(repaired.text), returnedModel: (repaired.payload as { model?: string }).model || input.model };
  } catch {
    throw Object.assign(new Error("L’agent SD01 n’a pas renvoyé un JSON exploitable après la tentative de réparation."), { status: 502 });
  }
}

function sourceText(sources: AgentSource[]) {
  return sources.map(source => `\n=== [SOURCE:${source.id}] ${source.title} ===\n${source.transcript}`).join("\n");
}

function chunksFromSources(sources: AgentSource[], maxChars = 55_000) {
  const chunks: string[] = [];
  let current = "";
  for (const source of sources) {
    const prefix = `\n=== [SOURCE:${source.id}] ${source.title} ===\n`;
    const maxPart = Math.max(5_000, maxChars - prefix.length);
    for (let offset = 0; offset < source.transcript.length; offset += maxPart) {
      const part = prefix + source.transcript.slice(offset, offset + maxPart);
      if (current && current.length + part.length > maxChars) { chunks.push(current); current = ""; }
      current += part;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 6);
}

function sanitizeGeneratedSD01(value: JsonRecord, companyName: string, sourceIds: Set<string>): SD01Content {
  const normalized = normalizeManualSD01(value, companyName);
  normalized.evidence = normalized.evidence.filter(item => sourceIds.has(item.sourceId));
  return normalized;
}

export async function generateSD01(input: { companyName: string; dealName: string; sources: AgentSource[] }) {
  const sources = input.sources.filter(source => source.transcript.trim()).slice(0, 60);
  if (!sources.length) throw Object.assign(new Error("Ajoutez ou sélectionnez au moins une conversation exploitable."), { status: 400 });

  const token = await getOpenRouterApiKey();
  const model = process.env.OPENROUTER_SD01_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const allText = sourceText(sources);
  let synthesisSource = allText;

  if (allText.length > 70_000) {
    const chunks = chunksFromSources(sources);
    const partials = await Promise.all(chunks.map(async (chunk, index) => {
      const result = await requestStructuredJson({
        token,
        model,
        name: "sd01_facts",
        schema: FACTS_SCHEMA,
        system: "Tu extrais uniquement les faits commerciaux explicites. Tu n'inventes rien. Chaque fait conserve son sourceId et une citation courte. Garde les contradictions.",
        user: `Bloc ${index + 1}/${chunks.length}. Extrais les faits utiles au SD01 : entreprise, interlocuteurs, processus, irritants, décisions, ROI, urgence, questions et prochaines actions.\n${chunk}`,
        timeoutMs: 15_000,
        maxTokens: 2_200,
      });
      return JSON.stringify(result.data);
    }));
    synthesisSource = partials.join("\n").slice(0, 70_000);
  }

  const result = await requestStructuredJson({
    token,
    model,
    name: "sd01",
    schema: SD01_SCHEMA,
    system: `Tu es l'agent Deal Room de Gando. Tu transformes les conversations en SD01 de vente complexe, lisible par un COMEX et exploitable par les équipes.
Règles absolues :
- N'invente aucun fait, chiffre, engagement, date, nom ou fonction.
- Toute donnée manquante devient une question ouverte.
- Conserve les contradictions au lieu de les résoudre arbitrairement.
- Reformule clairement sans recopier la conversation.
- Ne présente pas une capacité Gando comme acquise si elle n'est pas dans la source.
- Chaque fait structurant doit avoir une preuve avec le sourceId exact et une citation courte.
- Le résultat est un brouillon à relire par un humain.
- Français professionnel, direct, sans jargon inutile.`,
    user: `DEAL : ${input.dealName}\nCLIENT : ${input.companyName}\n\nCrée le SD01 complet depuis les éléments suivants :\n${synthesisSource}`,
    timeoutMs: allText.length > 70_000 ? 28_000 : 45_000,
    maxTokens: 5_500,
  });

  return {
    content: sanitizeGeneratedSD01(result.data, input.companyName, new Set(sources.map(source => source.id))),
    model: result.returnedModel,
    promptVersion: SD01_PROMPT_VERSION,
  };
}
