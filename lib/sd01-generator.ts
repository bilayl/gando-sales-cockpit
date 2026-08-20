import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeManualSD01 } from "@/lib/sd01-agent";
import type { SD01Content } from "@/lib/sd-room-types";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const SD01_PROMPT_VERSION = "sd01-v1.6-openai-responses";

const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const FAST_DEFAULT_MODEL = "google/gemma-4-31b-it:free";
const FREE_FALLBACK_MODEL = "openrouter/free";
const OPENAI_BUDGET_MS = 55_000;
const OPENROUTER_PRIMARY_BUDGET_MS = 70_000;
const OPENROUTER_FALLBACK_BUDGET_MS = 20_000;
const MAX_SOURCE_CHARS = 42_000;

type AgentSource = { id: string; title: string; transcript: string };
type JsonRecord = Record<string, unknown>;
type ProviderError = Error & { status?: number; fallbackAllowed?: boolean };

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
          name: { type: "string" },
          role: { type: "string" },
          organization: { type: "string" },
          notes: { type: "string" },
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
        properties: {
          priority: { type: "integer" },
          title: { type: "string" },
          details: stringArray,
        },
      },
    },
    solutionFit: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["need", "response"],
        properties: {
          need: { type: "string" },
          response: { type: "string" },
        },
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
            properties: {
              lever: { type: "string" },
              mechanism: { type: "string" },
              value: { type: "string" },
            },
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
          owner: { type: "string" },
          action: { type: "string" },
          dueDate: { type: ["string", "null"] },
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
        properties: {
          field: { type: "string" },
          sourceId: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
  },
} as const;

function providerError(message: string, status: number, fallbackAllowed = false) {
  return Object.assign(new Error(message), { status, fallbackAllowed }) as ProviderError;
}

async function getServerSecret(name: string) {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("get_server_secret", { p_name: name });
    if (error) return "";
    return typeof data === "string" ? data.trim() : "";
  } catch {
    return "";
  }
}

async function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || await getServerSecret("openai_api_key");
}

async function getOpenRouterApiKey() {
  const key = process.env.OPENROUTER_API_KEY?.trim() || await getServerSecret("openrouter_api_key");
  if (!key) throw providerError("OpenRouter non configuré côté serveur.", 503);
  return key;
}

function isTimeoutLike(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /timeout|timed out|aborted|abort/i.test(`${error.name} ${error.message}`);
}

function extractChatText(payload: unknown) {
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

function extractResponsesText(payload: unknown) {
  const direct = (payload as { output_text?: unknown })?.output_text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const output = (payload as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: unknown; refusal?: unknown }>;
    }>;
  })?.output;

  if (!Array.isArray(output)) return "";

  return output
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(part => part?.type === "output_text" && typeof part.text === "string")
    .map(part => String(part.text).trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractResponsesRefusal(payload: unknown) {
  const output = (payload as {
    output?: Array<{
      content?: Array<{ type?: string; refusal?: unknown }>;
    }>;
  })?.output;

  if (!Array.isArray(output)) return "";

  for (const item of output) {
    for (const part of Array.isArray(item.content) ? item.content : []) {
      if (part?.type === "refusal" && typeof part.refusal === "string" && part.refusal.trim()) {
        return part.refusal.trim();
      }
    }
  }
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
    if (char === '"') {
      inString = true;
      continue;
    }
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
  const clean = value
    .replace(/^\s*```(?:json|javascript|js)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const direct = parseCandidate(clean);
  if (direct) return direct;
  const balanced = extractBalancedObject(clean);
  const extracted = parseCandidate(balanced);
  if (extracted) return extracted;
  throw providerError("Le modèle a répondu, mais le format JSON SD01 est invalide.", 502);
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
  return usable
    .map(source => `=== [SOURCE:${source.id}] ${source.title} ===\n${compactTranscript(source.transcript, perSource)}`)
    .join("\n\n");
}

function systemPrompt() {
  return `Tu es l'agent Deal Room de Gando. Transforme les conversations fournies en brouillon SD01 de vente complexe, lisible par un COMEX et exploitable par les équipes commerciales.
Règles absolues :
- N'invente aucun fait, chiffre, engagement, date, nom ou fonction.
- Toute information manquante devient une question ouverte.
- Conserve les contradictions au lieu de les résoudre.
- Reformule clairement sans recopier inutilement la conversation.
- Ne présente pas une capacité Gando comme acquise si elle n'est pas explicitement présente dans les sources.
- Les preuves doivent utiliser les sourceId exacts et des citations courtes.
- Maximum 24 preuves.
- Français professionnel, direct et synthétique.
- Le résultat reste un brouillon soumis à validation humaine.`;
}

function userPrompt(input: { companyName: string; dealName: string; sourceText: string }) {
  return `DEAL : ${input.dealName}\nCLIENT : ${input.companyName}\n\nCONVERSATIONS :\n${input.sourceText}`;
}

async function callOpenAI(input: {
  token: string;
  model: string;
  companyName: string;
  dealName: string;
  sourceText: string;
}) {
  let response: Response;

  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        store: false,
        instructions: systemPrompt(),
        input: userPrompt(input),
        reasoning: { effort: "minimal" },
        text: {
          format: {
            type: "json_schema",
            name: "sd01",
            strict: true,
            schema: SD01_SCHEMA,
          },
        },
        max_output_tokens: 7_000,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(OPENAI_BUDGET_MS),
    });
  } catch (error) {
    if (isTimeoutLike(error)) {
      throw providerError("OpenAI a dépassé le délai de génération SD01.", 504, true);
    }
    throw providerError(`Erreur réseau OpenAI : ${error instanceof Error ? error.message : "erreur inconnue"}`, 502, true);
  }

  const raw = await response.text();
  let payload: unknown = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw providerError(`OpenAI a renvoyé une réponse HTTP non JSON (${response.status}).`, 502, response.status >= 500);
  }

  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } })?.error?.message ||
      response.statusText ||
      raw.slice(0, 300);
    const canFallback = response.status === 408 || response.status === 429 || response.status >= 500;
    throw providerError(`OpenAI ${response.status}: ${message}`, response.status, canFallback);
  }

  const providerStatus = (payload as { status?: unknown })?.status;
  const responseError = (payload as { error?: { message?: unknown; code?: unknown } | null })?.error;
  if (responseError && typeof responseError === "object") {
    const message = typeof responseError.message === "string" ? responseError.message : "erreur OpenAI";
    throw providerError(`OpenAI: ${message}`, 502, true);
  }

  if (providerStatus === "incomplete") {
    const reason = (payload as { incomplete_details?: { reason?: unknown } | null })?.incomplete_details?.reason;
    throw providerError(
      `OpenAI a interrompu la sortie SD01 avant la fin${typeof reason === "string" ? ` (${reason})` : ""}.`,
      422,
    );
  }

  const refusal = extractResponsesRefusal(payload);
  if (refusal) {
    throw providerError("OpenAI a refusé de produire le SD01 pour cette entrée.", 422);
  }

  const content = extractResponsesText(payload);
  if (!content) {
    const usage = (payload as {
      usage?: { output_tokens?: unknown; output_tokens_details?: { reasoning_tokens?: unknown } };
    })?.usage;
    const outputTokens = typeof usage?.output_tokens === "number" ? usage.output_tokens : null;
    const reasoningTokens = typeof usage?.output_tokens_details?.reasoning_tokens === "number"
      ? usage.output_tokens_details.reasoning_tokens
      : null;
    throw providerError(
      `OpenAI a terminé la requête sans output_text SD01${outputTokens !== null ? ` (sortie: ${outputTokens} tokens` : ""}${reasoningTokens !== null ? `, raisonnement: ${reasoningTokens}` : ""}${outputTokens !== null ? ")" : ""}.`,
      502,
    );
  }

  return {
    data: parseJsonObject(content),
    returnedModel: `openai:${(payload as { model?: string }).model || input.model}`,
  };
}

function fallbackModels(primary: string) {
  return Array.from(new Set([primary, FREE_FALLBACK_MODEL])).filter(Boolean);
}

async function callOpenRouter(input: {
  token: string;
  model: string;
  companyName: string;
  dealName: string;
  sourceText: string;
  timeoutMs: number;
}) {
  const user = `${userPrompt(input)}\n\nSCHÉMA JSON OBLIGATOIRE :\n${JSON.stringify(SD01_SCHEMA)}`;
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
        models: fallbackModels(input.model),
        temperature: 0.1,
        max_tokens: 2_600,
        messages: [
          {
            role: "system",
            content: `${systemPrompt()}\nRéponds uniquement avec un objet JSON valide conforme au schéma fourni, sans markdown ni commentaire.`,
          },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        provider: { allow_fallbacks: true, sort: "throughput" },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch (error) {
    if (isTimeoutLike(error)) {
      throw providerError("Le fallback OpenRouter n’a pas terminé dans le délai disponible.", 504);
    }
    throw providerError(`Erreur réseau OpenRouter : ${error instanceof Error ? error.message : "erreur inconnue"}`, 502);
  }

  const raw = await response.text();
  let payload: unknown = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw providerError(`OpenRouter a renvoyé une réponse HTTP non JSON (${response.status}).`, 502);
  }

  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } })?.error?.message ||
      response.statusText ||
      raw.slice(0, 300);
    if (response.status === 429) {
      throw providerError("OpenRouter 429 : les modèles gratuits sont momentanément limités ou le quota gratuit est atteint.", 429);
    }
    throw providerError(`OpenRouter ${response.status}: ${message}`, 502);
  }

  const structured = directJson(payload);
  if (structured) {
    return {
      data: structured,
      returnedModel: `openrouter:${(payload as { model?: string }).model || input.model}`,
    };
  }

  const content = extractChatText(payload);
  if (!content) throw providerError("OpenRouter a répondu sans contenu exploitable pour le SD01.", 502);

  return {
    data: parseJsonObject(content),
    returnedModel: `openrouter:${(payload as { model?: string }).model || input.model}`,
  };
}

function sanitizeGeneratedSD01(value: JsonRecord, companyName: string, sourceIds: Set<string>): SD01Content {
  const normalized = normalizeManualSD01(value, companyName);
  normalized.evidence = normalized.evidence.filter(item => sourceIds.has(item.sourceId)).slice(0, 24);
  return normalized;
}

function errorSummary(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inconnue";
}

function canFallback(error: unknown) {
  return Boolean((error as ProviderError | undefined)?.fallbackAllowed);
}

export async function generateSD01(input: {
  companyName: string;
  dealName: string;
  sources: AgentSource[];
}) {
  const sources = input.sources.filter(source => source.transcript.trim()).slice(0, 20);
  if (!sources.length) {
    throw providerError("Ajoutez ou sélectionnez au moins une conversation exploitable.", 400);
  }

  const sourceText = compactSources(sources);
  const sourceIds = new Set(sources.map(source => source.id));
  const openAIKey = await getOpenAIApiKey();
  let openAIError: unknown = null;

  if (openAIKey) {
    try {
      const result = await callOpenAI({
        token: openAIKey,
        model: process.env.OPENAI_SD01_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
        companyName: input.companyName,
        dealName: input.dealName,
        sourceText,
      });
      return {
        content: sanitizeGeneratedSD01(result.data, input.companyName, sourceIds),
        model: result.returnedModel,
        promptVersion: SD01_PROMPT_VERSION,
      };
    } catch (error) {
      openAIError = error;
      console.error("SD01 OpenAI primary failed:", errorSummary(error));
      if (!canFallback(error)) throw error;
    }
  }

  try {
    const token = await getOpenRouterApiKey();
    const result = await callOpenRouter({
      token,
      model: process.env.OPENROUTER_SD01_MODEL?.trim() || FAST_DEFAULT_MODEL,
      companyName: input.companyName,
      dealName: input.dealName,
      sourceText,
      timeoutMs: openAIKey ? OPENROUTER_FALLBACK_BUDGET_MS : OPENROUTER_PRIMARY_BUDGET_MS,
    });
    return {
      content: sanitizeGeneratedSD01(result.data, input.companyName, sourceIds),
      model: result.returnedModel,
      promptVersion: SD01_PROMPT_VERSION,
    };
  } catch (openRouterError) {
    if (openAIError) {
      const status =
        (openRouterError as ProviderError)?.status ||
        (openAIError as ProviderError)?.status ||
        502;
      throw providerError(
        `OpenAI indisponible (${errorSummary(openAIError)}). Fallback OpenRouter également indisponible (${errorSummary(openRouterError)}).`,
        status,
      );
    }
    throw openRouterError;
  }
}
