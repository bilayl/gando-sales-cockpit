import "server-only";

import { getCallRecommendations } from "@/lib/call-recommendations";
import { hubspotJson } from "@/lib/hubspot";
import { saveCallOutcome } from "@/lib/hubspot/contacts";
import { createReminderTask } from "@/lib/hubspot/tasks";
import { getBestCallTimeForProperties } from "@/lib/call-timing";

export { getBestCallTimeForProperties } from "@/lib/call-timing";

export const SALES_AGENT_TOOL_NAMES = [
  "get_today_sales_queue",
  "get_contact_context",
  "get_best_call_time",
  "schedule_call_reminder",
  "record_call_outcome",
] as const;

export type SalesAgentToolName = (typeof SALES_AGENT_TOOL_NAMES)[number];

type ToolArguments = Record<string, unknown>;

type ContactLike = {
  id: string;
  properties?: Record<string, string | null | undefined>;
  associations?: Record<string, { results?: Array<{ id: string }> }>;
};

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

const WRITE = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
  readOnlyHint: false,
} as const;

function stringArg(args: ToolArguments, key: string, required = true) {
  const value = String(args[key] || "").trim();
  if (required && !value) throw new Error(`${key} est requis`);
  return value;
}

function numberArg(args: ToolArguments, key: string, fallback: number, min: number, max: number) {
  const parsed = Number(args[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

async function fetchContact(contactId: string): Promise<ContactLike> {
  const query = new URLSearchParams({
    properties: [
      "firstname", "lastname", "email", "phone", "mobilephone", "company", "jobtitle",
      "hubspot_owner_id", "statut_prospection", "resultat_prospection", "statut_de_lappel",
      "date_prochaine_relance", "notes_last_contacted", "hs_last_sales_activity_timestamp",
      "country", "state", "city", "timezone",
    ].join(","),
    associations: "companies,deals",
  });
  return hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(contactId)}?${query}`) as Promise<ContactLike>;
}

export async function executeSalesAgentTool(name: SalesAgentToolName, args: ToolArguments, actor?: string | null) {
  switch (name) {
    case "get_today_sales_queue": {
      const limit = numberArg(args, "limit", 20, 1, 80);
      const owner = stringArg(args, "owner", false) || undefined;
      const recommendations = await getCallRecommendations({ bucket: "ACTIONABLE", owner, limit });
      return {
        evaluatedAt: recommendations.evaluatedAt,
        summary: recommendations.summary,
        results: recommendations.results.map(contact => ({
          id: contact.id,
          firstname: contact.properties.firstname || null,
          lastname: contact.properties.lastname || null,
          company: contact.properties.company || null,
          phone: contact.properties.phone || contact.properties.mobilephone || null,
          score: Number(contact.properties.db_call_score || 0),
          priority: contact.properties.db_call_priority_label || null,
          reason: contact.properties.db_call_reason || null,
          recommendedAction: contact.properties.db_call_action || null,
          timing: getBestCallTimeForProperties(contact.properties),
        })).sort((a, b) => Number(b.timing.callNow) - Number(a.timing.callNow) || b.score - a.score),
      };
    }

    case "get_contact_context": {
      const contactId = stringArg(args, "contactId");
      const contact = await fetchContact(contactId);
      const recommendations = await getCallRecommendations({ bucket: "ALL", limit: 2000 });
      const recommendation = recommendations.results.find(item => item.id === contactId) || null;
      return {
        contact,
        recommendation: recommendation ? {
          score: Number(recommendation.properties.db_call_score || 0),
          priority: recommendation.properties.db_call_priority_label || null,
          reason: recommendation.properties.db_call_reason || null,
          recommendedAction: recommendation.properties.db_call_action || null,
        } : null,
        timing: getBestCallTimeForProperties(contact.properties || {}),
      };
    }

    case "get_best_call_time": {
      const contactId = stringArg(args, "contactId");
      const contact = await fetchContact(contactId);
      return { contactId, ...getBestCallTimeForProperties(contact.properties || {}) };
    }

    case "schedule_call_reminder": {
      const contactId = stringArg(args, "contactId");
      const reminderAt = new Date(stringArg(args, "reminderAt"));
      if (Number.isNaN(reminderAt.getTime()) || reminderAt.getTime() <= Date.now()) {
        throw new Error("reminderAt doit être une date ISO future");
      }
      const contact = await fetchContact(contactId);
      const task = await createReminderTask(contact, reminderAt);
      return { ok: true, actor: actor || null, contactId, reminderAt: reminderAt.toISOString(), taskId: String(task?.id || "") || null };
    }

    case "record_call_outcome": {
      const contactId = stringArg(args, "contactId");
      const outcome = stringArg(args, "outcome");
      const reminderAt = stringArg(args, "reminderAt", false) || undefined;
      const result = await saveCallOutcome(contactId, outcome, reminderAt);
      return { ok: true, actor: actor || null, contactId, outcome, reminderAt: reminderAt || null, result };
    }
  }
}

export const OPENROUTER_SALES_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_today_sales_queue",
      description: "Retourne la file d'appels commerciale priorisée, avec score et pertinence du moment d'appel selon le fuseau local du contact.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 80, default: 20 },
          owner: { type: "string", description: "HubSpot owner id optionnel." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_context",
      description: "Charge le contexte CRM réel d'un contact, sa recommandation commerciale et son créneau d'appel local.",
      parameters: {
        type: "object",
        properties: { contactId: { type: "string" } },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_best_call_time",
      description: "Calcule de façon déterministe si le contact doit être appelé maintenant selon son fuseau et des fenêtres locales 09:30-12:00 / 14:00-17:00.",
      parameters: {
        type: "object",
        properties: { contactId: { type: "string" } },
        required: ["contactId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_call_reminder",
      description: "Crée un rappel d'appel HubSpot. À utiliser uniquement quand l'utilisateur demande explicitement de programmer ou reporter un appel.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string" },
          reminderAt: { type: "string", description: "Date ISO 8601 future avec fuseau." },
        },
        required: ["contactId", "reminderAt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_call_outcome",
      description: "Enregistre un résultat d'appel dans HubSpot. À utiliser uniquement si l'utilisateur fournit explicitement le résultat réel de l'appel.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string" },
          outcome: { type: "string", enum: ["NRP", "Occupé", "À rappeler", "Intéressé", "RDV pris", "Pas intéressé", "Hors cible", "Numéro invalide", "A une date ultérieure", "Intéressé mais"] },
          reminderAt: { type: "string", description: "Date ISO future lorsque le résultat exige un rappel." },
        },
        required: ["contactId", "outcome"],
        additionalProperties: false,
      },
    },
  },
] as const;

export const SALES_MCP_TOOL_METADATA = {
  get_today_sales_queue: { readOnly: true, annotations: READ_ONLY },
  get_contact_context: { readOnly: true, annotations: READ_ONLY },
  get_best_call_time: { readOnly: true, annotations: READ_ONLY },
  schedule_call_reminder: { readOnly: false, annotations: WRITE },
  record_call_outcome: { readOnly: false, annotations: WRITE },
} as const;
