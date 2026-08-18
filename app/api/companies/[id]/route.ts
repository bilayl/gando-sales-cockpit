import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const COMPANY_DETAIL_PROPERTIES = [
  "name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id","num_associated_contacts",
  "num_associated_deals","hs_last_sales_activity_timestamp","hs_object_source_label","createdate","hs_lead_status","lifecyclestage",
  "statut_de_lappel","date_de_rappel","zip","hs_country_code","taille_flotte","solution_paiement_reservation",
];

const CONTACT_PROFILE_PROPERTIES = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","company","statut_prospection","statut_de_lappel",
  "ce_quil_apprecie_chez_gando","objections__retours","zip","campagne_dacquisition","taille_de_flo","hs_country_region_code",
  "suite","solution_paiement_reservation","hs_last_sales_activity_timestamp",
];

const EDITABLE_PROPERTIES = new Set([
  "name",
  "domain",
  "phone",
  "website",
  "city",
  "state",
  "country",
  "industry",
  "description",
  "hubspot_owner_id",
  "hs_lead_status",
  "statut_de_lappel",
  "date_de_rappel",
  "zip",
  "taille_flotte",
  "solution_paiement_reservation",
]);

function hubspotRecord(row: any) {
  return { id: String(row.hubspot_id), properties: row.raw_data?.properties ?? {} };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data: company, error } = await supabase.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
    if (error) throw error;
    if (!company) return NextResponse.json({ error: "Entreprise introuvable dans Supabase. Lancez une synchronisation." }, { status: 404 });

    const [contactsResult, activitiesResult, dealsResult, tasksResult, freshCompany] = await Promise.all([
      supabase.from("contacts").select("hubspot_id,raw_data").eq("company_id", company.id),
      supabase.from("activities").select("hubspot_id,activity_type,occurred_at,raw_data").eq("company_id", company.id),
      supabase.from("deals").select("hubspot_id,raw_data").eq("company_id", company.id),
      supabase.from("tasks").select("hubspot_id,raw_data").eq("company_id", company.id),
      hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}?properties=${encodeURIComponent(COMPANY_DETAIL_PROPERTIES.join(","))}`),
    ]);
    if (contactsResult.error) throw contactsResult.error;
    if (activitiesResult.error) throw activitiesResult.error;
    if (dealsResult.error) throw dealsResult.error;
    if (tasksResult.error) throw tasksResult.error;

    const cachedCompany = hubspotRecord(company);
    const companyRecord = {
      ...cachedCompany,
      properties: { ...cachedCompany.properties, ...(freshCompany.properties ?? {}) },
    };

    const cachedContacts = (contactsResult.data ?? []).map(hubspotRecord);
    const contactIds = cachedContacts.map(contact => contact.id);
    let contacts = cachedContacts;
    if (contactIds.length) {
      const freshContacts = await hubspotJson(`/crm/objects/2026-03/contacts/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties: CONTACT_PROFILE_PROPERTIES, inputs: contactIds.map(contactId => ({ id: contactId })) }),
      });
      const freshById = new Map((freshContacts.results ?? []).map((record: any) => [String(record.id), record.properties ?? {}]));
      contacts = cachedContacts.map(contact => ({
        ...contact,
        properties: { ...contact.properties, ...(freshById.get(contact.id) ?? {}) },
      }));
    }

    const activities = activitiesResult.data ?? [];
    const notes = activities.filter(a => a.activity_type === "note").map(hubspotRecord);
    const calls = activities
      .filter(a => a.activity_type === "call")
      .map(hubspotRecord)
      .sort((a: any, b: any) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());
    const meetings = activities
      .filter(a => a.activity_type === "meeting")
      .map(hubspotRecord)
      .map((meeting: any) => {
        const startAt = meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp || null;
        const outcome = meeting.properties?.hs_meeting_outcome || (startAt && new Date(startAt).getTime() >= Date.now() ? "SCHEDULED" : "UNREVIEWED");
        return { ...meeting, derived: { startAt, status: outcome } };
      })
      .sort((a: any, b: any) => new Date(b.derived.startAt || 0).getTime() - new Date(a.derived.startAt || 0).getTime());
    const deals = (dealsResult.data ?? []).map(hubspotRecord);
    const tasks = (tasksResult.data ?? []).map(hubspotRecord);
    const nextMeeting = [...meetings]
      .filter((meeting: any) => meeting.derived.status === "SCHEDULED" && new Date(meeting.derived.startAt || 0).getTime() >= Date.now())
      .sort((a: any, b: any) => new Date(a.derived.startAt).getTime() - new Date(b.derived.startAt).getTime())[0] || null;

    return NextResponse.json({ company: companyRecord, contacts, notes, calls, meetings, deals, tasks, nextMeeting });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message || "Erreur Supabase", details: e }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const properties = Object.fromEntries(
      Object.entries(body.properties ?? {}).filter(([key, value]) => EDITABLE_PROPERTIES.has(key) && value !== undefined && value !== null),
    ) as Record<string, string>;

    if (!Object.keys(properties).length) {
      return NextResponse.json({ error: "Aucune propriété entreprise modifiable fournie" }, { status: 400 });
    }

    const updated = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
    if (existing) {
      const merged = { ...(existing.raw_data?.properties ?? {}), ...(updated.properties ?? properties) };
      const { error } = await supabase.from("companies").update({
        raw_data: { ...existing.raw_data, ...updated, properties: merged, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
        name: merged.name || existing.name,
        domain: merged.domain ?? existing.domain,
        phone: merged.phone ?? existing.phone,
        website: merged.website ?? existing.website,
        city: merged.city ?? existing.city,
        postal_code: merged.zip ?? existing.postal_code,
        country: merged.country ?? existing.country,
        owner_hubspot_id: merged.hubspot_owner_id ?? existing.owner_hubspot_id,
      }).eq("hubspot_id", id);
      if (error) console.error("Supabase update company:", error.message);
    }

    return NextResponse.json(updated);
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e }, { status: e.status || 500 });
  }
}
