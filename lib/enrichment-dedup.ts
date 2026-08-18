import { hubspotJson } from "@/lib/hubspot";

export type SourcingProspect = {
  companyName: string;
  city?: string;
  territory?: string;
  country?: string;
  website?: string;
  domain?: string;
  phone?: string;
  publicBusinessEmail?: string;
  sourceUrls?: string[];
  sourceTypes?: string[];
  evidence?: string;
  confidence?: number;
  gandoScore?: number;
  qualificationReason?: string;
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

export async function listHubSpotCompaniesForSourcing(): Promise<HubSpotCompany[]> {
  const companies: HubSpotCompany[] = [];
  let after: string | undefined;
  do {
    const query = new URLSearchParams({
      limit: "100",
      properties: "name,domain,website,phone,city,zip,country",
    });
    if (after) query.set("after", after);
    const page = await hubspotJson(`/crm/objects/2026-03/companies?${query}`);
    for (const row of page.results || []) {
      companies.push({ id: String(row.id), ...(row.properties || {}) });
    }
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
  const seen = new Set<string>();
  const unique: SourcingProspect[] = [];
  for (const prospect of prospects) {
    if (!prospect?.companyName || !Array.isArray(prospect.sourceUrls) || prospect.sourceUrls.length === 0) continue;
    const key = `${normalizeText(prospect.companyName)}|${normalizeDomain(prospect.domain || prospect.website || "")}|${normalizePhone(prospect.phone || "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(prospect);
  }

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
