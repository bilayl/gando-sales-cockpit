import { NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CONTACT_PROPERTIES = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","company","hubspot_owner_id",
  "statut_prospection","statut_de_lappel","hs_last_sales_activity_timestamp","ce_quil_apprecie_chez_gando",
  "objections__retours","campagne_dacquisition","suite","zip","taille_de_flo","hs_country_region_code","solution_paiement_reservation",
];
const NOTE_PROPERTIES = ["hs_note_body","hs_timestamp","hs_createdate","hs_object_source_label","hubspot_owner_id"];
const CALL_PROPERTIES = ["hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_call_duration","hs_timestamp","hubspot_owner_id"];
const MEETING_PROPERTIES = ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hs_internal_meeting_notes","hs_timestamp","hubspot_owner_id"];
const TASK_PROPERTIES = ["hs_task_subject","hs_task_body","hs_task_status","hs_task_priority","hs_task_type","hs_timestamp","hubspot_owner_id"];
const DEAL_PROPERTIES = ["dealname","amount","pipeline","dealstage","closedate","createdate","hubspot_owner_id"];

function ids(record: any, key: string): string[] {
  return (record?.associations?.[key]?.results || []).map((item: any) => String(item.id));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function batchRead(path: string, recordIds: string[], properties: string[]): Promise<any[]> {
  const all: any[] = [];
  const distinct = unique(recordIds);
  for (let index = 0; index < distinct.length; index += 100) {
    const chunk = distinct.slice(index, index + 100);
    if (!chunk.length) continue;
    try {
      const result = await hubspotJson(`/crm/objects/2026-03/${path}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties, inputs: chunk.map(id => ({ id })) }),
      });
      all.push(...(result.results || []));
    } catch (error) {
      console.error(`HubSpot centralized ${path}:`, error);
    }
  }
  return all;
}

function contactName(contact: any): string {
  const p = contact?.properties || {};
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params;
    const company = await hubspotJson(
      `/crm/objects/2026-03/companies/${encodeURIComponent(companyId)}?properties=name,num_associated_contacts,num_associated_deals&associations=contacts,deals,notes,calls,meetings,tasks`,
    );

    const contactIds = ids(company, "contacts");
    let contacts: any[] = [];
    if (contactIds.length) {
      const result = await hubspotJson(`/crm/objects/2026-03/contacts/batch/read?associations=notes,calls,meetings,tasks`, {
        method: "POST",
        body: JSON.stringify({ properties: CONTACT_PROPERTIES, inputs: contactIds.map(id => ({ id })) }),
      });
      contacts = result.results || [];
    }

    const sourceMaps: Record<string, Map<string, string>> = {
      notes: new Map(),
      calls: new Map(),
      meetings: new Map(),
      tasks: new Map(),
    };
    const names = new Map<string, string>();

    for (const contact of contacts) {
      const contactId = String(contact.id);
      names.set(contactId, contactName(contact));
      for (const type of ["notes", "calls", "meetings", "tasks"]) {
        for (const activityId of ids(contact, type)) {
          if (!sourceMaps[type].has(activityId)) sourceMaps[type].set(activityId, contactId);
        }
      }
    }

    const noteIds = unique([...ids(company, "notes"), ...Array.from(sourceMaps.notes.keys())]);
    const callIds = unique([...ids(company, "calls"), ...Array.from(sourceMaps.calls.keys())]);
    const meetingIds = unique([...ids(company, "meetings"), ...Array.from(sourceMaps.meetings.keys())]);
    const taskIds = unique([...ids(company, "tasks"), ...Array.from(sourceMaps.tasks.keys())]);
    const dealIds = unique(ids(company, "deals"));

    const [notesRaw, callsRaw, meetingsRaw, tasksRaw, deals] = await Promise.all([
      batchRead("notes", noteIds, NOTE_PROPERTIES),
      batchRead("calls", callIds, CALL_PROPERTIES),
      batchRead("meetings", meetingIds, MEETING_PROPERTIES),
      batchRead("tasks", taskIds, TASK_PROPERTIES),
      batchRead("deals", dealIds, DEAL_PROPERTIES),
    ]);

    const decorate = (type: string, record: any) => {
      const contactId = sourceMaps[type]?.get(String(record.id)) || null;
      return {
        ...record,
        sourceType: contactId ? "contact" : "company",
        sourceContactId: contactId,
        sourceContactName: contactId ? names.get(contactId) || "Contact" : null,
      };
    };

    const notes = notesRaw.map(record => decorate("notes", record));
    const calls = callsRaw.map(record => decorate("calls", record));
    const meetings = meetingsRaw.map(record => {
      const decorated = decorate("meetings", record);
      const startAt = record.properties?.hs_meeting_start_time || record.properties?.hs_timestamp || null;
      const status = record.properties?.hs_meeting_outcome || (startAt && new Date(startAt).getTime() >= Date.now() ? "SCHEDULED" : "UNREVIEWED");
      return { ...decorated, derived: { startAt, status } };
    });
    const tasks = tasksRaw.map(record => decorate("tasks", record));

    meetings.sort((a, b) => new Date(b.derived?.startAt || 0).getTime() - new Date(a.derived?.startAt || 0).getTime());
    calls.sort((a, b) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());
    tasks.sort((a, b) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());

    const nextMeeting = meetings
      .filter(meeting => meeting.derived?.status === "SCHEDULED" && new Date(meeting.derived?.startAt || 0).getTime() >= Date.now())
      .sort((a, b) => new Date(a.derived?.startAt || 0).getTime() - new Date(b.derived?.startAt || 0).getTime())[0] || null;

    // Best-effort local synchronization. HubSpot remains the source of truth.
    const supabase = getSupabaseAdmin();
    const { data: localCompany } = await supabase.from("companies").select("id").eq("hubspot_id", companyId).maybeSingle();
    if (localCompany && contacts.length) {
      const rows = contacts.map(contact => {
        const p = contact.properties || {};
        return {
          hubspot_id: String(contact.id),
          company_id: localCompany.id,
          first_name: p.firstname ?? null,
          last_name: p.lastname ?? null,
          email: p.email ?? null,
          phone: p.phone || p.mobilephone || null,
          job_title: p.jobtitle ?? null,
          owner_hubspot_id: p.hubspot_owner_id ?? null,
          raw_data: contact,
          hubspot_updated_at: contact.updatedAt || new Date().toISOString(),
        };
      });
      const { error } = await supabase.from("contacts").upsert(rows, { onConflict: "hubspot_id" });
      if (error) console.error("Supabase centralized contact sync:", error.message);
    }

    return NextResponse.json({
      contacts: contacts.map(contact => ({ ...contact, id: String(contact.id), properties: { ...(contact.properties || {}), __hubspot_id: String(contact.id) } })),
      notes,
      calls,
      meetings,
      tasks,
      deals,
      nextMeeting,
      activitySummary: {
        notes: notes.length,
        calls: calls.length,
        meetings: meetings.length,
        tasks: tasks.length,
        total: notes.length + calls.length + meetings.length + tasks.length,
      },
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de centraliser l’activité HubSpot" }, { status: e.status || 500 });
  }
}
