import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
import { searchRentalCompaniesWithApifyDirect } from "@/lib/apify-direct";
import { searchCompanyWebCandidates } from "@/lib/apify-company-web-search";
import { searchPublicCompanyWeb } from "@/lib/public-company-web-search";
import { discoverPublicWebsiteContacts } from "@/lib/website-contact-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com",
  "icloud.com", "orange.fr", "wanadoo.fr", "free.fr",
]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeWebsite(value = "") {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function domainFromEmail(value = "") {
  const email = clean(value).toLowerCase();
  if (!email.includes("@")) return "";
  const domain = email.split("@").pop() || "";
  return domain && !PERSONAL_EMAIL_DOMAINS.has(domain) ? domain : "";
}

function scoreProspect(prospect: any, companyName: string, city: string) {
  const normalize = (value = "") => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const a = normalize(companyName);
  const b = normalize(prospect?.companyName || prospect?.legalName || "");
  let score = 0;
  if (a && b && a === b) score += 120;
  else if (a && b && (a.includes(b) || b.includes(a))) score += 80;
  if (city && normalize(city) === normalize(prospect?.city || "")) score += 25;
  if (prospect?.website) score += 20;
  if (prospect?.phone) score += 15;
  return score;
}

async function searchPublicCompanyWebsite(companyName: string, city: string, country: string) {
  if (!companyName) return null;
  try {
    const result = await searchRentalCompaniesWithApifyDirect({
      query: companyName,
      territories: [[city, country].filter(Boolean).join(", ") || "France"],
      limit: 8,
      apifyLimit: 80,
      apifyContactsPerCompany: 3,
      apifyPollWaitSeconds: 12,
    });
    const ranked = (result.prospects || [])
      .map(prospect => ({ prospect, score: scoreProspect(prospect, companyName, city) }))
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.score >= 65 ? ranked[0].prospect : null;
  } catch (error) {
    console.error("Company website discovery via Apify Maps:", error);
    return null;
  }
}

async function readAssociatedContactWebsite(company: any) {
  const ids = (company?.associations?.contacts?.results || [])
    .map((row: any) => String(row?.id || ""))
    .filter(Boolean)
    .slice(0, 20);
  if (!ids.length) return { website: "", domain: "", source: "" };

  const batch = await hubspotJson("/crm/v3/objects/contacts/batch/read", {
    method: "POST",
    body: JSON.stringify({
      properties: ["website", "email"],
      inputs: ids.map((id: string) => ({ id })),
    }),
  });

  for (const contact of batch.results || []) {
    const website = normalizeWebsite(contact?.properties?.website || "");
    if (website) return { website, domain: normalizeDomain(website), source: "contact_website" };
  }
  for (const contact of batch.results || []) {
    const domain = domainFromEmail(contact?.properties?.email || "");
    if (domain) return { website: `https://${domain}`, domain, source: "contact_email_domain" };
  }
  return { website: "", domain: "", source: "" };
}

async function crawlCandidateForPhone(url: string) {
  try {
    const discovery = await discoverPublicWebsiteContacts({ website: url });
    return {
      website: normalizeWebsite(discovery.website || url),
      phone: clean(discovery.phone || discovery.contactPhone),
      pagesVisited: discovery.pagesVisited,
    };
  } catch (error) {
    console.error("Candidate website crawl:", error);
    return { website: normalizeWebsite(url), phone: "", pagesVisited: [] as string[] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const companyId = clean(input.companyId);
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const company = await hubspotJson(
      `/crm/v3/objects/companies/${encodeURIComponent(companyId)}?properties=name,domain,website,phone,city,country,address&associations=contacts`,
    );
    const properties = company?.properties || {};
    const companyName = clean(properties.name);
    const city = clean(properties.city);
    const country = clean(properties.country) || "France";

    let website = normalizeWebsite(properties.website || "");
    let domain = normalizeDomain(properties.domain || website || "");
    let source = website ? "company_website" : domain ? "company_domain" : "";
    let discoveredPhone = "";
    let pagesVisited: string[] = [];
    let webCandidates: Array<{ url: string; title: string; score: number; kind: string }> = [];

    if (!website && domain) website = `https://${domain}`;

    if (!website) {
      const associated = await readAssociatedContactWebsite(company);
      website = associated.website;
      domain = domain || associated.domain;
      source = associated.source;
    }

    if (!website || !clean(properties.phone)) {
      const prospect = await searchPublicCompanyWebsite(companyName, city, country);
      const searchedWebsite = normalizeWebsite(prospect?.website || "");
      if (!website && searchedWebsite) {
        website = searchedWebsite;
        domain = domain || normalizeDomain(searchedWebsite);
        source = "apify_google_places";
      }
      discoveredPhone = clean(prospect?.phone);
    }

    if (website && !clean(properties.phone) && !discoveredPhone) {
      const crawled = await crawlCandidateForPhone(website);
      discoveredPhone = crawled.phone;
      pagesVisited = crawled.pagesVisited;
      if (crawled.website) website = crawled.website;
      if (discoveredPhone) source = source || "website_crawl";
    }

    if ((!website || (!clean(properties.phone) && !discoveredPhone)) && companyName) {
      const [apifyCandidates, publicCandidates] = await Promise.all([
        searchCompanyWebCandidates({ companyName, city, country }),
        searchPublicCompanyWeb({ companyName, city, country }),
      ]);
      const byUrl = new Map<string, (typeof apifyCandidates)[number] | (typeof publicCandidates)[number]>();
      for (const candidate of [...apifyCandidates, ...publicCandidates]) {
        const key = candidate.url.toLowerCase().replace(/\/$/, "");
        const previous = byUrl.get(key);
        if (!previous || candidate.score > previous.score) byUrl.set(key, candidate);
      }
      const candidates = [...byUrl.values()].sort((a, b) => b.score - a.score).slice(0, 10);
      webCandidates = candidates.map(candidate => ({ url: candidate.url, title: candidate.title, score: candidate.score, kind: candidate.kind }));

      for (const candidate of candidates.slice(0, 5)) {
        const crawled = await crawlCandidateForPhone(candidate.url);
        if (!website && candidate.kind !== "directory" && crawled.website) {
          website = crawled.website;
          domain = domain || normalizeDomain(crawled.website);
          source = candidate.kind === "booking" ? "google_web_booking" : "google_web_official";
        }
        if (!discoveredPhone && crawled.phone) {
          discoveredPhone = crawled.phone;
          pagesVisited = crawled.pagesVisited;
          if (!website && crawled.website) {
            website = crawled.website;
            domain = domain || normalizeDomain(crawled.website);
          }
          source = candidate.kind === "booking" ? "google_web_booking" : "google_web_search";
          break;
        }
      }
    }

    const patch: Record<string, string> = {};
    if (!clean(properties.website) && website) patch.website = website;
    if (!clean(properties.domain) && domain) patch.domain = domain;
    if (!clean(properties.phone) && discoveredPhone) patch.phone = discoveredPhone;

    if (Object.keys(patch).length) {
      await hubspotJson(`/crm/v3/objects/companies/${encodeURIComponent(companyId)}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: patch }),
      });
    }

    return NextResponse.json({
      ok: true,
      companyId,
      companyName,
      website: website || null,
      domain: domain || null,
      phone: clean(properties.phone) || discoveredPhone || null,
      phoneFound: Boolean(clean(properties.phone) || discoveredPhone),
      source: source || "not_found",
      updatedFields: Object.keys(patch),
      pagesVisited,
      webCandidates,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error instanceof Error ? error : new Error(String(error)));
  }
}
