import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const properties = ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hubspot_owner_id","statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","minari_call_count","referly_call_outcome","referly_reason_to_reach_out","state","city","hs_last_sales_activity_timestamp","notes_last_contacted","hs_object_source_label","createdate"];

const editable = ["firstname","lastname","email","phone","mobilephone","jobtitle","city","state","company","hubspot_owner_id","statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance"];

const ACTIVITY_TYPES: Record<string, { path: string; associationTypeId: number; allowed: string[] }> = {
  note: { path: "notes", associationTypeId: 202, allowed: ["hs_note_body","hs_timestamp","hubspot_owner_id"] },
  call: { path: "calls", associationTypeId: 196, allowed: ["hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_call_duration","hs_timestamp","hubspot_owner_id"] },
  task: { path: "tasks", associationTypeId: 197, allowed: ["hs_task_subject","hs_task_body","hs_task_status","hs_task_priority","hs_task_type","hs_timestamp","hubspot_owner_id"] },
  meeting: { path: "meetings", associationTypeId: 200, allowed: ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hs_timestamp","hubspot_owner_id"] },
};

function idsFrom(record: any, type: string) {
  return (record?.associations?.[type]?.results ?? []).map((r: any) => String(r.id)).slice(0, 20);
}

async function batch(type: string, ids: string[], properties: string[]) {
  if (!ids.length) return [];
  const data = await hubspotJson(`/crm/objects/2026-03/${type}/batch/read`, { method: "POST", body: JSON.stringify({ properties, inputs: ids.map(id => ({ id })) }) });
  return data.results ?? [];
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const query = new URLSearchParams({ properties: properties.join(","), associations: "companies,notes,calls,tasks,meetings" });
    const contact = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(id)}?${query}`);
    const [companies, notes, calls, tasks, meetings] = await Promise.all([
      batch("companies", idsFrom(contact, "companies"), ["name","domain","phone","city","state"]),
      batch("notes", idsFrom(contact, "notes"), ["hs_note_body","hs_timestamp","hs_createdate","hs_object_source_label"]),
      batch("calls", idsFrom(contact, "calls"), ["hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_timestamp"]),
      batch("tasks", idsFrom(contact, "tasks"), ["hs_task_subject","hs_task_body","hs_task_status","hs_timestamp"]),
      batch("meetings", idsFrom(contact, "meetings"), ["hs_meeting_title","hs_meeting_start_time","hs_meeting_outcome","hs_timestamp"]),
    ]);
    return NextResponse.json({ contact, companies, notes, calls, tasks, meetings });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const properties = Object.fromEntries(Object.entries(body.properties ?? {}).filter(([key]) => editable.includes(key)));
    if (!Object.keys(properties).length) return NextResponse.json({ error: "Aucune propriété modifiable fournie" }, { status: 400 });
    const data = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ properties }) });
    return NextResponse.json(data);
  } catch (error) { return apiError(error); }
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
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return apiError(error); }
}
