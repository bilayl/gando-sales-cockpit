import type { SourcingProspect } from "@/lib/enrichment-dedup";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item?.type === "text" && typeof item.text === "string")
      .map((item: any) => item.text)
      .join("\n")
      .trim();
  }
  return "";
}

function parseJson(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
}

export async function searchRentalCompaniesLocally(input: {
  query?: string;
  territories?: string[];
  sources?: string[];
  limit?: number;
}) {
  const token = await getOpenRouterApiKey();

  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
  const target = Math.min(Math.max(limit * 2, 20), 60);
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
Effectue de vraies recherches web.
Règles : uniquement professionnels/entreprises ; jamais de particuliers pair-à-pair ; chaque prospect doit avoir au moins une URL publique vérifiable ; n'invente jamais nom, téléphone, domaine, email ou localisation ; confidence entre 0 et 1 ; gandoScore entre 0 et 100 ; sourceTypes parmi leboncoin, facebook, instagram, google, directory, official_website, other.
Réponds UNIQUEMENT avec un JSON valide de forme {"prospects":[{"companyName":"...","city":"...","territory":"...","country":"France","website":"...","domain":"...","phone":"...","publicBusinessEmail":"...","sourceUrls":["https://..."],"sourceTypes":["google"],"evidence":"...","confidence":0.9,"gandoScore":85,"qualificationReason":"..."}]}.`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://gando.app",
      "X-Title": "Gando Sales Cockpit",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || process.env.ENRICHMENT_MODEL || "openrouter/auto",
      max_tokens: 7000,
      tools: [
        {
          type: "openrouter:web_search",
          parameters: {
            max_results: 5,
            max_total_results: 15,
          },
        },
      ],
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(55_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${payload?.error?.message || payload?.error || response.statusText}`);
  }

  const text = extractText(payload);
  if (!text) throw new Error("OpenRouter n'a retourné aucun contenu exploitable");

  const parsed = parseJson(text);
  const prospects = (Array.isArray(parsed?.prospects) ? parsed.prospects : []) as SourcingProspect[];
  return {
    searchId: crypto.randomUUID(),
    searchedAt: new Date().toISOString(),
    candidatesFound: prospects.length,
    prospects,
    source: "openrouter-direct" as const,
  };
}
