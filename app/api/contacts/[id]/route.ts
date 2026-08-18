import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CONTACT_DETAIL_PROPERTIES = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","city","state","country","company","hubspot_owner_id",
  "statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","minari_call_count","referly_reason_to_reach_out",
  "notes_last_contacted","hs_last_sales_activity_timestamp","hs_object_source_label","createdate",
  "ce_quil_apprecie_chez_gando","objections__retours","zip","campagne_dacquisition","taille_de_flo","hs_country_region_code",
  "suite","solution_paiement_reservation",
];

const editable = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","city","state","country","company","hubspot_owner_id",
  "statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","ce_quil_apprecie_chez_gando",
  "objections__retours","zip","campagne_dacquisition","taille_de_flo","suite","solution_paiement_reservation",
];

const ACTIVITY_TYPES: Record<string, { path: string; associationTypeId: number; allowed: string[]; type: string }> = {
  note: { path: "notes", associationTypeId: 202, allowed: ["hs_note_body","hs_timestamp","hubspot_owner_id"], type: "note" },
  call: { path: "calls", associationTypeId: 196, allowed: ["hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_call_duration","hs_timestamp","hubspot_owner_id"], type: "call" },
  task: { path: "tasks", associationTypeId: 197, allowed: ["hs_task_subject","hs_task_body","hs_task_status","hs_task_priority","hs_task_type","hs_timestamp","hubspot_owner_id"], type: "task" },
  meeting: { path: "meetings", associationTypeId: 200, allowed: ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hs_timestamp","hubspot_owner_id"], type: "meeting" },
};

function hubspotRecord(row: any) {
  return { id: String(row.hubspot_id), properties: row.raw_data?.properties ?? {} };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data: contact, error } = await supabase.from("contacts").select("*").eq("hubspot_id", id).maybeSingle();
    if (error) throw error;
    if (!contact) return NextResponse.json({ error: "Contact introuvable dans Supabase. Lancez une synchronisation." }, { status: 404 });

    const [companiesResult, activitiesResult, tasksResult, freshContact] = await Promise.all([
      contact.company_id
        ? supabase.from("companies").select("hubspot_id,raw_data").eq("id", contact.company_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("activities").select("hubspot_id,activity_type,raw_data").eq("contact_id", contact.id),
      supabase.from("tasks").select("hubspot_id,raw_data").eq("contact_id", contact.id),
      hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(id)}?properties=${encodeURIComponent(CONTACT_DETAIL_PROPERTIES.join(","))}`),
    ]);
    if (companiesResult.error) throw companiesResult.error;
    if (activitiesResult.error) throw activitiesResult.error;
    if (tasksResult.error) throw tasksResult.error;

    const cachedContact = hubspotRecord(contact);
    const contactRecord = {
      ...cachedContact,
      properties: { ...cachedContact.properties, ...(freshContact.properties ?? {}) },
    };
    const companies = companiesResult.data ? [hubspotRecord(companiesResult.data)] : [];
    const activities = activitiesResult.data ?? [];
    const notes = activities.filter(a => a.activity_type === "note").map(hubspotRecord);
    const calls = activities.filter(a => a.activity_type === "call").map(hubspotRecord);
    const meetings = activities.filter(a => a.activity_type === "meeting").map(hubspotRecord);
    const tasks = (tasksResult.data ?? []).map(hubspotRecord);

    return NextResponse.json({ contact: contactRecord, companies, notes, calls, tasks, meetings });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message || "Erreur Supabase", details: e }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const properties = Object.fromEntries(Object.entries(body.properties ?? {}).filter(([key]) => editable.includes(key)));
    if (!Object.keys(properties).length) return NextResponse.json({ error: "Aucune propriété modifiable fournie" }, { status: 400 });
    const data = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ properties }) });

    const { data: existing } = await getSupabaseAdmin().from("contacts").select("*").eq("hubspot_id", id).maybeSingle();
    if (existing) {
      const props = { ...(existing.raw_data?.properties ?? {}), ...properties };
      const { error } = await getSupabaseAdmin().from("contacts").update({
        raw_data: { ...existing.raw_data, properties: props, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
        first_name: props.firstname ?? null,
        last_name: props.lastname ?? null,
        email: props.email ?? null,
        phone: props.phone ?? null,
        job_title: props.jobtitle ?? null,
        owner_hubspot_id: props.hubspot_owner_id ?? null,
      }).eq("hubspot_id", id);
      if (error) console.error("Supabase update contact:", error.message);
    }
    return NextResponse.json(data);
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e }, { status: e.status || 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const type = String(body.type ?? "").toLowerCase();
    const def = ACTIVITY_TYPES[type];
    if (!def) return NextResponse.json({ error: "Type d'activité invalide" }, { status: 400 });
    const properties = Object.fromEntries(
      Object.entries(body.properties ?? {})
        .filter(([key, value]) => def.allowed.includes(key) && value !== undefined && value !== null && String(value).trim() !== "")
        .map(([key, value]) => [key, String(value).trim()])
    );
    if (!properties.hs_timestamp) properties.hs_timestamp = new Date().toISOString();
    if (!Object.keys(properties).length) return NextResponse.json({ error: "Aucune donnée à créer" }, { status: 400 });
    const data = await hubspotJson(`/crm/objects/2026-03/${def.path}`, {
      method: "POST",
      body: JSON.stringify({
        properties,
        associations: [{ to: { id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: def.associationTypeId }] }],
      }),
    });

    const { data: contact } = await getSupabaseAdmin().from("contacts").select("id").eq("hubspot_id", id).maybeSingle();
    if (contact) {
      const row = {
        hubspot_id: String(data.id),
        activity_type: def.type,
        contact_id: contact.id,
        occurred_at: def.type === "meeting"
          ? (properties.hs_meeting_start_time || properties.hs_timestamp || new Date().toISOString())
          : (properties.hs_timestamp || new Date().toISOString()),
        subject: def.type === "call" ? properties.hs_call_title ?? null : def.type === "meeting" ? properties.hs_meeting_title ?? null : def.type === "task" ? properties.hs_task_subject ?? null : null,
        body: def.type === "note" ? properties.hs_note_body ?? null : def.type === "call" ? properties.hs_call_body ?? null : def.type === "task" ? properties.hs_task_body ?? null : properties.hs_meeting_location ?? null,
        outcome: def.type === "call" ? properties.hs_call_disposition ?? null : def.type === "meeting" ? properties.hs_meeting_outcome ?? null : null,
        owner_hubspot_id: properties.hubspot_owner_id ?? null,
        raw_data: data,
      };
      const target = def.type === "task" ? "tasks" : "activities";
      const { error } = await getSupabaseAdmin().from(target).upsert(row, { onConflict: "hubspot_id" });
      if (error) console.error("Supabase upsert activity:", error.message);
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e }, { status: e.status || 500 });
  }
}
