import { NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { requireCockpitAccess } from "@/lib/cockpit-access";

const CONTACT_PROPERTIES = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","company","hubspot_owner_id",
  "statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","date_recyclage",
  "notes_last_contacted","hs_last_sales_activity_timestamp","hs_object_source_label","createdate",
  "ce_quil_apprecie_chez_gando","objections__retours","campagne_dacquisition","suite","zip","taille_de_flo","hs_country_region_code","solution_paiement_reservation",
];
const COMPANY_PROPERTIES = ["name","domain","phone","website","city","state","country","hubspot_owner_id","statut_prospection","hs_lead_status","lifecyclestage"];
const NOTE_PROPERTIES = ["hs_note_body","hs_timestamp","hs_createdate","hs_object_source_label","hubspot_owner_id"];
const CALL_PROPERTIES = ["hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_call_duration","hs_timestamp","hubspot_owner_id","hs_call_summary"];
const MEETING_PROPERTIES = ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hs_internal_meeting_notes","hs_timestamp","hubspot_owner_id"];
const TASK_PROPERTIES = ["hs_task_subject","hs_task_body","hs_task_status","hs_task_priority","hs_task_type","hs_timestamp","hubspot_owner_id"];
const DEAL_PROPERTIES = ["dealname","amount","pipeline","dealstage","closedate","createdate","hubspot_owner_id"];

function associationIds(record: any, key: string): string[] {
  return (record?.associations?.[key]?.results || []).map((item: any) => String(item.id)).filter(Boolean);
}

async function batchRead(path: string, ids: string[], properties: string[]) {
  if (!ids.length) return [];
  const result = await hubspotJson(`/crm/objects/2026-03/${path}/batch/read`, {
    method: "POST",
    body: JSON.stringify({ properties, inputs: ids.slice(0, 100).map(id => ({ id })) }),
  });
  return result.results || [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCockpitAccess();
    const { id } = await params;
    const contact = await hubspotJson(
      `/crm/objects/2026-03/contacts/${encodeURIComponent(id)}?properties=${encodeURIComponent(CONTACT_PROPERTIES.join(","))}&associations=companies,deals,notes,calls,meetings,tasks`,
    );

    const [companies, notes, calls, meetingsRaw, tasks, deals] = await Promise.all([
      batchRead("companies", associationIds(contact, "companies"), COMPANY_PROPERTIES),
      batchRead("notes", associationIds(contact, "notes"), NOTE_PROPERTIES),
      batchRead("calls", associationIds(contact, "calls"), CALL_PROPERTIES),
      batchRead("meetings", associationIds(contact, "meetings"), MEETING_PROPERTIES),
      batchRead("tasks", associationIds(contact, "tasks"), TASK_PROPERTIES),
      batchRead("deals", associationIds(contact, "deals"), DEAL_PROPERTIES),
    ]);

    const meetings = meetingsRaw.map((meeting: any) => {
      const startAt = meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp || null;
      const status = meeting.properties?.hs_meeting_outcome || (startAt && new Date(startAt).getTime() >= Date.now() ? "SCHEDULED" : "UNREVIEWED");
      return { ...meeting, derived: { startAt, status } };
    });

    notes.sort((a: any, b: any) => new Date(b.properties?.hs_timestamp || b.properties?.hs_createdate || 0).getTime() - new Date(a.properties?.hs_timestamp || a.properties?.hs_createdate || 0).getTime());
    calls.sort((a: any, b: any) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());
    meetings.sort((a: any, b: any) => new Date(b.derived?.startAt || 0).getTime() - new Date(a.derived?.startAt || 0).getTime());
    tasks.sort((a: any, b: any) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());

    return NextResponse.json({
      contact: { ...contact, id: String(contact.id), properties: { ...(contact.properties || {}), __hubspot_id: String(contact.id) } },
      companies,
      notes,
      calls,
      meetings,
      tasks,
      deals,
      activitySummary: { notes: notes.length, calls: calls.length, meetings: meetings.length, tasks: tasks.length, total: notes.length + calls.length + meetings.length + tasks.length },
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de charger l'activité complète du contact" }, { status: e.status || 500 });
  }
}
