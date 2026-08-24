import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type WebsiteDiscoveryInput = {
  website?: string | null;
  domain?: string | null;
  contactName?: string | null;
};

type Candidate = {
  value: string;
  score: number;
  sourceUrl: string;
  contactMatch: boolean;
};

export type WebsiteContactDiscovery = {
  website: string | null;
  phone: string | null;
  email: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  pagesVisited: string[];
  errors: string[];
};

const CONTACT_PATHS = [
  "/contact",
  "/contactez-nous",
  "/nous-contacter",
  "/equipe",
  "/team",
  "/a-propos",
  "/about",
  "/mentions-legales",
];

function normalizeWebsite(website?: string | null, domain?: string | null) {
  const raw = String(website || domain || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    url.username = "";
    url.password = "";
    return url;
  } catch {
    return null;
  }
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateAddress(address: string) {
  const value = address.toLowerCase();
  if (isIP(value) === 4) return isPrivateIpv4(value);
  if (isIP(value) !== 6) return true;
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("::ffff:")) return isPrivateIpv4(value.slice(7));
  return false;
}

async function assertPublicHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Hôte non public refusé");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("Adresse privée refusée");
    return;
  }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) {
    throw new Error("Le domaine ne résout pas vers une adresse publique");
  }
}

async function fetchHtml(inputUrl: URL) {
  let current = new URL(inputUrl);
  for (let redirect = 0; redirect < 3; redirect += 1) {
    await assertPublicHost(current.hostname);
    const response = await fetch(current, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "GandoContactDiscovery/1.0 (+https://gando.app)",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(6_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      const next = new URL(location, current);
      if (!/^https?:$/.test(next.protocol)) return null;
      current = next;
      continue;
    }

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("html")) return null;
    const length = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(length) && length > 2_000_000) return null;
    const html = (await response.text()).slice(0, 900_000);
    return { url: current, html };
  }
  return null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#43;/g, "+")
    .replace(/&#x2b;/gi, "+")
    .replace(/&commat;/gi, "@");
}

function plainText(html: string) {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedWords(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(word => word.length >= 2);
}

function pageMatchesContact(text: string, contactName?: string | null) {
  const words = normalizedWords(contactName || "");
  if (words.length < 2) return false;
  const normalized = ` ${normalizedWords(text).join(" ")} `;
  return words.every(word => normalized.includes(` ${word} `));
}

function normalizePhone(raw: string) {
  let value = decodeHtml(raw).trim();
  try { value = decodeURIComponent(value); } catch {}
  value = value.replace(/^tel:/i, "").split(/[?#;]/)[0].trim();
  const hasPlus = value.includes("+") || /^00/.test(value);
  const digits = value.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return "";
  if (/^(\d)\1+$/.test(digits)) return "";
  if (digits.length === 14 && !hasPlus && !/[().\s-]/.test(value)) return "";
  if (/^00/.test(value)) return `+${digits.slice(2)}`;
  if (value.includes("+")) return `+${digits}`;
  return value.replace(/\s+/g, " ").trim();
}

function normalizeEmail(raw: string) {
  const value = decodeHtml(raw).replace(/^mailto:/i, "").split(/[?&#]/)[0].trim().toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value) ? value : "";
}

function addCandidate(map: Map<string, Candidate>, candidate: Candidate) {
  if (!candidate.value) return;
  const key = candidate.value.toLowerCase().replace(/\s+/g, "");
  const previous = map.get(key);
  if (!previous || candidate.score > previous.score) map.set(key, candidate);
}

function extractCandidates(url: URL, html: string, contactName?: string | null) {
  const text = plainText(html);
  const contactMatch = pageMatchesContact(text, contactName);
  const pathLooksContact = /contact|equipe|team|about|a-propos|mentions/i.test(url.pathname);
  const phones = new Map<string, Candidate>();
  const emails = new Map<string, Candidate>();
  const pageBoost = pathLooksContact ? 20 : 0;
  const contactBoost = contactMatch ? 55 : 0;

  for (const match of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
    const value = normalizePhone(match[1]);
    addCandidate(phones, { value, score: 120 + pageBoost + contactBoost, sourceUrl: url.toString(), contactMatch });
  }

  for (const match of html.matchAll(/["']telephone["']\s*:\s*["']([^"']+)["']/gi)) {
    const value = normalizePhone(match[1]);
    addCandidate(phones, { value, score: 110 + pageBoost + contactBoost, sourceUrl: url.toString(), contactMatch });
  }

  for (const match of text.matchAll(/(?:\+|00)?\d[\d\s().-]{7,}\d/g)) {
    const value = normalizePhone(match[0]);
    addCandidate(phones, { value, score: 55 + pageBoost + contactBoost, sourceUrl: url.toString(), contactMatch });
  }

  for (const match of html.matchAll(/href\s*=\s*["']mailto:([^"']+)["']/gi)) {
    const value = normalizeEmail(match[1]);
    addCandidate(emails, { value, score: 115 + pageBoost + contactBoost, sourceUrl: url.toString(), contactMatch });
  }

  for (const match of text.matchAll(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const value = normalizeEmail(match[0]);
    addCandidate(emails, { value, score: 65 + pageBoost + contactBoost, sourceUrl: url.toString(), contactMatch });
  }

  return { phones: [...phones.values()], emails: [...emails.values()] };
}

function discoverContactLinks(base: URL, html: string) {
  const links: URL[] = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(decodeHtml(match[1]), base);
      if (!/^https?:$/.test(url.protocol) || url.hostname !== base.hostname) continue;
      if (!/contact|contactez|nous-contacter|equipe|team|about|a-propos|mentions|agence|staff/i.test(url.pathname)) continue;
      url.hash = "";
      links.push(url);
    } catch {}
  }
  return links;
}

export async function discoverPublicWebsiteContacts(input: WebsiteDiscoveryInput): Promise<WebsiteContactDiscovery> {
  const seed = normalizeWebsite(input.website, input.domain);
  if (!seed) {
    return { website: null, phone: null, email: null, contactPhone: null, contactEmail: null, pagesVisited: [], errors: [] };
  }

  const errors: string[] = [];
  const pagesVisited: string[] = [];
  const phoneCandidates = new Map<string, Candidate>();
  const emailCandidates = new Map<string, Candidate>();

  let home: Awaited<ReturnType<typeof fetchHtml>> = null;
  try {
    home = await fetchHtml(seed);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (!home && seed.protocol === "https:") {
    try {
      const httpSeed = new URL(seed);
      httpSeed.protocol = "http:";
      home = await fetchHtml(httpSeed);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (!home) {
    return { website: seed.toString(), phone: null, email: null, contactPhone: null, contactEmail: null, pagesVisited, errors };
  }

  const collect = (page: { url: URL; html: string }) => {
    pagesVisited.push(page.url.toString());
    const extracted = extractCandidates(page.url, page.html, input.contactName);
    for (const candidate of extracted.phones) addCandidate(phoneCandidates, candidate);
    for (const candidate of extracted.emails) addCandidate(emailCandidates, candidate);
  };

  collect(home);

  const discovered = discoverContactLinks(home.url, home.html);
  const common = CONTACT_PATHS.map(path => new URL(path, home!.url));
  const uniquePages = [...discovered, ...common]
    .filter((url, index, all) => all.findIndex(other => other.toString() === url.toString()) === index)
    .filter(url => url.toString() !== home!.url.toString())
    .slice(0, 4);

  const extraPages = await Promise.all(uniquePages.map(async url => {
    try {
      return await fetchHtml(url);
    } catch (error) {
      errors.push(`${url.pathname}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }));
  for (const page of extraPages) if (page) collect(page);

  const phones = [...phoneCandidates.values()].sort((a, b) => b.score - a.score);
  const emails = [...emailCandidates.values()].sort((a, b) => b.score - a.score);
  const contactPhone = phones.find(candidate => candidate.contactMatch)?.value || null;
  const contactEmail = emails.find(candidate => candidate.contactMatch)?.value || null;

  return {
    website: home.url.toString(),
    phone: phones[0]?.value || null,
    email: emails[0]?.value || null,
    contactPhone,
    contactEmail,
    pagesVisited,
    errors: [...new Set(errors)].slice(0, 8),
  };
}
