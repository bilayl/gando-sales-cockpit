import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
import { searchRentalCompaniesWithApifyDirect, type DirectApifyProspect, type DirectApifyRunRef } from "@/lib/apify-direct";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type EntityType = "company" | "contact";

type EnrichedContact = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  confidence?: number;
};

type Prospect = {
  companyName?: string;
  legalName?: string | null;
  domain?: string | null;
  website?: string | null;
  phone?: string | null;
  publicBusinessEmail?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  address?: string | null;
  contacts?: EnrichedContact[];
  sourceProviders?: string[];
  confidence?: number;
  gandoScore?: number;
};

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
    const out = new Set<string>();
    for (let i = 0; i < value.length - 1; i++) out.add(value.slice(i, i + 2));
    return out;
  };
  const px = pairs(x);
  const py = pairs(y);
  let overlap = 0;
  for (const pair of px) if (py.has(pair)) overlap += 1;
  return (2 * overlap) / Math.max(1, px.size + py.size);
}

function domainFromEmail(value?: string) {
  if (!value || !value.includes("@")) return "";
  const domain = value.split("@").pop()?.trim().toLowerCase() || "";
  return ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "orange.fr", "wanadoo.fr"].includes(domain) ? "" : domain;
}

function cleanProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => typeof value === "string" && value.trim()));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function targetScore(prospect: DirectApifyProspect, target: Record<string, unknown>) {
  let score = 0;
  const targetDomain = normalizeDomain(stringValue(target.domain) || stringValue(target.website));
  const prospectDomain = normalizeDomain(prospect.domain || prospect.website || "");
  if (targetDomain && prospectDomain && targetDomain === prospectDomain) score += 140;

  score += similarity(stringValue(target.companyName), prospect.companyName || prospect.legalName || "") * 90;

  const targetCity = normalizeText(stringValue(target.city));
  const prospectCity = normalizeText(prospect.city || "");
  if (targetCity && prospectCity && targetCity === prospectCity) score += 20;

  const targetPhone = stringValue(target.phone).replace(/\D/g, "");
  const prospectPhone = String(prospect.phone || "").replace(/\D/g, "");
  if (targetPhone.length >= 8 && prospectPhone.length >= 8 && targetPhone === prospectPhone) score += 80;
  if (prospect.contacts?.length) score += 10;
  return score;
}

function chooseBestProspect(prospects: DirectApifyProspect[], target: Record<string, unknown>) {
  const ranked = prospects
    .map(prospect => ({ prospect, score: targetScore(prospect, target) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return best && best.score >= 70 ? best.prospect : null;
}

async function callTargetBackend(body: Record<string, unknown>) {
  const runRefs = Array.isArray(body.apifyRunRefs)
    ? body.apifyRunRefs.filter((run: any) => run?.runId).slice(0, 8).map((run: any): DirectApifyRunRef => ({
      runId: String(run.runId),
      datasetId: run.datasetId ? String(run.datasetId) : undefined,
      territory: run.territory ? String(run.territory) : undefined,
      status: run.status ? String(run.status) : undefined,
      pending: Boolean(run.pending),
    }))
    : [];

  const companyName = stringValue(body.companyName);
  const domain = normalizeDomain(stringValue(body.domain) || stringValue(body.website));
  const city = stringValue(body.city);
  const country = stringValue(body.country) || "France";
  const contactName = stringValue(body.contactName);
  const query = [companyName, domain ? `site:${domain}` : "", contactName].filter(Boolean).join(" ").slice(0, 500);
  const territory = [city, country].filter(Boolean).join(", ") || "France métropolitaine";

  const apify = await searchRentalCompaniesWithApifyDirect({
    query,
    territories: [territory],
    limit: 8,
    apifyLimit: Math.min(Math.max(Number(body.apifyLimit) || 100, 50), 300),
    apifyContactsPerCompany: 5,
    apifyRunRefs: runRefs.length ? runRefs : undefined,
    apifyPollWaitSeconds: Math.min(Math.max(Number(body.waitSeconds) || 0, 0), 20),
  });

  const prospect = chooseBestProspect(apify.prospects, {
    companyName,
    domain,
    website: stringValue(body.website),
    phone: stringValue(body.phone),
    city,
  });

  return {
    prospect: prospect as Prospect | null,
    pending: apify.runs.some(run => run.pending),
    runs: apify.runs,
    candidatesFound: apify.prospects.length,
    apify: { configured: apify.configured, errors: apify.errors },
    inpi: null,
  };
}

async function loadCompany(companyId: string) {
  return hubspotJson(`/crm/v3/objects/companies/${encodeURIComponent(companyId)}?properties=name,domain,website,phone,city,zip,country,address,description`);
}

async function loadContact(contactId: string) {
  return hubspotJson(`/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=firstname,lastname,email,phone,mobilephone,jobtitle,company,website,city,country&associations=companies`);
}

function companyPatch(existing: Record<string, string>, prospect: Prospect) {
  const patch: Record<string, string> = {};
  const candidates: Record<string, string | null | undefined> = {
    phone: prospect.phone,
    domain: prospect.domain,
    website: prospect.website,
    city: prospect.city,
    zip: prospect.postalCode,
    country: prospect.country,
    address: prospect.address,
  };
  for (const [key, value] of Object.entries(candidates)) {
    if (!existing[key] && value?.trim()) patch[key] = value.trim();
  }
  return patch;
}

function fullName(contact: EnrichedContact) {
  return contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

function bestContactMatch(target: Record<string, string>, contacts: EnrichedContact[]) {
  const targetEmail = (target.email || "").trim().toLowerCase();
  const targetName = [target.firstname, target.lastname].filter(Boolean).join(" ");
  let best: { contact: EnrichedContact; score: number } | null = null;

  for (const contact of contacts) {
    let score = 0;
    const email = (contact.email || "").trim().toLowerCase();
    if (targetEmail && email && targetEmail === email) score += 2;
    score += similarity(targetName, fullName(contact));
    if (target.jobtitle && contact.jobTitle) score += similarity(target.jobtitle, contact.jobTitle) * 0.2;
    if (!best || score > best.score) best = { contact, score };
  }
  return best && best.score >= 0.62 ? best.contact : null;
}

function contactPatch(existing: Record<string, string>, contact: EnrichedContact | null) {
  if (!contact) return {};
  const patch: Record<string, string> = {};
  if (!existing.email && contact.email) patch.email = contact.email;
  if (!existing.phone && !existing.mobilephone && contact.phone) patch.phone = contact.phone;
  if (!existing.jobtitle && contact.jobTitle) patch.jobtitle = contact.jobTitle;
  if (!existing.firstname && contact.firstName) patch.firstname = contact.firstName;
  if (!existing.lastname && contact.lastName) patch.lastname = contact.lastName;
  return patch;
}

async function findExistingContact(contact: EnrichedContact) {
  if (!contact.email) return null;
  const payload = await hubspotJson("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: contact.email }] }],
      properties: ["firstname", "lastname", "email", "phone", "jobtitle"],
      limit: 1,
    }),
  });
  return payload.results?.[0] || null;
}

async function createOrAssociateContacts(companyId: string, companyName: string, contacts: EnrichedContact[]) {
  let created = 0;
  let reused = 0;
  let failed = 0;
  const processed: Array<{ name: string; contactId?: string; created?: boolean; error?: string }> = [];

  for (const contact of contacts.slice(0, 5)) {
    try {
      const name = fullName(contact) || contact.email || "Contact enrichi";
      if (!contact.email && !name) continue;
      const existing = await findExistingContact(contact);
      let contactId: string;
      let wasCreated = false;

      if (existing?.id) {
        contactId = String(existing.id);
        reused += 1;
      } else {
        const createdContact = await hubspotJson("/crm/v3/objects/contacts", {
          method: "POST",
          body: JSON.stringify({
            properties: cleanProperties({
              firstname: contact.firstName || (contact.fullName ? contact.fullName.split(" ")[0] : ""),
              lastname: contact.lastName || (contact.fullName ? contact.fullName.split(" ").slice(1).join(" ") : ""),
              email: contact.email,
              phone: contact.phone,
              jobtitle: contact.jobTitle,
              company: companyName,
              hs_lead_status: "NEW",
            }),
          }),
        });
        contactId = String(createdContact.id);
        created += 1;
        wasCreated = true;
      }

      await hubspotJson(`/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/companies/${encodeURIComponent(companyId)}/contact_to_company`, { method: "PUT" });
      processed.push({ name, contactId, created: wasCreated });
    } catch (error) {
      failed += 1;
      processed.push({ name: fullName(contact) || contact.email || "Contact enrichi", error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { created, reused, failed, processed };
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const entityType = input.entityType as EntityType;
    const entityId = String(input.entityId || "").trim();
    if (!entityId || !["company", "contact"].includes(entityType)) {
      return NextResponse.json({ error: "entityType et entityId sont requis" }, { status: 400 });
    }

    let company: any = null;
    let contact: any = null;
    let companyId = "";

    if (entityType === "company") {
      companyId = entityId;
      company = await loadCompany(companyId);
    } else {
      contact = await loadContact(entityId);
      const associatedId = contact.associations?.companies?.results?.[0]?.id;
      if (associatedId) {
        companyId = String(associatedId);
        company = await loadCompany(companyId);
      }
    }

    const cp = (company?.properties || {}) as Record<string, string>;
    const tp = (contact?.properties || {}) as Record<string, string>;
    const companyName = cp.name || tp.company || "";
    const domain = cp.domain || cp.website || tp.website || domainFromEmail(tp.email);
    const city = cp.city || tp.city || "";
    const country = cp.country || tp.country || "France";
    const contactName = entityType === "contact" ? [tp.firstname, tp.lastname].filter(Boolean).join(" ") : "";

    if (!companyName && !domain) {
      return NextResponse.json({ error: "La fiche ne contient pas assez d'informations pour identifier son entreprise (nom ou domaine requis)." }, { status: 400 });
    }

    const backend = await callTargetBackend({
      companyName,
      domain,
      website: cp.website || tp.website,
      phone: cp.phone,
      city,
      country,
      contactName,
      apifyContactsPerCompany: 5,
      apifyLimit: 100,
      apifyRunRefs: Array.isArray(input.apifyRunRefs) ? input.apifyRunRefs : undefined,
      waitSeconds: Number(input.waitSeconds) || 0,
    });

    const prospect = backend.prospect || null;
    if (!prospect) {
      return NextResponse.json({
        ok: true,
        found: false,
        pending: Boolean(backend.pending),
        runs: backend.runs || [],
        candidatesFound: Number(backend.candidatesFound) || 0,
        message: backend.pending
          ? "Apify poursuit l’enrichissement de cette fiche."
          : "Aucun résultat suffisamment fiable n’a été trouvé pour cette fiche.",
        sourceErrors: backend.apify?.errors || [],
      });
    }

    const updatedCompanyFields: string[] = [];
    let contactSummary = { created: 0, reused: 0, failed: 0, processed: [] as Array<{ name: string; contactId?: string; created?: boolean; error?: string }> };

    if (companyId && company) {
      const patch = companyPatch(cp, prospect);
      if (Object.keys(patch).length) {
        await hubspotJson(`/crm/v3/objects/companies/${encodeURIComponent(companyId)}`, {
          method: "PATCH",
          body: JSON.stringify({ properties: patch }),
        });
        updatedCompanyFields.push(...Object.keys(patch));
      }

      if (entityType === "company") {
        contactSummary = await createOrAssociateContacts(companyId, cp.name || prospect.companyName || "Entreprise", Array.isArray(prospect.contacts) ? prospect.contacts : []);
      }
    }

    const updatedContactFields: string[] = [];
    let matchedContact: EnrichedContact | null = null;
    if (entityType === "contact" && contact) {
      matchedContact = bestContactMatch(tp, Array.isArray(prospect.contacts) ? prospect.contacts : []);
      const patch = contactPatch(tp, matchedContact);
      if (Object.keys(patch).length) {
        await hubspotJson(`/crm/v3/objects/contacts/${encodeURIComponent(entityId)}`, {
          method: "PATCH",
          body: JSON.stringify({ properties: patch }),
        });
        updatedContactFields.push(...Object.keys(patch));
      }
    }

    return NextResponse.json({
      ok: true,
      found: true,
      pending: Boolean(backend.pending),
      runs: backend.runs || [],
      updatedCompanyFields,
      updatedContactFields,
      contactsCreated: contactSummary.created,
      contactsReused: contactSummary.reused,
      contactsFailed: contactSummary.failed,
      contacts: contactSummary.processed,
      matchedContact,
      prospect: {
        companyName: prospect.companyName,
        phone: prospect.phone,
        website: prospect.website,
        domain: prospect.domain,
        city: prospect.city,
        contacts: Array.isArray(prospect.contacts) ? prospect.contacts : [],
        sourceProviders: prospect.sourceProviders || [],
        confidence: prospect.confidence,
      },
      message: "Enrichissement Apify appliqué à la fiche HubSpot.",
    });
  } catch (error) {
    return apiError(error instanceof Error ? error : new Error(String(error)));
  }
}
