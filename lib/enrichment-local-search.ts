import type { SourcingProspect } from "@/lib/enrichment-dedup";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/responses";
const PUBLIC_COMPANY_SEARCH_URL = "https://recherche-entreprises.api.gouv.fr/search";
const RENTAL_NAF_CODES = "77.11A,77.11B,77.12Z";

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
          sourceUrls: { type: "array", minItems: 1, items: { type: "string" } },
          sourceTypes: {
            type: "array",
            minItems: 1,
            items: {
              type: "string",
              enum: ["leboncoin", "facebook", "instagram", "google", "directory", "official_website", "other"],
            },
          },
          evidence: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          gandoScore: { type: "number", minimum: 0, maximum: 100 },
          qualificationReason: { type: ["string", "null"] },
        },
        required: [
          "companyName", "city", "territory", "country", "website", "domain", "phone",
          "publicBusinessEmail", "sourceUrls", "sourceTypes", "evidence", "confidence",
          "gandoScore", "qualificationReason",
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
  const clean = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
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
      json_schema: { name: "gando_sourcing_prospects", strict: true, schema: PROSPECT_SCHEMA },
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

const DEPARTMENT_BY_QUERY: Array<[RegExp, string]> = [
  [/\blyon\b|\brh[oô]ne\b/i, "69"],
  [/\bparis\b/i, "75"],
  [/\bmarseille\b|\bbouches[- ]du[- ]rh[oô]ne\b/i, "13"],
  [/\bbordeaux\b|\bgironde\b/i, "33"],
  [/\btoulouse\b|\bhaute[- ]garonne\b/i, "31"],
  [/\blille\b|\bnord\b/i, "59"],
  [/\bnantes\b|\bloire[- ]atlantique\b/i, "44"],
  [/\bnice\b|\balpes[- ]maritimes\b/i, "06"],
  [/\bmontpellier\b|\bh[eé]rault\b/i, "34"],
  [/\bstrasbourg\b|\bbas[- ]rhin\b/i, "67"],
  [/\brennes\b|\bille[- ]et[- ]vilaine\b/i, "35"],
];

const TERRITORY_DEPARTMENTS: Record<string, string> = {
  Guadeloupe: "971",
  Martinique: "972",
  Guyane: "973",
  "La Réunion": "974",
  Mayotte: "976",
};

const TERRITORY_LABELS: Record<string, string> = {
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

function detectDepartment(input: { query?: string; territories?: string[] }) {
  const query = String(input.query || "");
  for (const [pattern, department] of DEPARTMENT_BY_QUERY) {
    if (pattern.test(query)) return department;
  }

  const specific = (input.territories || [])
    .map(territory => TERRITORY_DEPARTMENTS[territory])
    .filter(Boolean);
  if (specific.length && !(input.territories || []).includes("France métropolitaine")) {
    return [...new Set(specific)].join(",");
  }
  return "";
}

function cityFromRegistry(row: any) {
  const siege = row?.siege || {};
  const explicit = siege.libelle_commune || siege.nom_commune || siege.commune_nom;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const address = typeof siege.adresse === "string" ? siege.adresse.trim() : "";
  const match = address.match(/\b\d{5}\s+(.+)$/);
  return match?.[1]?.trim();
}

function registryScore(ape?: string) {
  if (ape === "77.11A") return 82;
  if (ape === "77.12Z") return 76;
  if (ape === "77.11B") return 70;
  return 65;
}

function registryQualification(ape?: string) {
  if (ape === "77.11A") return "Loueur automobile actif — location courte durée (APE 77.11A).";
  if (ape === "77.11B") return "Loueur automobile actif — location longue durée (APE 77.11B).";
  if (ape === "77.12Z") return "Loueur de camions/utilitaires actif (APE 77.12Z).";
  return "Entreprise active avec activité de location de véhicules.";
}

async function searchRentalCompaniesFromPublicRegistry(input: {
  query?: string;
  territories?: string[];
  limit?: number;
}, fallbackReason?: string) {
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
  const target = Math.min(Math.max(limit * 4, 25), 50);
  const department = detectDepartment(input);
  const pages = Math.ceil(target / 25);
  const rows: any[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const params = new URLSearchParams({
      activite_principale: RENTAL_NAF_CODES,
      etat_administratif: "A",
      page: String(page),
      per_page: "25",
      minimal: "true",
      include: "siege",
    });
    if (department) params.set("departement", department);

    const response = await fetch(`${PUBLIC_COMPANY_SEARCH_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "GandoSalesCockpit/1.0 (https://gando.app)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`API Recherche d'entreprises ${response.status}: ${payload?.detail || payload?.message || response.statusText}`);
    }
    rows.push(...(Array.isArray(payload?.results) ? payload.results : []));
    if (!payload?.total_pages || page >= Number(payload.total_pages) || rows.length >= target) break;
  }

  const seen = new Set<string>();
  const prospects: SourcingProspect[] = [];
  for (const row of rows) {
    const siren = String(row?.siren || "").replace(/\D/g, "");
    const companyName = String(row?.nom_raison_sociale || row?.nom_complet || "").trim();
    if (!companyName || siren.length !== 9 || seen.has(siren)) continue;
    seen.add(siren);

    const siege = row?.siege || {};
    const ape = String(siege.activite_principale || row?.activite_principale || "").trim();
    const departmentCode = String(siege.departement || "").trim();
    const city = cityFromRegistry(row);
    const address = typeof siege.adresse === "string" ? siege.adresse.trim() : "";
    const sourceUrl = `${PUBLIC_COMPANY_SEARCH_URL}?q=${encodeURIComponent(siren)}&page=1&per_page=1`;

    prospects.push({
      companyName,
      city,
      territory: TERRITORY_LABELS[departmentCode] || (departmentCode ? "France métropolitaine" : undefined),
      country: "France",
      sourceUrls: [sourceUrl],
      sourceTypes: ["directory"],
      evidence: [
        `Entreprise active dans le répertoire public de l'État, SIREN ${siren}`,
        ape ? `APE ${ape}` : "",
        address ? `siège ${address}` : "",
        fallbackReason ? "moteur IA indisponible, sourcing registre public utilisé" : "",
      ].filter(Boolean).join(" · "),
      confidence: 0.98,
      gandoScore: registryScore(ape),
      qualificationReason: registryQualification(ape),
    });
    if (prospects.length >= target) break;
  }

  return {
    searchId: crypto.randomUUID(),
    searchedAt: new Date().toISOString(),
    candidatesFound: prospects.length,
    prospects,
    source: "api-gouv-recherche-entreprises" as const,
  };
}

async function searchWithOpenRouter(input: {
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
    tools: [{ type: "openrouter:web_search", parameters: { max_results: 7, max_total_results: 25 } }],
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

export async function searchRentalCompaniesLocally(input: {
  query?: string;
  territories?: string[];
  sources?: string[];
  limit?: number;
}) {
  try {
    return await searchWithOpenRouter(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("OpenRouter sourcing unavailable; using public French company registry:", reason);
    return searchRentalCompaniesFromPublicRegistry(input, reason);
  }
}
