import { getSupabaseAdmin } from "@/lib/supabase-admin";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const DEFAULT_ACTOR_ID = "compass~crawler-google-places";
const DATASET_FIELDS = [
  "title", "name", "website", "websiteUrl", "domain", "phone", "phoneUnformatted", "phoneNumber",
  "phones", "websitePhones", "emails", "email", "businessEmail", "city", "postalCode", "zip", "address",
  "country", "countryName", "url", "googleMapsUrl", "placeId", "cid", "leadsEnrichment", "contacts",
  "personId", "firstName", "lastName", "fullName", "linkedinProfile", "linkedinUrl", "mobileNumber",
  "mobilePhone", "jobTitle", "headline", "position", "role", "companyName", "companyWebsite",
  "companyPhoneNumber", "companyCity", "emailVerification", "totalScore", "rating", "reviewsCount", "reviewCount",
].join(",");

export type DirectApifyContact = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  sourceProvider: "apify";
  confidence: number;
};

export type DirectApifyProspect = {
  companyName: string;
  legalName?: string | null;
  city?: string | null;
  postalCode?: string | null;
  address?: string | null;
  territory?: string | null;
  country?: string | null;
  website?: string | null;
  domain?: string | null;
  phone?: string | null;
  publicBusinessEmail?: string | null;
  sourceUrls: string[];
  sourceTypes: string[];
  sourceProviders: string[];
  evidence?: string | null;
  confidence: number;
  gandoScore: number;
  qualificationReason?: string | null;
  contacts: DirectApifyContact[];
};

export type DirectApifyRunRef = {
  runId: string;
  datasetId?: string;
  territory?: string;
  status?: string;
  pending?: boolean;
};

export type DirectApifyResult = {
  configured: boolean;
  actorId: string;
  prospects: DirectApifyProspect[];
  rawItems: number;
  runs: Array<DirectApifyRunRef & { items?: number; prospects?: number }>;
  errors: string[];
};

type DirectApifyInput = {
  query?: string;
  territories?: string[];
  limit?: number;
  apifyLimit?: number;
  apifyContactsPerCompany?: number;
  apifyRunRefs?: DirectApifyRunRef[];
  apifyPollWaitSeconds?: number;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const resolved = text(value);
    if (resolved) return resolved;
  }
  return undefined;
}

function firstArrayString(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    if (typeof item === "string" && item.trim()) return item.trim();
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const resolved = firstString(record.value, record.phone, record.email, record.url, record.link);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

function normalizeText(value = "") {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function normalizeDomain(value = "") {
  if (!value) return "";
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function similarity(a = "", b = "") {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) / Math.max(x.length, y.length);
  const pairs = (value: string) => {
    const output = new Set<string>();
    for (let index = 0; index < value.length - 1; index += 1) output.add(value.slice(index, index + 2));
    return output;
  };
  const left = pairs(x);
  const right = pairs(y);
  let overlap = 0;
  for (const pair of left) if (right.has(pair)) overlap += 1;
  return (2 * overlap) / Math.max(1, left.size + right.size);
}

async function getApifyToken() {
  const envToken = process.env.APIFY_API_TOKEN?.trim();
  if (envToken) return envToken;
  try {
    const { data, error } = await getSupabaseAdmin().rpc("get_server_secret", { p_name: "apify_api_token" });
    if (error) throw error;
    return typeof data === "string" ? data.trim() : "";
  } catch (error) {
    console.error("Unable to resolve Apify token from Vault", error);
    return "";
  }
}

async function apifyRequest(path: string, token: string, options: { method?: string; body?: unknown; timeoutMs?: number } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(options.timeoutMs || 15_000, 1_000));
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
    let payload: any = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`Apify ${response.status}: réponse JSON invalide`);
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || response.statusText || "Apify request failed";
      throw new Error(`Apify ${response.status}: ${message}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function isStandaloneLead(row: any) {
  return Boolean(
    row && typeof row === "object" &&
    (row.personId || row.companyWebsite || row.linkedinProfile || row.linkedinUrl) &&
    (row.fullName || row.firstName || row.lastName || row.jobTitle || row.email || row.mobileNumber),
  );
}

function normalizeLead(row: any): (DirectApifyContact & { companyName?: string; companyWebsite?: string; companyCity?: string }) | null {
  if (!row || typeof row !== "object") return null;
  const fullName = firstString(row.fullName, [row.firstName, row.lastName].filter(Boolean).join(" "));
  const email = firstString(row.email, row.workEmail, row.businessEmail);
  const phone = firstString(row.mobileNumber, row.mobilePhone, row.phone, row.phoneNumber);
  const linkedinUrl = firstString(row.linkedinProfile, row.linkedinUrl, row.linkedinProfileUrl);
  const jobTitle = firstString(row.jobTitle, row.headline, row.position, row.role);
  if (!fullName && !email && !linkedinUrl) return null;

  let confidence = 0.7;
  if (jobTitle) confidence += 0.08;
  if (linkedinUrl) confidence += 0.08;
  if (email) confidence += 0.06;
  if (phone) confidence += 0.05;
  if (row.emailVerification?.result === "ok") confidence += 0.02;

  return {
    firstName: firstString(row.firstName),
    lastName: firstString(row.lastName),
    fullName,
    jobTitle,
    email,
    phone,
    linkedinUrl,
    sourceProvider: "apify",
    confidence: Math.min(confidence, 0.98),
    companyName: firstString(row.companyName),
    companyWebsite: firstString(row.companyWebsite),
    companyCity: firstString(row.companyCity),
  };
}

function inlineContacts(row: any, domain: string) {
  const buckets = [row?.leadsEnrichment, row?.contacts];
  const raw = buckets.flatMap(bucket => Array.isArray(bucket) ? bucket : bucket && typeof bucket === "object" ? [bucket] : []);
  const contacts: DirectApifyContact[] = [];
  for (const item of raw) {
    const lead = normalizeLead(item);
    if (!lead) continue;
    const emailDomain = lead.email?.includes("@") ? lead.email.split("@").pop()?.toLowerCase() || "" : "";
    if (!lead.jobTitle && !lead.linkedinUrl && !(domain && emailDomain === domain)) continue;
    contacts.push(lead);
  }
  return dedupeContacts(contacts);
}

function dedupeContacts(contacts: DirectApifyContact[]) {
  const map = new Map<string, DirectApifyContact>();
  for (const contact of contacts) {
    const key = (contact.email || "").toLowerCase()
      || (contact.linkedinUrl || "").toLowerCase()
      || `${normalizeText(contact.fullName || "")}|${normalizeText(contact.jobTitle || "")}`;
    if (!key) continue;
    const previous = map.get(key);
    map.set(key, previous ? {
      ...previous,
      ...contact,
      phone: contact.phone || previous.phone,
      email: contact.email || previous.email,
      linkedinUrl: contact.linkedinUrl || previous.linkedinUrl,
      jobTitle: contact.jobTitle || previous.jobTitle,
      confidence: Math.max(contact.confidence, previous.confidence),
    } : contact);
  }
  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}

function normalizePlace(row: any, territory?: string): DirectApifyProspect | null {
  if (!row || typeof row !== "object" || isStandaloneLead(row)) return null;
  const companyName = firstString(row.title, row.name);
  if (!companyName) return null;
  const website = firstString(row.website, row.websiteUrl);
  const domain = normalizeDomain(website || firstString(row.domain) || "");
  const phone = firstString(row.phone, row.phoneUnformatted, row.phoneNumber, firstArrayString(row.websitePhones), firstArrayString(row.phones));
  const publicBusinessEmail = firstString(row.email, row.businessEmail, firstArrayString(row.emails));
  const googleMapsUrl = firstString(row.url, row.googleMapsUrl);
  const sourceUrls = [...new Set([googleMapsUrl, website].filter(Boolean) as string[])];
  if (!sourceUrls.length) return null;
  const contacts = inlineContacts(row, domain);
  const rating = Number(row.totalScore ?? row.rating);
  const reviewCount = Number(row.reviewsCount ?? row.reviewCount);

  let confidence = 0.68;
  let score = 55;
  if (website) { confidence += 0.08; score += 8; }
  if (phone) { confidence += 0.06; score += 7; }
  if (publicBusinessEmail) { confidence += 0.06; score += 6; }
  if (contacts.length) { confidence += 0.08; score += 12; }
  if (Number.isFinite(reviewCount) && reviewCount >= 10) score += 4;
  if (Number.isFinite(rating) && rating >= 4) score += 3;

  return {
    companyName,
    legalName: null,
    city: firstString(row.city) || null,
    postalCode: firstString(row.postalCode, row.zip) || null,
    address: firstString(row.address) || null,
    territory: territory || null,
    country: firstString(row.country, row.countryName) || "France",
    website: website || null,
    domain: domain || null,
    phone: phone || null,
    publicBusinessEmail: publicBusinessEmail || null,
    sourceUrls,
    sourceTypes: ["google"],
    sourceProviders: ["apify"],
    evidence: "Entreprise trouvée sur Google Maps et enrichie via Apify.",
    confidence: Math.min(confidence, 0.96),
    gandoScore: Math.min(score, 100),
    qualificationReason: contacts.length
      ? `${contacts.length} contact(s) professionnel(s) enrichi(s) via Apify.`
      : "Coordonnées publiques issues de Google Maps via Apify.",
    contacts,
  };
}

function leadScore(prospect: DirectApifyProspect, lead: DirectApifyContact & { companyName?: string; companyWebsite?: string; companyCity?: string }) {
  let score = 0;
  const companyDomain = normalizeDomain(prospect.domain || prospect.website || "");
  const leadDomain = normalizeDomain(lead.companyWebsite || "");
  if (companyDomain && leadDomain && companyDomain === leadDomain) score += 140;
  score += similarity(prospect.companyName, lead.companyName || "") * 90;
  if (normalizeText(prospect.city || "") && normalizeText(prospect.city || "") === normalizeText(lead.companyCity || "")) score += 20;
  return score;
}

function attachStandaloneLeads(prospects: DirectApifyProspect[], rows: any[]) {
  const leads = rows.filter(isStandaloneLead).map(normalizeLead).filter(Boolean) as Array<DirectApifyContact & { companyName?: string; companyWebsite?: string; companyCity?: string }>;
  for (const lead of leads) {
    let best: DirectApifyProspect | null = null;
    let bestScore = 0;
    for (const prospect of prospects) {
      const score = leadScore(prospect, lead);
      if (score > bestScore) { best = prospect; bestScore = score; }
    }
    if (!best || bestScore < 70) continue;
    best.contacts = dedupeContacts([...best.contacts, lead]);
    if (!best.phone && (lead as any).companyPhoneNumber) best.phone = (lead as any).companyPhoneNumber;
    best.gandoScore = Math.min(100, Math.max(best.gandoScore, 72 + Math.min(best.contacts.length * 4, 16)));
    best.confidence = Math.min(0.98, Math.max(best.confidence, 0.82));
  }
  return prospects;
}

async function startRun(token: string, actorId: string, territory: string, actorInput: Record<string, unknown>): Promise<DirectApifyRunRef> {
  const payload = await apifyRequest(`/actors/${encodeURIComponent(actorId)}/runs`, token, { method: "POST", body: actorInput });
  const run = payload?.data || payload;
  if (!run?.id || !run?.defaultDatasetId) throw new Error("Apify n'a pas retourné de runId/datasetId");
  return { runId: String(run.id), datasetId: String(run.defaultDatasetId), territory, status: String(run.status || "READY"), pending: true };
}

async function collectRun(token: string, ref: DirectApifyRunRef, waitSeconds: number, maxItems: number) {
  const params = new URLSearchParams();
  if (waitSeconds > 0) params.set("waitForFinish", String(waitSeconds));
  const runPayload = await apifyRequest(`/actor-runs/${encodeURIComponent(ref.runId)}?${params}`, token, { timeoutMs: Math.max(15_000, (waitSeconds + 5) * 1000) });
  const run = runPayload?.data || runPayload;
  const datasetId = String(run?.defaultDatasetId || ref.datasetId || "");
  const status = String(run?.status || ref.status || "UNKNOWN");
  const datasetParams = new URLSearchParams({ format: "json", clean: "true", limit: String(Math.min(Math.max(maxItems, 50), 1200)), fields: DATASET_FIELDS });
  const rows = datasetId ? await apifyRequest(`/datasets/${encodeURIComponent(datasetId)}/items?${datasetParams}`, token, { timeoutMs: 20_000 }) : [];
  const items = Array.isArray(rows) ? rows : [];
  const prospects = attachStandaloneLeads(items.map(row => normalizePlace(row, ref.territory)).filter(Boolean) as DirectApifyProspect[], items);
  return {
    run: { runId: ref.runId, datasetId, territory: ref.territory, status, pending: ["READY", "RUNNING"].includes(status.toUpperCase()), items: items.length, prospects: prospects.length },
    prospects,
    rawItems: items.length,
  };
}

export async function searchRentalCompaniesWithApifyDirect(input: DirectApifyInput = {}): Promise<DirectApifyResult> {
  const token = await getApifyToken();
  const actorId = (process.env.APIFY_GOOGLE_MAPS_ACTOR_ID || DEFAULT_ACTOR_ID).replace("/", "~");
  if (!token) return { configured: false, actorId, prospects: [], rawItems: 0, runs: [], errors: ["Token Apify serveur indisponible"] };

  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
  const maxItems = Math.min(Math.max(Number(input.apifyLimit) || Math.max(limit * 4, 100), 50), 1200);
  const contactsPerCompany = Math.min(Math.max(Number(input.apifyContactsPerCompany) || 3, 1), 5);

  let refs = (input.apifyRunRefs || []).filter(ref => ref?.runId).slice(0, 12);
  const errors: string[] = [];
  if (!refs.length) {
    const territories = input.territories?.length ? input.territories.slice(0, 6) : ["France métropolitaine"];
    const terms = [...new Set([input.query?.trim(), "location de voiture", "location de véhicules", "location utilitaire"].filter(Boolean) as string[])].slice(0, 4);
    const perSearch = Math.max(2, Math.ceil(maxItems / Math.max(1, territories.length * terms.length)));
    const starts = await Promise.allSettled(territories.map(territory => startRun(token, actorId, territory, {
      searchStringsArray: terms,
      locationQuery: territory,
      maxCrawledPlacesPerSearch: perSearch,
      language: "fr",
      skipClosedPlaces: true,
      scrapePlaceDetailPage: true,
      scrapeContacts: true,
      maximumLeadsEnrichmentRecords: contactsPerCompany,
      verifyLeadsEnrichmentEmails: true,
      scrapeSocialMediaProfiles: { facebooks: false, instagrams: false, youtubes: false, tiktoks: false, twitters: false },
    })));
    refs = [];
    for (const result of starts) {
      if (result.status === "fulfilled") refs.push(result.value);
      else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  const waitSeconds = input.apifyRunRefs?.length
    ? Math.min(Math.max(Number(input.apifyPollWaitSeconds) || 0, 0), 20)
    : 12;
  const settled = await Promise.allSettled(refs.map(ref => collectRun(token, ref, waitSeconds, maxItems)));
  const prospects: DirectApifyProspect[] = [];
  const runs: DirectApifyResult["runs"] = [];
  let rawItems = 0;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      prospects.push(...result.value.prospects);
      runs.push(result.value.run);
      rawItems += result.value.rawItems;
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  return { configured: true, actorId, prospects, rawItems, runs, errors };
}
