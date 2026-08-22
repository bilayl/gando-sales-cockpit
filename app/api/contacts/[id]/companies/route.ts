import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const COMPANY_PROPERTIES = [
  "name",
  "domain",
  "phone",
  "website",
  "city",
  "zip",
  "state",
  "country",
  "industry",
  "hubspot_owner_id",
  "num_associated_contacts",
];

function companyLabel(properties: Record<string, string | null | undefined>) {
  return properties.name || properties.domain || properties.phone || "Entreprise HubSpot";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const query = new URL(request.url).searchParams.get("q")?.trim() || "";

    const contact = await hubspotJson(
      `/crm/objects/2026-03/contacts/${encodeURIComponent(id)}?properties=firstname,lastname,email&associations=companies`,
    );
    const associatedIds = new Set(
      (contact.associations?.companies?.results || []).map((item: { id: string }) => String(item.id)),
    );

    if (query) {
      if (query.length < 2) return NextResponse.json({ results: [] });
      const search = await hubspotJson("/crm/objects/2026-03/companies/search", {
        method: "POST",
        body: JSON.stringify({ query, limit: 12, properties: COMPANY_PROPERTIES }),
      });
      const results = (search.results || []).map((company: any) => ({
        id: String(company.id),
        properties: company.properties || {},
        label: companyLabel(company.properties || {}),
        alreadyAssociated: associatedIds.has(String(company.id)),
      }));
      return NextResponse.json({ results });
    }

    if (!associatedIds.size) return NextResponse.json({ results: [] });

    const data = await hubspotJson("/crm/objects/2026-03/companies/batch/read", {
      method: "POST",
      body: JSON.stringify({
        properties: COMPANY_PROPERTIES,
        inputs: Array.from(associatedIds).map(companyId => ({ id: companyId })),
      }),
    });

    return NextResponse.json({
      results: (data.results || []).map((company: any) => ({
        id: String(company.id),
        properties: company.properties || {},
        label: companyLabel(company.properties || {}),
        alreadyAssociated: true,
      })),
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de charger les entreprises associées" }, { status: e.status || 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: contactId } = await params;
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId) return NextResponse.json({ error: "Entreprise HubSpot manquante" }, { status: 400 });

    await hubspotJson(
      `/crm/objects/2026-03/contact/${encodeURIComponent(contactId)}/associations/default/company/${encodeURIComponent(companyId)}`,
      { method: "PUT" },
    );

    const [company, contact] = await Promise.all([
      hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(companyId)}?properties=${encodeURIComponent(COMPANY_PROPERTIES.join(","))}`),
      hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(contactId)}?properties=firstname,lastname,email,phone,mobilephone,jobtitle,hubspot_owner_id`),
    ]);

    const supabase = getSupabaseAdmin();
    const [{ data: localCompany }, { data: localContact }] = await Promise.all([
      supabase.from("companies").select("id,raw_data").eq("hubspot_id", companyId).maybeSingle(),
      supabase.from("contacts").select("id,company_id,raw_data").eq("hubspot_id", contactId).maybeSingle(),
    ]);

    if (localContact) {
      const contactProps = { ...(localContact.raw_data?.properties || {}), ...(contact.properties || {}) };
      const { error: contactError } = await supabase.from("contacts").update({
        company_id: localContact.company_id || localCompany?.id || null,
        first_name: contactProps.firstname ?? null,
        last_name: contactProps.lastname ?? null,
        email: contactProps.email ?? null,
        phone: contactProps.phone || contactProps.mobilephone || null,
        job_title: contactProps.jobtitle ?? null,
        owner_hubspot_id: contactProps.hubspot_owner_id ?? null,
        raw_data: { ...localContact.raw_data, ...contact, properties: contactProps, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
      }).eq("hubspot_id", contactId);
      if (contactError) console.error("Supabase associate company to contact:", contactError.message);
    }

    if (localCompany) {
      const companyProps = { ...(localCompany.raw_data?.properties || {}), ...(company.properties || {}) };
      const { error: companyError } = await supabase.from("companies").update({
        raw_data: { ...localCompany.raw_data, ...company, properties: companyProps, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
      }).eq("hubspot_id", companyId);
      if (companyError) console.error("Supabase refresh company association:", companyError.message);
    }

    return NextResponse.json({
      associated: true,
      contactId,
      company: {
        id: companyId,
        properties: company.properties || {},
      },
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible d’associer cette entreprise dans HubSpot" }, { status: e.status || 500 });
  }
}
