import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobilephone",
  "jobtitle",
  "company",
  "hubspot_owner_id",
  "statut_prospection",
  "statut_de_lappel",
  "hs_last_sales_activity_timestamp",
  "ce_quil_apprecie_chez_gando",
  "objections__retours",
  "campagne_dacquisition",
  "suite",
];

function contactLabel(properties: Record<string, string | null | undefined>) {
  return [properties.firstname, properties.lastname].filter(Boolean).join(" ") || properties.email || properties.phone || "Contact HubSpot";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const query = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (query.length < 2) return NextResponse.json({ results: [] });

    const [search, company] = await Promise.all([
      hubspotJson("/crm/objects/2026-03/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          limit: 12,
          properties: CONTACT_PROPERTIES,
        }),
      }),
      hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}?properties=name&associations=contacts`),
    ]);

    const associatedIds = new Set(
      (company.associations?.contacts?.results || []).map((item: { id: string }) => String(item.id)),
    );

    const results = (search.results || []).map((contact: any) => ({
      id: String(contact.id),
      properties: contact.properties || {},
      label: contactLabel(contact.properties || {}),
      alreadyAssociated: associatedIds.has(String(contact.id)),
    }));

    return NextResponse.json({ results });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de rechercher les contacts HubSpot" }, { status: e.status || 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params;
    const body = await request.json();
    const contactId = String(body.contactId || "").trim();
    if (!contactId) return NextResponse.json({ error: "Contact HubSpot manquant" }, { status: 400 });

    // Default HubSpot association. This is idempotent for an already-associated pair.
    await hubspotJson(
      `/crm/objects/2026-03/contact/${encodeURIComponent(contactId)}/associations/default/company/${encodeURIComponent(companyId)}`,
      { method: "PUT" },
    );

    const [contact, company] = await Promise.all([
      hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(contactId)}?properties=${encodeURIComponent(CONTACT_PROPERTIES.join(","))}`),
      hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(companyId)}?properties=name,num_associated_contacts`),
    ]);

    const supabase = getSupabaseAdmin();
    const { data: localCompany } = await supabase.from("companies").select("id,raw_data").eq("hubspot_id", companyId).maybeSingle();

    if (localCompany) {
      const p = contact.properties || {};
      const { error: contactError } = await supabase.from("contacts").upsert({
        hubspot_id: contactId,
        company_id: localCompany.id,
        first_name: p.firstname ?? null,
        last_name: p.lastname ?? null,
        email: p.email ?? null,
        phone: p.phone || p.mobilephone || null,
        job_title: p.jobtitle ?? null,
        owner_hubspot_id: p.hubspot_owner_id ?? null,
        raw_data: contact,
        hubspot_updated_at: new Date().toISOString(),
      }, { onConflict: "hubspot_id" });
      if (contactError) console.error("Supabase associate contact:", contactError.message);

      const companyProps = { ...(localCompany.raw_data?.properties || {}), ...(company.properties || {}) };
      const { error: companyError } = await supabase.from("companies").update({
        raw_data: { ...localCompany.raw_data, ...company, properties: companyProps, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
      }).eq("hubspot_id", companyId);
      if (companyError) console.error("Supabase refresh company association:", companyError.message);
    }

    return NextResponse.json({
      associated: true,
      companyId,
      contact: {
        id: contactId,
        properties: { ...(contact.properties || {}), __hubspot_id: contactId },
      },
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible d’associer ce contact dans HubSpot" }, { status: e.status || 500 });
  }
}
