import "server-only";

export type PublicCompanyWebCandidate = {
  url: string;
  title: string;
  query: string;
  score: number;
  kind: "official" | "booking" | "directory";
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function compact(value = "") {
  return normalize(value).replace(/\s+/g, "");
}

function importantWords(value = "") {
  return normalize(value).split(/\s+/).filter(word => word.length >= 3 && !["sas", "sarl", "eurl", "location", "locations"].includes(word));
}

function kindFor(url: URL) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (/booking|reservation|reserver|rent|rental|resa|fleet/.test(`${host}${path}`)) return "booking" as const;
  if (/pagesjaunes|pappers|societe\.com|verif\.com|annuaire|tripadvisor|facebook|instagram|linkedin/.test(host)) return "directory" as const;
  return "official" as const;
}

function scoreCandidate(url: URL, title: string, companyName: string, city: string) {
  const titleNorm = normalize(title);
  const companyNorm = normalize(companyName);
  const companyCompact = compact(companyName);
  const hostCompact = compact(url.hostname.replace(/^www\./, ""));
  const words = importantWords(companyName);
  let score = 0;

  if (companyNorm && titleNorm.includes(companyNorm)) score += 110;
  else if (words.length && words.every(word => titleNorm.includes(word))) score += 75;
  else if (words.some(word => titleNorm.includes(word))) score += 25;

  if (companyCompact.length >= 5 && hostCompact.includes(companyCompact)) score += 90;
  else if (words.some(word => word.length >= 4 && hostCompact.includes(word))) score += 35;

  if (city && titleNorm.includes(normalize(city))) score += 20;
  if (/location|rent|rental|voiture|vehicule|utilitaire|agence/.test(titleNorm)) score += 15;
  if (/reservation|reserver|booking|book/.test(normalize(`${title} ${url.pathname}`))) score += 10;

  const kind = kindFor(url);
  if (kind === "official") score += 15;
  if (kind === "directory") score -= 30;
  return { score, kind };
}

function unwrapSearchUrl(raw: string) {
  const decoded = decodeHtml(raw);
  try {
    const url = new URL(decoded, "https://www.google.com");
    if (url.hostname.includes("duckduckgo.com") && url.pathname.startsWith("/l/")) {
      const uddg = url.searchParams.get("uddg");
      if (uddg) return decodeURIComponent(uddg);
    }
    if (url.hostname.includes("google.") && url.pathname === "/url") {
      return url.searchParams.get("q") || url.searchParams.get("url") || "";
    }
    return /^https?:$/.test(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function addCandidate(
  map: Map<string, PublicCompanyWebCandidate>,
  rawUrl: string,
  rawTitle: string,
  query: string,
  companyName: string,
  city: string,
) {
  const unwrapped = unwrapSearchUrl(rawUrl);
  if (!unwrapped) return;
  let url: URL;
  try { url = new URL(unwrapped); } catch { return; }
  if (!/^https?:$/.test(url.protocol)) return;
  if (/google\.|bing\.com|duckduckgo\.com|youtube\.com|youtu\.be/.test(url.hostname)) return;
  const title = stripHtml(rawTitle);
  const ranked = scoreCandidate(url, title, companyName, city);
  if (ranked.score < 55) return;
  url.hash = "";
  const key = `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/$/, "");
  const candidate: PublicCompanyWebCandidate = { url: url.toString(), title, query, score: ranked.score, kind: ranked.kind };
  const previous = map.get(key);
  if (!previous || candidate.score > previous.score) map.set(key, candidate);
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return "";
  return (await response.text()).slice(0, 1_200_000);
}

function parseDuckDuckGo(html: string, query: string, companyName: string, city: string, out: Map<string, PublicCompanyWebCandidate>) {
  for (const match of html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    addCandidate(out, match[1], match[2], query, companyName, city);
  }
}

function parseBing(html: string, query: string, companyName: string, city: string, out: Map<string, PublicCompanyWebCandidate>) {
  for (const match of html.matchAll(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    addCandidate(out, match[1], match[2], query, companyName, city);
  }
}

function parseGoogle(html: string, query: string, companyName: string, city: string, out: Map<string, PublicCompanyWebCandidate>) {
  for (const match of html.matchAll(/<a[^>]+href=["'](\/url\?(?:q|url)=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    addCandidate(out, match[1], match[2], query, companyName, city);
  }
}

export async function searchPublicCompanyWeb(input: { companyName: string; city?: string; country?: string }) {
  const companyName = String(input.companyName || "").trim();
  if (!companyName) return [] as PublicCompanyWebCandidate[];
  const city = String(input.city || "").trim();
  const country = String(input.country || "France").trim();
  const base = `\"${companyName}\" ${city}`.trim();
  const queries = [
    `${base} téléphone`,
    `${base} location réservation`,
    `${base} ${country}`,
  ];
  const candidates = new Map<string, PublicCompanyWebCandidate>();

  for (const query of queries) {
    const encoded = encodeURIComponent(query);
    const searches = [
      { url: `https://html.duckduckgo.com/html/?q=${encoded}&kl=fr-fr`, parser: parseDuckDuckGo },
      { url: `https://www.bing.com/search?q=${encoded}&cc=fr&setlang=fr`, parser: parseBing },
      { url: `https://www.google.com/search?q=${encoded}&hl=fr&gl=fr&num=10&filter=0`, parser: parseGoogle },
    ];
    for (const search of searches) {
      try {
        const html = await fetchHtml(search.url);
        if (html) search.parser(html, query, companyName, city, candidates);
      } catch (error) {
        console.error("Public company web search:", error);
      }
      if (candidates.size >= 6) break;
    }
    if (candidates.size >= 6) break;
  }

  return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 8);
}
