import { NextRequest, NextResponse } from "next/server";
import { findSourcingDuplicate, listHubSpotCompaniesForSourcing, type SourcingContact, type SourcingProspect } from "@/lib/enrichment-dedup";
import { hubspotJson } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function splitName(contact: SourcingContact) {
  if (contact.firstName || contact.lastName) return { firstName: contact.firstName || "", lastName: contact.lastName || "" };
  const parts = String(contact.fullName || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function cleanProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => typeof value === "string" && value.trim()));
}

async function findExistingContact(contact: SourcingContact) {
  const filters: Array<{ propertyName: string; operator: string; value: string }> = [];
  if (contact.email?.trim()) filters.push({ propertyName: "email", operator: "EQ", value: contact.email.trim() });
  else if (contact.phone?.trim()) filters.push({ propertyName: "phone", operator: "EQ", value: contact.phone.trim() });
  else return null;

  const payload = await hubspotJson("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters }],
      properties: ["firstname", "lastname", "email", "phone", "jobtitle", "company"],
      limit: 1,
    }),
  });
  return payload.results?.[0] || null;
}

async function upsertContacts(prospect: SourcingProspect, companyId: string, maxContacts: number) {
  const contacts = (prospect.contacts || []).slice(0, maxContacts);
  const results: Array<{ fullName?: string; email?: string; jobTitle?: string; hubspotContactId?: string; created: boolean; associated: boolean; error?: string }> = [];

  for (const contact of contacts) {
    try {
      const existing = await findExistingContact(contact);
      let contactId = existing?.id ? String(existing.id) : "";
      let created = false;
      if (!contactId) {
        const { firstName, lastName } = splitName(contact);
        const payload = await hubspotJson("/crm/v3/objects/contacts", {
          method: "POST",
          body: JSON.stringify({
            properties: cleanProperties({
              firstname: firstName,
              lastname: lastName,
              email: contact.email,
              phone: contact.phone,
              jobtitle: contact.jobTitle,
              company: prospect.companyName,
              hs_lead_status: "NEW",
            }),
          }),
        });
        contactId = String(payload.id);
        created = true;
      }

      await hubspotJson(`/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/companies/${encodeURIComponent(companyId)}/contact_to_company`, { method: "PUT" });
      results.push({ fullName: contact.fullName, email: contact.email, jobTitle: contact.jobTitle, hubspotContactId: contactId, created, associated: true });
    } catch (error) {
      results.push({ fullName: contact.fullName, email: contact.email, jobTitle: contact.jobTitle, created: false, associated: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const prospects = (Array.isArray(input.prospects) ? input.prospects.slice(0, 50) : []) as SourcingProspect[];
    if (!prospects.length) return NextResponse.json({ error: "Sélectionnez au moins une entreprise." }, { status: 400 });

    const maxContacts = Math.min(Math.max(Number(input.maxContactsPerCompany) || 5, 1), 5);
    const companies = await listHubSpotCompaniesForSourcing();
    const imported: Array<Record<string, unknown>> = [];
    const skipped: Array<Record<string, unknown>> = [];
    let companiesCreatedCount = 0;
    let contactsCreatedCount = 0;
    let contactsReusedCount = 0;
    let contactsFailedCount = 0;

    for (const prospect of prospects) {
      if (!prospect?.companyName?.trim()) {
        skipped.push({ companyName: "Unknown", reason: "missing_company_name" });
        continue;
      }

      const duplicate = findSourcingDuplicate(prospect, companies);
      let companyId = duplicate?.company?.id ? String(duplicate.company.id) : "";
      let companyCreated = false;

      if (!companyId) {
        const created = await hubspotJson("/crm/objects/2026-03/companies", {
          method: "POST",
          body: JSON.stringify({
            properties: cleanProperties({
              name: prospect.companyName,
              domain: prospect.domain || undefined,
              website: prospect.website || undefined,
              phone: prospect.phone || undefined,
              city: prospect.city || undefined,
              zip: prospect.postalCode || undefined,
              country: prospect.country || undefined,
              address: prospect.address || undefined,
              description: [
                prospect.qualificationReason ? `Qualification sourcing : ${prospect.qualificationReason}` : "",
                prospect.evidence ? `Preuve : ${prospect.evidence}` : "",
                prospect.sourceUrls?.length ? `Sources : ${prospect.sourceUrls.join(" | ")}` : "",
              ].filter(Boolean).join("\n"),
              hs_lead_status: "NEW",
            }),
          }),
        });
        companyId = String(created.id);
        companyCreated = true;
        companiesCreatedCount += 1;
        companies.push({
          id: companyId,
          name: prospect.companyName,
          domain: prospect.domain || undefined,
          website: prospect.website || undefined,
          phone: prospect.phone || undefined,
          city: prospect.city || undefined,
        });
      }

      const contactResults = await upsertContacts(prospect, companyId, maxContacts);
      for (const contact of contactResults) {
        if (!contact.associated) contactsFailedCount += 1;
        else if (contact.created) contactsCreatedCount += 1;
        else contactsReusedCount += 1;
      }

      imported.push({
        companyName: prospect.companyName,
        hubspotCompanyId: companyId,
        companyCreated,
        duplicateReason: duplicate?.reason,
        contacts: contactResults,
      });
    }

    return NextResponse.json({
      importedCount: companiesCreatedCount,
      processedCount: imported.length,
      existingCompaniesCount: imported.filter(item => item.companyCreated === false).length,
      skippedCount: skipped.length,
      contactsCreatedCount,
      contactsReusedCount,
      contactsFailedCount,
      imported,
      skipped,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
