import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
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
    if (website) {
      return { website, domain: normalizeDomain(website), source: "contact_website" };
    }
  }

  for (const contact of batch.results || []) {
    const domain = domainFromEmail(contact?.properties?.email || "");
    if (domain) {
      return { website: `https://${domain}`, domain, source: "contact_email_domain" };
    }
  }

  return { website: "", domain: "", source: "" };
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const companyId = clean(input.companyId);
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const company = await hubspotJson(
      `/crm/v3/objects/companies/${encodeURIComponent(companyId)}?properties=name,domain,website&associations=contacts`,
    );
    const properties = company?.properties || {};

    let website = normalizeWebsite(properties.website || "");
    let domain = normalizeDomain(properties.domain || website || "");
    let source = website ? "company_website" : domain ? "company_domain" : "";

    if (!website && domain) website = `https://${domain}`;

    if (!website) {
      const associated = await readAssociatedContactWebsite(company);
      website = associated.website;
      domain = domain || associated.domain;
      source = associated.source;
    }

    const patch: Record<string, string> = {};
    if (!clean(properties.website) && website) patch.website = website;
    if (!clean(properties.domain) && domain) patch.domain = domain;

    if (Object.keys(patch).length) {
      await hubspotJson(`/crm/v3/objects/companies/${encodeURIComponent(companyId)}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: patch }),
      });
    }

    return NextResponse.json({
      ok: true,
      companyId,
      companyName: properties.name || "",
      website: website || null,
      domain: domain || null,
      source: source || "not_found",
      updatedFields: Object.keys(patch),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error instanceof Error ? error : new Error(String(error)));
  }
}
