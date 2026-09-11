import { NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireCockpitAccess } from "@/lib/cockpit-access";

const COMPANY_PROPERTIES = [
  "name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id",
  "num_associated_contacts","num_associated_deals","hs_last_sales_activity_timestamp","hs_object_source_label","createdate",
  "hs_lead_status","lifecyclestage","statut_de_lappel","date_de_rappel","statut_prospection","zip",
  "ce_quil_apprecie_chez_gando","objections__retours","campagne_dacquisition","suite","taille_flotte","solution_paiement_reservation",
];
const CONTACT_PROPERTIES = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","company","hubspot_owner_id",
  "statut_prospection","statut_de_lappel","hs_last_sales_activity_timestamp","ce_quil_apprecie_chez_gando",
  "objections__retours","campagne_dacquisition","suite","zip","taille_de_flo","hs_country_region_code","solution_paiement_reservation",
];
const NOTE_PROPERTIES = ["hs_note_body","hs_timestamp","hs_createdate","hs_object_source_label","hubspot_owner_id"];
const CALL_PROPERTIES = [
  "hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_call_duration","hs_timestamp","hubspot_owner_id",
  "hs_call_summary","hs_ai_summary","hs_call_has_transcript","hs_call_recording_url","hs_call_transcript_tracked_terms",
];
const MEETING_PROPERTIES = ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hs_internal_meeting_notes","hs_timestamp","hubspot_owner_id"];
const TASK_PROPERTIES = ["hs_task_subject","hs_task_body","hs_task_status","hs_task_priority","hs_task_type","hs_timestamp","hubspot_owner_id"];
const DEAL_PROPERTIES = ["dealname","amount","pipeline","dealstage","closedate","createdate","hubspot_owner_id"];

function associationIds(record: any, key: string): string[] {
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
    const result = await hubspotJson(`/crm/objects/2026-03/${path}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ properties, inputs: chunk.map(id => ({ id })) }),
    });
    all.push(...(result.results || []));
  }
  return all;
}

async function attachOnoffCallDetails(calls: any[]) {
  const hubspotCallIds = calls.map(call => String(call.id || "")).filter(Boolean);
  if (!hubspotCallIds.length) return calls;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("onoff_call_processing")
      .select("hubspot_call_id,call_id,transcript_text,ai_analysis,tags,processing_status,created_at")
      .in("hubspot_call_id", hubspotCallIds)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const detailsByCall = new Map<string, any>();
    for (const row of data || []) {
      const key = String(row.hubspot_call_id || "");
      if (!key) continue;
      const current = detailsByCall.get(key);
      if (!current || (!current.transcript_text && row.transcript_text)) detailsByCall.set(key, row);
    }

    return calls.map(call => {
      const detail = detailsByCall.get(String(call.id));
      if (!detail) return call;
      return {
        ...call,
        transcript: String(detail.transcript_text || "").trim() || null,
        onoffCallId: detail.call_id ? String(detail.call_id) : null,
        onoffAiAnalysis: detail.ai_analysis || null,
        onoffTags: detail.tags || null,
        onoffProcessingStatus: detail.processing_status || null,
      };
    });
  } catch (error) {
    console.warn("Onoff transcript enrichment unavailable:", error);
    return calls;
  }
}

function contactName(contact: any): string {
  const p = contact?.properties || {};
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || p.phone || "Contact";
}

async function loadContactWithAssociations(contactId: string) {
  return hubspotJson(
    `/crm/objects/2026-03/contacts/${encodeURIComponent(contactId)}?properties=${encodeURIComponent(CONTACT_PROPERTIES.join(","))}&associations=notes,calls,meetings,tasks`,
  );
}

function qualificationProperties(row: any) {
  const stringValue = (input: unknown) => input === undefined || input === null ? undefined : String(input);
  return {
    qualification_status: stringValue(row.qualification_status || row.prospecting_status),
    qualification_score: stringValue(row.qualification_score),
    qualification_reason: stringValue(row.qualification_reason),
    qualification_last_activity_at: stringValue(row.qualification_last_activity_at),
    qualification_next_action_at: stringValue(row.qualification_next_action_at),
    qualification_contacts_count: stringValue(row.qualification_contacts_count),
    qualification_open_tasks: stringValue(row.qualification_open_tasks),
    qualification_overdue_tasks: stringValue(row.qualification_overdue_tasks),
    qualification_deals_count: stringValue(row.qualification_deals_count),
    qualification_last_call_status: stringValue(row.qualification_last_call_status),
    qualification_source: stringValue(row.qualification_source),
  };
}

async function loadLocalCompanyPayload(companyId: string) {
  const supabase = getSupabaseAdmin();
  const { data: localCompany, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("hubspot_id", companyId)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!localCompany) return null;

  const { data: localContacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,hubspot_id,first_name,last_name,email,phone,job_title,owner_hubspot_id,raw_data,hubspot_updated_at")
    .eq("company_id", localCompany.id)
    .order("hubspot_updated_at", { ascending: false, nullsFirst: false });
  if (contactsError) throw contactsError;

  const rawCompany = localCompany.raw_data?.properties || {};
  const companyProperties = {
    ...rawCompany,
    name: rawCompany.name || localCompany.name || undefined,
    domain: rawCompany.domain || localCompany.domain || undefined,
    phone: rawCompany.phone || localCompany.phone || undefined,
    website: rawCompany.website || localCompany.website || undefined,
    city: rawCompany.city || localCompany.city || undefined,
    zip: rawCompany.zip || localCompany.postal_code || undefined,
    postal_code: rawCompany.postal_code || localCompany.postal_code || undefined,
    country: rawCompany.country || localCompany.country || undefined,
    hubspot_owner_id: rawCompany.hubspot_owner_id || localCompany.owner_hubspot_id || undefined,
    ...qualificationProperties(localCompany),
    __hubspot_id: companyId,
  };

  const contacts = (localContacts || []).map(row => {
    const raw = row.raw_data?.properties || {};
    return {
      ...(row.raw_data || {}),
      id: String(row.hubspot_id),
      properties: {
        ...raw,
        firstname: raw.firstname || row.first_name || undefined,
        lastname: raw.lastname || row.last_name || undefined,
        email: raw.email || row.email || undefined,
        phone: raw.phone || raw.mobilephone || row.phone || undefined,
        jobtitle: raw.jobtitle || row.job_title || undefined,
        hubspot_owner_id: raw.hubspot_owner_id || row.owner_hubspot_id || undefined,
        company: raw.company || localCompany.name || undefined,
        __hubspot_id: String(row.hubspot_id),
      },
    };
  });

  return {
    source: "cockpit" as const,
    company: {
      ...(localCompany.raw_data || {}),
      id: companyId,
      properties: companyProperties,
    },
    contacts,
    notes: [],
    calls: [],
    meetings: [],
    tasks: [],
    deals: [],
    nextMeeting: null,
    associationWarnings: 0,
    activitySummary: { notes: 0, calls: 0, meetings: 0, tasks: 0, total: 0 },
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCockpitAccess();
  const { id: companyId } = await params;

  try {
    const company = await hubspotJson(
      `/crm/objects/2026-03/companies/${encodeURIComponent(companyId)}?properties=${encodeURIComponent(COMPANY_PROPERTIES.join(","))}&associations=contacts,deals,notes,calls,meetings,tasks`,
    );

    const contactIds = associationIds(company, "contacts");
    const contactResults = await Promise.allSettled(contactIds.slice(0, 100).map(loadContactWithAssociations));
    const contacts = contactResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
      .map(result => result.value);

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
        for (const activityId of associationIds(contact, type)) {
          if (!sourceMaps[type].has(activityId)) sourceMaps[type].set(activityId, contactId);
        }
      }
    }

    const noteIds = unique([...associationIds(company, "notes"), ...Array.from(sourceMaps.notes.keys())]);
    const callIds = unique([...associationIds(company, "calls"), ...Array.from(sourceMaps.calls.keys())]);
    const meetingIds = unique([...associationIds(company, "meetings"), ...Array.from(sourceMaps.meetings.keys())]);
    const taskIds = unique([...associationIds(company, "tasks"), ...Array.from(sourceMaps.tasks.keys())]);
    const dealIds = unique(associationIds(company, "deals"));

    const [notesRaw, callsRaw, meetingsRaw, tasksRaw, deals] = await Promise.all([
      batchRead("notes", noteIds, NOTE_PROPERTIES),
      batchRead("calls", callIds, CALL_PROPERTIES),
      batchRead("meetings", meetingIds, MEETING_PROPERTIES),
      batchRead("tasks", taskIds, TASK_PROPERTIES),
      batchRead("deals", dealIds, DEAL_PROPERTIES),
    ]);

    const callsEnriched = await attachOnoffCallDetails(callsRaw);
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
    const calls = callsEnriched.map(record => decorate("calls", record));
    const meetings = meetingsRaw.map(record => {
      const decorated = decorate("meetings", record);
      const startAt = record.properties?.hs_meeting_start_time || record.properties?.hs_timestamp || null;
      const status = record.properties?.hs_meeting_outcome || (startAt && new Date(startAt).getTime() >= Date.now() ? "SCHEDULED" : "UNREVIEWED");
      return { ...decorated, derived: { startAt, status } };
    });
    const tasks = tasksRaw.map(record => decorate("tasks", record));

    notes.sort((a, b) => new Date(b.properties?.hs_timestamp || b.properties?.hs_createdate || 0).getTime() - new Date(a.properties?.hs_timestamp || a.properties?.hs_createdate || 0).getTime());
    calls.sort((a, b) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());
    meetings.sort((a, b) => new Date(b.derived?.startAt || 0).getTime() - new Date(a.derived?.startAt || 0).getTime());
    tasks.sort((a, b) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());

    const nextMeeting = meetings
      .filter(meeting => meeting.derived?.status === "SCHEDULED" && new Date(meeting.derived?.startAt || 0).getTime() >= Date.now())
      .sort((a, b) => new Date(a.derived?.startAt || 0).getTime() - new Date(b.derived?.startAt || 0).getTime())[0] || null;

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
      source: "cockpit+hubspot",
      company: { ...company, id: String(company.id), properties: { ...(company.properties || {}), __hubspot_id: String(company.id) } },
      contacts: contacts.map(contact => ({
        ...contact,
        id: String(contact.id),
        properties: { ...(contact.properties || {}), __hubspot_id: String(contact.id) },
      })),
      notes,
      calls,
      meetings,
      tasks,
      deals,
      nextMeeting,
      associationWarnings: contactResults.filter(result => result.status === "rejected").length,
      activitySummary: {
        notes: notes.length,
        calls: calls.length,
        meetings: meetings.length,
        tasks: tasks.length,
        total: notes.length + calls.length + meetings.length + tasks.length,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (hubspotError) {
    console.warn("Centralized HubSpot company unavailable, serving Cockpit data:", hubspotError);
    try {
      const localPayload = await loadLocalCompanyPayload(companyId);
      if (localPayload) return NextResponse.json(localPayload, { headers: { "cache-control": "no-store" } });
    } catch (localError) {
      console.error("Local company fallback:", localError);
    }

    const e = hubspotError as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de charger l’entreprise" }, { status: e.status === 404 ? 404 : 500 });
  }
}
