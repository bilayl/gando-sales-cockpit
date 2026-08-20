import type { SourcingProspect } from "@/lib/enrichment-dedup";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/responses";

const PROSPECT_SCHEMA = {
  type: "object",
  properties: {
    prospects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          city: { type: ["string", "null"] },
          territory: { type: ["string", "null"] },
          country: { type: ["string", "null"] },
          website: { type: ["string", "null"] },
          domain: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          publicBusinessEmail: { type: ["string", "null"] },
          sourceUrls: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          sourceTypes: {
            type: "array",
            minItems: 1,
            items: {
              type: "string",
              enum: [
                "leboncoin",
                "facebook",
                "instagram",
                "google",
                "directory",
                "official_website",
                "other",
              ],
            },
          },
          evidence: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          gandoScore: { type: "number", minimum: 0, maximum: 100 },
          qualificationReason: { type: ["string", "null"] },
        },
        required: [
          "companyName",
          "city",
          "territory",
          "country",
          "website",
          "domain",
          "phone",
          "publicBusinessEmail",
          "sourceUrls",
          "sourceTypes",
          "evidence",
          "confidence",
          "gandoScore",
          "qualificationReason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["prospects"],
  additionalProperties: false,
} as const;

async function getOpenRouterApiKey() {
  const envKey = process.env.OPENROUTER_API_KEY?.trim();
  if (envKey) return envKey;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("get_server_secret", { p_name: "openrouter_api_key" });
    if (error) throw error;
    const vaultKey = typeof data === "string" ? data.trim() : "";
    if (vaultKey) return vaultKey;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenRouter non configuré côté serveur (env/Vault): ${message}`);
  }

  throw new Error("OpenRouter non configuré côté serveur (env/Vault)");
}

function extractText(payload: any) {
  const responseText = (payload?.output || [])
    .flatMap((item: any) => item?.content || [])
    .filter((item: any) => item?.type === "output_text" && typeof item.text === "string")
    .map((item: any) => item.text)
    .join("\n")
    .trim();
  if (responseText) return responseText;

  // Compatibility fallback if a provider normalizes the response as chat completions.
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => ["text", "output_text"].includes(item?.type) && typeof item.text === "string")
      .map((item: any) => item.text)
      .join("\n")
      .trim();
  }
  return "";
}

function cleanJsonText(text: string) {
  const clean = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
}

function parseJson(text: string) {
  return JSON.parse(cleanJsonText(text));
}

function readableApiError(value: unknown, fallback = "Erreur OpenRouter inconnue"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error_description", "detail", "details", "code"]) {
      const nested = record[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
      if (nested && typeof nested === "object") {
        const nestedMessage = readableApiError(nested, "");
        if (nestedMessage) return nestedMessage;
      }
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Use fallback below.
    }
  }
  return fallback;
}

function structuredOutputConfig() {
  return {
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "gando_sourcing_prospects",
        strict: true,
        schema: PROSPECT_SCHEMA,
      },
    },
    plugins: [{ id: "response-healing" }],
    provider: { require_parameters: true },
  };
}

async function callOpenRouter(token: string, body: Record<string, unknown>) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://gando.app",
      "X-Title": "Gando Sales Cockpit",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(55_000),
  });

  const raw = await response.text();
  let payload: any = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`OpenRouter ${response.status}: réponse JSON invalide - ${raw.trim().slice(0, 250)}`);
    }
  }

  if (!response.ok || payload?.error) {
    throw new Error(`OpenRouter ${response.status}: ${readableApiError(payload?.error || payload, response.statusText)}`);
  }

  return payload;
}

async function repairMalformedJson(token: string, model: string, text: string) {
  const payload = await callOpenRouter(token, {
    model,
    input: `Répare le JSON ci-dessous sans inventer de nouvelles entreprises. Conserve uniquement les prospects complets et factuels. Si le dernier objet est tronqué ou incomplet, supprime uniquement cet objet. Réponds exclusivement avec le JSON conforme au schéma demandé.\n\n${text}`,
    max_output_tokens: 12000,
    ...structuredOutputConfig(),
  });

  const repairedText = extractText(payload);
  if (!repairedText) throw new Error("OpenRouter n'a retourné aucun JSON réparé");
  return parseJson(repairedText);
}

export async function searchRentalCompaniesLocally(input: {
  query?: string;
  territories?: string[];
  sources?: string[];
  limit?: number;
}) {
  const token = await getOpenRouterApiKey();

  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
  const target = Math.min(Math.max(limit + 10, 20), 45);
  const territories = input.territories?.length
    ? input.territories
    : ["France métropolitaine", "Guadeloupe", "Martinique", "Guyane", "La Réunion", "Mayotte"];
  const sources = input.sources?.length
    ? input.sources
    : ["Leboncoin", "Facebook public", "Instagram public", "Google", "annuaires professionnels", "sites web de loueurs"];

  const prompt = `Tu es le moteur de sourcing B2B de Gando.
Trouve jusqu'à ${target} entreprises professionnelles de location de véhicules actives dans : ${territories.join(", ")}.
Priorise les sources publiques suivantes : ${sources.join(", ")}.
${input.query ? `Contrainte supplémentaire : ${input.query}.` : ""}
Effectue de vraies recherches web et croise plusieurs sources lorsqu'elles sont disponibles.
Règles absolues : uniquement professionnels/entreprises ; jamais de particuliers pair-à-pair ; chaque prospect doit avoir au moins une URL publique vérifiable ; n'invente jamais nom, téléphone, domaine, email ou localisation ; publicBusinessEmail doit être publié publiquement par l'entreprise ; website doit être le site officiel ; confidence entre 0 et 1 ; gandoScore entre 0 et 100 ; sourceTypes parmi leboncoin, facebook, instagram, google, directory, official_website, other.
Privilégie les loueurs indépendants et PME réellement actifs. Ne remplis pas un champ si l'information n'est pas vérifiable.`;

  const model = process.env.OPENROUTER_MODEL || process.env.ENRICHMENT_MODEL || "openrouter/auto";
  const payload = await callOpenRouter(token, {
    model,
    input: prompt,
    max_output_tokens: 12000,
    ...structuredOutputConfig(),
    tools: [
      {
        type: "openrouter:web_search",
        parameters: {
          max_results: 7,
          max_total_results: 25,
        },
      },
    ],
  });

  const text = extractText(payload);
  if (!text) throw new Error("OpenRouter n'a retourné aucun contenu exploitable via Responses API");

  let parsed: any;
  try {
    parsed = parseJson(text);
  } catch (firstError) {
    try {
      parsed = await repairMalformedJson(token, model, text);
    } catch (repairError) {
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
      const repairMessage = repairError instanceof Error ? repairError.message : String(repairError);
      throw new Error(`JSON OpenRouter invalide malgré la réparation automatique : ${firstMessage}. Réparation : ${repairMessage}`);
    }
  }

  const prospects = (Array.isArray(parsed?.prospects) ? parsed.prospects : []) as SourcingProspect[];
  return {
    searchId: crypto.randomUUID(),
    searchedAt: new Date().toISOString(),
    candidatesFound: prospects.length,
    prospects,
    source: "openrouter-responses-direct-structured" as const,
  };
}
