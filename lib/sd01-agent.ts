import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createEmptySD01, type SD01Content } from "@/lib/sd-room-types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const SD01_PROMPT_VERSION = "sd01-v1.0";
const DEFAULT_MODEL = "openrouter/auto";

type AgentSource = { id: string; title: string; transcript: string };

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

function extractText(payload: unknown) {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((item): item is { type: string; text: string } => Boolean(item && typeof item === "object" && (item as { type?: unknown }).type === "text" && typeof (item as { text?: unknown }).text === "string"))
      .map(item => item.text)
      .join("\n")
      .trim();
  }
  return "";
}

function parseJsonObject(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Réponse IA sans objet JSON.");
  return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
}

async function requestStructuredJson(input: {
  token: string;
  model: string;
  name: string;
  schema: object;
  system: string;
  user: string;
  timeout?: number;
}) {
  const run = async (withSchema: boolean, user = input.user) => {
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
        max_tokens: input.name === "sd01" ? 6500 : 4000,
        messages: [{ role: "system", content: input.system }, { role: "user", content: user }],
        ...(withSchema ? { response_format: { type: "json_schema", json_schema: { name: input.name, strict: true, schema: input.schema } } } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(input.timeout || 55_000),
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload, text: extractText(payload) };
  };

  let result = await run(true);
  if (!result.response.ok && [400, 404, 422].includes(result.response.status)) result = await run(false);
  if (!result.response.ok) {
    const message = (result.payload as { error?: { message?: string } })?.error?.message || result.response.statusText;
    throw new Error(`OpenRouter ${result.response.status}: ${message}`);
  }
  try {
    return { data: parseJsonObject(result.text), returnedModel: (result.payload as { model?: string }).model || input.model };
  } catch {
    const repair = await run(false, `La réponse suivante n'est pas un JSON valide conforme au schéma demandé. Répare-la sans ajouter de commentaire.\n\n${result.text.slice(0, 24000)}`);
    if (!repair.response.ok || !repair.text) throw new Error("L’agent n’a pas renvoyé un JSON exploitable.");
    return { data: parseJsonObject(repair.text), returnedModel: (repair.payload as { model?: string }).model || input.model };
  }
}

function text(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function strings(value: unknown, maxItems = 40) {
  return Array.isArray(value) ? value.map(item => text(item, 1200)).filter(Boolean).slice(0, maxItems) : [];
}

function objects(value: unknown) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === "object") as Record<string, unknown>[] : [];
}

function sanitizeSD01(value: Record<string, unknown>, companyName: string, sourceIds: Set<string>): SD01Content {
  const empty = createEmptySD01(companyName);
  const profile = value.companyProfile && typeof value.companyProfile === "object" ? value.companyProfile as Record<string, unknown> : {};
  const roi = value.roi && typeof value.roi === "object" ? value.roi as Record<string, unknown> : {};
  return {
    executiveSummary: text(value.executiveSummary),
    companyProfile: {
      sector: text(profile.sector),
      description: text(profile.description) || empty.companyProfile.description,
      context: text(profile.context),
    },
    gandoContext: text(value.gandoContext),
    stakeholders: objects(value.stakeholders).map(item => ({
      name: text(item.name, 240), role: text(item.role, 240), organization: text(item.organization, 240), notes: text(item.notes, 1200),
    })).filter(item => item.name).slice(0, 50),
    currentProcess: strings(value.currentProcess),
    productsAndOffers: strings(value.productsAndOffers),
    businessModel: strings(value.businessModel),
    painPoints: objects(value.painPoints).map((item, index) => ({
      priority: Math.max(1, Math.min(99, Number(item.priority) || index + 1)), title: text(item.title, 300), details: strings(item.details, 20),
    })).filter(item => item.title).slice(0, 30),
    solutionFit: objects(value.solutionFit).map(item => ({ need: text(item.need, 1000), response: text(item.response, 1000) })).filter(item => item.need || item.response).slice(0, 30),
    roi: {
      valueLevers: objects(roi.valueLevers).map(item => ({ lever: text(item.lever, 500), mechanism: text(item.mechanism, 1000), value: text(item.value, 500) })).filter(item => item.lever).slice(0, 30),
      metricsRequired: strings(roi.metricsRequired),
    },
    urgency: strings(value.urgency),
    decisions: strings(value.decisions),
    openQuestions: strings(value.openQuestions),
    nextSteps: objects(value.nextSteps).map(item => ({
      owner: text(item.owner, 240), action: text(item.action, 1000), dueDate: text(item.dueDate, 40) || null,
      status: ["not_started", "in_progress", "done"].includes(String(item.status)) ? item.status as "not_started" | "in_progress" | "done" : "not_started",
    })).filter(item => item.action).slice(0, 50),
    evidence: objects(value.evidence).map(item => ({
      field: text(item.field, 240), sourceId: text(item.sourceId, 240), quote: text(item.quote, 320),
    })).filter(item => item.field && item.quote && sourceIds.has(item.sourceId)).slice(0, 120),
  };
}

export function normalizeManualSD01(value: unknown, companyName: string): SD01Content {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const evidenceIds = new Set(objects(record.evidence).map(item => text(item.sourceId, 240)).filter(Boolean));
  return sanitizeSD01(record, companyName, evidenceIds);
}

function sourceText(sources: AgentSource[]) {
  return sources.map(source => `\n=== [SOURCE:${source.id}] ${source.title} ===\n${source.transcript}`).join("\n");
}

function chunksFromSources(sources: AgentSource[], maxChars = 45_000) {
  const chunks: string[] = [];
  let current = "";
  for (const source of sources) {
    const prefix = `\n=== [SOURCE:${source.id}] ${source.title} ===\n`;
    const transcript = source.transcript;
    for (let offset = 0; offset < transcript.length; offset += maxChars - prefix.length) {
      const part = prefix + transcript.slice(offset, offset + maxChars - prefix.length);
      if (current && current.length + part.length > maxChars) { chunks.push(current); current = ""; }
      current += part;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function generateSD01(input: { companyName: string; dealName: string; sources: AgentSource[] }) {
  const sources = input.sources.filter(source => source.transcript.trim()).slice(0, 60);
  if (!sources.length) throw Object.assign(new Error("Ajoutez ou sélectionnez au moins une conversation exploitable."), { status: 400 });
  const token = await getOpenRouterApiKey();
  const model = process.env.OPENROUTER_SD01_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const allText = sourceText(sources);
  let synthesisSource = allText;

  if (allText.length > 60_000) {
    const chunks = chunksFromSources(sources);
    const partials = await Promise.all(chunks.map(async (chunk, index) => {
      const result = await requestStructuredJson({
        token, model, name: "sd01_facts", schema: FACTS_SCHEMA,
        system: "Tu extrais uniquement des faits commerciaux explicites. Tu n'inventes rien. Chaque fait doit citer son sourceId et une courte citation verbatim. Conserve les contradictions au lieu de les résoudre.",
        user: `Bloc ${index + 1}/${chunks.length}. Extrais les faits utiles au SD01 : entreprise, interlocuteurs, processus actuel, offre, business model, irritants, contraintes, décisions, ROI, urgence, questions et prochaines actions.\n${chunk}`,
      });
      return JSON.stringify(result.data);
    }));
    synthesisSource = partials.join("\n");
  }

  const result = await requestStructuredJson({
    token, model, name: "sd01", schema: SD01_SCHEMA,
    system: `Tu es l'agent Deal Room de Gando. Tu transformes l'intégralité des conversations fournies en SD01 de vente complexe, lisible par un COMEX et exploitable par les équipes.
Règles absolues :
- N'invente aucun fait, chiffre, engagement, date, nom ou fonction.
- Distingue les faits confirmés des hypothèses ; transforme toute donnée manquante en question ouverte.
- Conserve les contradictions comme questions ouvertes.
- Reformule clairement sans recopier la conversation.
- Ne présente pas une capacité Gando comme acquise si elle n'est pas dans la source.
- Chaque fait structurant doit avoir une preuve avec le sourceId exact et une citation courte.
- Le résultat est un brouillon à relire par un humain, jamais une publication automatique.
- Français professionnel, direct, sans jargon inutile.`,
    user: `DEAL : ${input.dealName}\nCLIENT : ${input.companyName}\n\nCrée le SD01 complet depuis les éléments suivants :\n${synthesisSource}`,
    timeout: 60_000,
  });
  return {
    content: sanitizeSD01(result.data, input.companyName, new Set(sources.map(source => source.id))),
    model: result.returnedModel,
    promptVersion: SD01_PROMPT_VERSION,
  };
}
