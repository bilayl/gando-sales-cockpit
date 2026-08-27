import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const DEFAULT_ACTOR_ID = "scraper-engine~google-search-results-scraper";

export type CompanyWebCandidate = {
  url: string;
  title: string;
  snippet: string;
  query: string;
  score: number;
  kind: "official" | "booking" | "directory";
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value = "") {
  return normalize(value).replace(/\s+/g, "");
}

function importantWords(value = "") {
  return normalize(value).split(/\s+/).filter(word => word.length >= 3 && !["sas", "sarl", "eurl", "location", "locations"].includes(word));
}

function candidateKind(url: URL) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (/booking|reservation|reserver|rent|rental|fleet|resa/.test(`${host}${path}`)) return "booking" as const;
  if (/pagesjaunes|pappers|societe\.com|verif\.com|annuaire|tripadvisor|facebook|instagram|linkedin/.test(host)) return "directory" as const;
  return "official" as const;
}

function scoreCandidate(url: URL, title: string, snippet: string, companyName: string, city: string) {
  const haystack = normalize(`${title} ${snippet}`);
  const company = normalize(companyName);
  const companyCompact = compact(companyName);
  const hostCompact = compact(url.hostname.replace(/^www\./, ""));
  const words = importantWords(companyName);
  let score = 0;

  if (company && haystack.includes(company)) score += 110;
  else if (words.length && words.every(word => haystack.includes(word))) score += 80;
  else if (words.some(word => haystack.includes(word))) score += 25;

  if (companyCompact.length >= 5 && hostCompact.includes(companyCompact)) score += 90;
  else if (words.some(word => word.length >= 4 && hostCompact.includes(word))) score += 35;

  if (city && haystack.includes(normalize(city))) score += 25;
  if (/location|rent|rental|voiture|vehicule|utilitaire|agence/.test(haystack)) score += 15;
  if (/reservation|reserver|booking|book/.test(normalize(`${title} ${url.pathname}`))) score += 12;

  const kind = candidateKind(url);
  if (kind === "official") score += 18;
  if (kind === "directory") score -= 35;
  return { score, kind };
}

async function getApifyToken() {
  const envToken = process.env.APIFY_API_TOKEN?.trim();
  if (envToken) return envToken;
  try {
    const { data, error } = await getSupabaseAdmin().rpc("get_server_secret", { p_name: "apify_api_token" });
    if (error) throw error;
    return typeof data === "string" ? data.trim() : "";
  } catch (error) {
    console.error("Unable to resolve Apify token for web search", error);
    return "";
  }
}

async function apifyRequest(path: string, token: string, options: { method?: string; body?: unknown; timeoutMs?: number } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 30_000);
  try {
    const response = await fetch(`${APIFY_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : {};
    if (!response.ok) throw new Error(payload?.error?.message || payload?.message || `Apify ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchCompanyWebCandidates(input: { companyName: string; city?: string; country?: string }) {
  const token = await getApifyToken();
  if (!token || !input.companyName.trim()) return [] as CompanyWebCandidate[];

  const city = clean(input.city);
  const country = clean(input.country) || "France";
  const base = `\"${input.companyName.trim()}\" ${city}`.trim();
  const queries = [
    `${base} téléphone`,
    `${base} location voiture`,
    `${base} réservation`,
  ];

  try {
    const actorId = (process.env.APIFY_GOOGLE_SEARCH_ACTOR_ID || DEFAULT_ACTOR_ID).replace("/", "~");
    const started = await apifyRequest(`/actors/${encodeURIComponent(actorId)}/runs`, token, {
      method: "POST",
      body: {
        queries: queries.join("\n"),
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
        countryCode: /réunion|reunion/i.test(country) ? "re" : "fr",
        languageCode: "fr",
        mobileResults: false,
      },
      timeoutMs: 15_000,
    });
    const run = started?.data || started;
    if (!run?.id) return [];

    const finishedPayload = await apifyRequest(`/actor-runs/${encodeURIComponent(String(run.id))}?waitForFinish=20`, token, { timeoutMs: 25_000 });
    const finished = finishedPayload?.data || finishedPayload;
    const datasetId = clean(finished?.defaultDatasetId || run?.defaultDatasetId);
    if (!datasetId) return [];

    const rows = await apifyRequest(`/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=true&limit=20`, token, { timeoutMs: 15_000 });
    const candidates = new Map<string, CompanyWebCandidate>();

    for (const row of Array.isArray(rows) ? rows : []) {
      const query = clean(row?.searchQuery?.term || row?.query || row?.searchTerm);
      const organic = Array.isArray(row?.organicResults) ? row.organicResults : [row];
      for (const item of organic) {
        const rawUrl = clean(item?.url || item?.link);
        const title = clean(item?.title);
        const snippet = clean(item?.description || item?.snippet);
        if (!rawUrl) continue;
        let url: URL;
        try { url = new URL(rawUrl); } catch { continue; }
        if (!/^https?:$/.test(url.protocol)) continue;
        if (/google\.|youtube\.com|youtu\.be/.test(url.hostname)) continue;
        const ranked = scoreCandidate(url, title, snippet, input.companyName, city);
        if (ranked.score < 65) continue;
        const key = `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/$/, "");
        const candidate: CompanyWebCandidate = { url: url.toString(), title, snippet, query, score: ranked.score, kind: ranked.kind };
        const previous = candidates.get(key);
        if (!previous || candidate.score > previous.score) candidates.set(key, candidate);
      }
    }

    return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 8);
  } catch (error) {
    console.error("Company Google web search via Apify:", error);
    return [] as CompanyWebCandidate[];
  }
}
