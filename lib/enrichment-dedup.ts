import { hubspotJson } from "@/lib/hubspot";

export type SourcingContact = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  sourceProvider?: string;
  confidence?: number;
};

export type SourcingProspect = {
  companyName: string;
  legalName?: string | null;
  siren?: string | null;
  siret?: string | null;
  city?: string | null;
  postalCode?: string | null;
  address?: string | null;
  territory?: string | null;
  country?: string | null;
  website?: string | null;
  domain?: string | null;
  phone?: string | null;
  publicBusinessEmail?: string | null;
  sourceUrls?: string[];
  sourceTypes?: string[];
  sourceProviders?: string[];
  evidence?: string | null;
  confidence?: number;
  gandoScore?: number;
  qualificationReason?: string | null;
  contacts?: SourcingContact[];
  inpiStatus?: string;
  inpiVerified?: boolean;
};

type HubSpotCompany = {
  id: string;
  name?: string;
  domain?: string;
  website?: string;
  phone?: string;
  city?: string;
};

function normalizeText(value = "") {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function normalizePhone(value = "") {
  return value.replace(/\D/g, "").replace(/^33/, "0");
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

function similarity(a: string, b: string) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) / Math.max(x.length, y.length);
  const pairs = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const px = pairs(x);
  const py = pairs(y);
  let overlap = 0;
  for (const p of px) if (py.has(p)) overlap += 1;
  return (2 * overlap) / Math.max(1, px.size + py.size);
}

function sameCompany(left: SourcingProspect, right: SourcingProspect) {
  const leftSiren = String(left.siren || "").replace(/\D/g, "");
  const rightSiren = String(right.siren || "").replace(/\D/g, "");
  if (leftSiren.length === 9 && rightSiren.length === 9 && leftSiren === rightSiren) return true;

  const leftDomain = normalizeDomain(left.domain || left.website || "");
  const rightDomain = normalizeDomain(right.domain || right.website || "");
  if (leftDomain && rightDomain && leftDomain === rightDomain) return true;

  const leftPhone = normalizePhone(left.phone || "");
  const rightPhone = normalizePhone(right.phone || "");
  if (leftPhone.length >= 8 && rightPhone.length >= 8 && leftPhone === rightPhone) return true;

  const nameScore = similarity(left.companyName || left.legalName || "", right.companyName || right.legalName || "");
  const leftCity = normalizeText(left.city || "");
  const rightCity = normalizeText(right.city || "");
  return nameScore >= 0.97 || (nameScore >= 0.82 && Boolean(leftCity) && leftCity === rightCity);
}

function contactKey(contact: SourcingContact) {
  return (contact.email || "").trim().toLowerCase()
    || (contact.linkedinUrl || "").trim().toLowerCase()
    || `${normalizeText(contact.fullName || `${contact.firstName || ""} ${contact.lastName || ""}`)}|${normalizeText(contact.jobTitle || "")}`;
}

function mergeContacts(left: SourcingContact[] = [], right: SourcingContact[] = []) {
  const map = new Map<string, SourcingContact>();
  for (const contact of [...left, ...right]) {
    const key = contactKey(contact);
    if (!key) continue;
    const previous = map.get(key) || {};
    map.set(key, {
      ...previous,
      ...contact,
      firstName: contact.firstName || previous.firstName,
      lastName: contact.lastName || previous.lastName,
      fullName: contact.fullName || previous.fullName,
      jobTitle: contact.jobTitle || previous.jobTitle,
      email: contact.email || previous.email,
      phone: contact.phone || previous.phone,
      linkedinUrl: contact.linkedinUrl || previous.linkedinUrl,
      confidence: Math.max(Number(contact.confidence) || 0, Number(previous.confidence) || 0),
    });
  }
  return [...map.values()].sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0));
}

function first<T>(left: T | null | undefined, right: T | null | undefined) {
  return left !== undefined && left !== null && left !== "" ? left : right;
}

export function mergeSourcingProspects(left: SourcingProspect, right: SourcingProspect): SourcingProspect {
  const contacts = mergeContacts(left.contacts, right.contacts);
  const providers = [...new Set([...(left.sourceProviders || []), ...(right.sourceProviders || [])])];
  return {
    ...right,
    ...left,
    companyName: first(left.companyName, right.companyName) || right.companyName,
    legalName: first(left.legalName, right.legalName),
    siren: first(left.siren, right.siren),
    siret: first(left.siret, right.siret),
    city: first(left.city, right.city),
    postalCode: first(left.postalCode, right.postalCode),
    address: first(left.address, right.address),
    territory: first(left.territory, right.territory),
    country: first(left.country, right.country),
    website: first(left.website, right.website),
    domain: first(left.domain, right.domain),
    phone: first(left.phone, right.phone),
    publicBusinessEmail: first(left.publicBusinessEmail, right.publicBusinessEmail),
    sourceUrls: [...new Set([...(left.sourceUrls || []), ...(right.sourceUrls || [])])],
    sourceTypes: [...new Set([...(left.sourceTypes || []), ...(right.sourceTypes || [])])],
    sourceProviders: providers,
    contacts,
    evidence: [left.evidence, right.evidence].filter(Boolean).join(" | ") || null,
    qualificationReason: [left.qualificationReason, right.qualificationReason].filter(Boolean).join(" | ") || null,
    confidence: Math.min(0.99, Math.max(Number(left.confidence) || 0, Number(right.confidence) || 0) + (providers.length > 1 ? 0.04 : 0)),
    gandoScore: Math.min(100, Math.max(Number(left.gandoScore) || 0, Number(right.gandoScore) || 0) + (contacts.length ? 5 : 0) + (providers.length > 1 ? 5 : 0)),
    inpiStatus: left.inpiStatus || right.inpiStatus,
    inpiVerified: Boolean(left.inpiVerified || right.inpiVerified),
  };
}

export function mergeSourcingCandidates(prospects: SourcingProspect[]) {
  const merged: SourcingProspect[] = [];
  for (const prospect of prospects) {
    if (!prospect?.companyName) continue;
    const index = merged.findIndex(existing => sameCompany(existing, prospect));
    if (index === -1) merged.push(prospect);
    else merged[index] = mergeSourcingProspects(merged[index], prospect);
  }
  return merged;
}

export async function listHubSpotCompaniesForSourcing(): Promise<HubSpotCompany[]> {
  const companies: HubSpotCompany[] = [];
  let after: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100", properties: "name,domain,website,phone,city,zip,country" });
    if (after) query.set("after", after);
    const page = await hubspotJson(`/crm/objects/2026-03/companies?${query}`);
    for (const row of page.results || []) companies.push({ id: String(row.id), ...(row.properties || {}) });
    after = page.paging?.next?.after;
  } while (after);
  return companies;
}

export function findSourcingDuplicate(prospect: SourcingProspect, companies: HubSpotCompany[]) {
  const pDomain = normalizeDomain(prospect.domain || prospect.website || "");
  const pPhone = normalizePhone(prospect.phone || "");
  const pName = prospect.companyName || "";
  const pCity = normalizeText(prospect.city || "");

  for (const company of companies) {
    const cDomain = normalizeDomain(company.domain || company.website || "");
    if (pDomain && cDomain && pDomain === cDomain) return { company, reason: "domain" };
    const cPhone = normalizePhone(company.phone || "");
    if (pPhone && cPhone && pPhone.length >= 8 && pPhone === cPhone) return { company, reason: "phone" };
    const nameScore = similarity(pName, company.name || "");
    const cCity = normalizeText(company.city || "");
    if (nameScore >= 0.97) return { company, reason: "name" };
    if (nameScore >= 0.82 && pCity && cCity && pCity === cCity) return { company, reason: "name_city" };
  }
  return null;
}

export function dedupeSourcingCandidates(prospects: SourcingProspect[], companies: HubSpotCompany[], limit: number, minConfidence: number) {
  const unique = mergeSourcingCandidates(prospects).filter(prospect => Array.isArray(prospect.sourceUrls) && prospect.sourceUrls.length > 0);
  const fresh: SourcingProspect[] = [];
  const excluded: Array<{ companyName: string; hubspotCompanyId: string; reason: string }> = [];
  for (const prospect of unique) {
    if ((Number(prospect.confidence) || 0) < minConfidence) continue;
    const duplicate = findSourcingDuplicate(prospect, companies);
    if (duplicate) {
      excluded.push({ companyName: prospect.companyName, hubspotCompanyId: duplicate.company.id, reason: duplicate.reason });
      continue;
    }
    fresh.push(prospect);
  }
  fresh.sort((a, b) => (Number(b.gandoScore) || 0) - (Number(a.gandoScore) || 0));
  return { unique, prospects: fresh.slice(0, limit), excluded };
}
