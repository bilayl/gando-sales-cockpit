import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { COMPANY_QUALIFICATION_SCHEMAS, ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BASE_COMPANY_DETAIL_PROPERTIES = [
  "name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id","num_associated_contacts",
  "num_associated_deals","hs_last_sales_activity_timestamp","hs_object_source_label","createdate","hs_lead_status","lifecyclestage",
  "statut_de_lappel","date_de_rappel","zip","hs_country_code","taille_flotte","solution_paiement_reservation",
];

const CONTACT_PROFILE_PROPERTIES = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","company","statut_prospection","statut_de_lappel",
  "ce_quil_apprecie_chez_gando","objections__retours","zip","campagne_dacquisition","taille_de_flo","hs_country_region_code",
  "suite","solution_paiement_reservation","hs_last_sales_activity_timestamp","hubspot_owner_id",
];

const NOTE_PROPERTIES = ["hs_note_body","hs_timestamp","hs_createdate","hs_object_source_label","hubspot_owner_id"];
const CALL_PROPERTIES = ["hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_call_duration","hs_timestamp","hubspot_owner_id"];
const MEETING_PROPERTIES = ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hs_internal_meeting_notes","hs_timestamp","hubspot_owner_id"];
const TASK_PROPERTIES = ["hs_task_subject","hs_task_body","hs_task_status","hs_task_priority","hs_task_type","hs_timestamp","hubspot_owner_id"];
const DEAL_PROPERTIES = ["dealname","amount","pipeline","dealstage","closedate","createdate","hubspot_owner_id"];

const CUSTOM_QUALIFICATION_PROPERTIES = new Set(COMPANY_QUALIFICATION_SCHEMAS.map(property => property.name));

const EDITABLE_PROPERTIES = new Set([
  "name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id",
  "hs_lead_status","lifecyclestage","statut_de_lappel","date_de_rappel","zip","hs_country_code","taille_flotte",
  "solution_paiement_reservation","ce_quil_apprecie_chez_gando","objections__retours","campagne_dacquisition","suite","statut_prospection",
]);

const CONTACT_TO_COMPANY_CALL: Record<string, string> = {
  "Intéressé": "interesse",
  "AssisterIntéressé mais": "assister",
  "Intéressé mais": "interesse_mais",
  "A une date ultérieure": "a_une_date_ulterieure",
  "A Rappeler": "a_rappeler",
  "pas intéressé": "pas_interesse",
  "Occupé": "occupe",
  "NRP": "nrp",
  "HORS CIBLE": "hors_cible",
  "En attente décision": "en_attente_decision",
  "Autres": "autres",
  "Numéro invalide": "numero_invalide",
};

type HubSpotRecord = {
  id: string;
  properties?: Record<string, string | null | undefined>;
  associations?: Record<string, { results?: Array<{ id: string }> }>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

function hubspotRecord(row: any) {
  return { id: String(row.hubspot_id), properties: row.raw_data?.properties ?? {} };
}

function valueExists(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function splitMulti(value?: string | null) {
  return (value || "").split(";").map(item => item.trim()).filter(Boolean);
}

function mergeMulti(contacts: any[], property: string) {
  const values = new Set<string>();
  for (const contact of contacts) {
    for (const value of splitMulti(contact.properties?.[property])) values.add(value);
  }
  return Array.from(values).join(";");
}

function latestValue(contacts: any[], property: string) {
  for (const contact of contacts) {
    const value = contact.properties?.[property];
    if (valueExists(value)) return String(value);
  }
  return "";
}

function companyProspectionLabel(properties: Record<string, any>) {
  if (String(properties.lifecyclestage || "").toLowerCase() === "customer") return "Gagné";
  if (properties.hs_lead_status === "UNQUALIFIED") return "Perdu";
  if (properties.hs_lead_status === "OPEN_DEAL") return "Opportunité";
  if (properties.hs_lead_status === "BAD_TIMING") {
    return properties.statut_de_lappel === "a_une_date_ulterieure" ? "Ultérieur" : "À relancer";
  }
  if (properties.hs_lead_status === "CONNECTED") return "Contact établi";
  if (properties.hs_lead_status === "ATTEMPTED_TO_CONTACT") return "Tentative";
  if (properties.hs_lead_status === "OPEN") return "À contacter";
  return "À travailler";
}

function companyStatusProperties(value: string) {
  const map: Record<string, Record<string, string>> = {
    "À travailler": { hs_lead_status: "NEW", lifecyclestage: "" },
    "À contacter": { hs_lead_status: "OPEN", lifecyclestage: "" },
    "Tentative": { hs_lead_status: "ATTEMPTED_TO_CONTACT", lifecyclestage: "" },
    "Contact établi": { hs_lead_status: "CONNECTED", lifecyclestage: "" },
    "À relancer": { hs_lead_status: "BAD_TIMING", statut_de_lappel: "a_rappeler", lifecyclestage: "" },
    "Ultérieur": { hs_lead_status: "BAD_TIMING", statut_de_lappel: "a_une_date_ulterieure", lifecyclestage: "" },
    "Opportunité": { hs_lead_status: "OPEN_DEAL", lifecyclestage: "opportunity" },
    "Gagné": { hs_lead_status: "OPEN_DEAL", lifecyclestage: "customer" },
    "Perdu": { hs_lead_status: "UNQUALIFIED", lifecyclestage: "" },
  };
  return map[value] || {};
}

function sortContactsByActivity(contacts: any[]) {
  return [...contacts].sort((a, b) => {
    const aDate = Date.parse(a.properties?.hs_last_sales_activity_timestamp || "") || 0;
    const bDate = Date.parse(b.properties?.hs_last_sales_activity_timestamp || "") || 0;
    return bDate - aDate;
  });
}

function associationIds(record: any, key: string) {
  return (record?.associations?.[key]?.results || []).map((item: { id: string }) => String(item.id));
}

function hasAssociationKey(record: any, key: string) {
  return Boolean(record?.associations && Object.prototype.hasOwnProperty.call(record.associations, key));
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function chunks<T>(items: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function readHubSpotBatch(objectPath: string, ids: string[], properties: string[]) {
  const records: HubSpotRecord[] = [];
  for (const batch of chunks(unique(ids))) {
    if (!batch.length) continue;
    try {
      const data = await hubspotJson(`/crm/objects/2026-03/${objectPath}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties, inputs: batch.map(id => ({ id })) }),
      });
      records.push(...(data.results || []));
    } catch (error) {
      console.error(`HubSpot batch read ${objectPath}:`, error);
    }
  }
  return records;
}

async function updateLocalCompany(id: string, updated: any, fallbackProperties?: Record<string, string>) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
  if (!existing) return;
  const merged = { ...(existing.raw_data?.properties ?? {}), ...(fallbackProperties ?? {}), ...(updated?.properties ?? {}) };
  const { error } = await supabase.from("companies").update({
    raw_data: { ...existing.raw_data, ...(updated ?? {}), properties: merged, updatedAt: new Date().toISOString() },
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

function mergeById(primary: any[], fallback: any[]) {
  const map = new Map<string, any>();
  for (const item of fallback) map.set(String(item.id), item);
  for (const item of primary) map.set(String(item.id), { ...(map.get(String(item.id)) || {}), ...item, properties: { ...(map.get(String(item.id))?.properties || {}), ...(item.properties || {}) } });
  return [...map.values()];
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data: company, error } = await supabase.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
    if (error) throw error;
    if (!company) return NextResponse.json({ error: "Entreprise introuvable dans Supabase. Lancez une synchronisation." }, { status: 404 });

    const qualificationSchema = await ensureCompanyQualificationProperties().catch(error => ({
      available: [] as string[],
      created: [] as string[],
      unavailable: COMPANY_QUALIFICATION_SCHEMAS.map(property => ({ name: property.name, error: error instanceof Error ? error.message : "Schéma HubSpot indisponible" })),
    }));
    const companyProperties = [...BASE_COMPANY_DETAIL_PROPERTIES, ...qualificationSchema.available];

    const [localLinkedContacts, localCompanyActivities, localCompanyTasks, localCompanyDeals, freshCompany] = await Promise.all([
      supabase.from("contacts").select("id,hubspot_id,raw_data").eq("company_id", company.id),
      supabase.from("activities").select("hubspot_id,activity_type,occurred_at,contact_id,raw_data").eq("company_id", company.id),
      supabase.from("tasks").select("hubspot_id,contact_id,raw_data").eq("company_id", company.id),
      supabase.from("deals").select("hubspot_id,raw_data").eq("company_id", company.id),
      hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}?properties=${encodeURIComponent(companyProperties.join(","))}&associations=contacts,deals,notes,calls,meetings,tasks`),
    ]);
    if (localLinkedContacts.error) throw localLinkedContacts.error;
    if (localCompanyActivities.error) throw localCompanyActivities.error;
    if (localCompanyTasks.error) throw localCompanyTasks.error;
    if (localCompanyDeals.error) throw localCompanyDeals.error;

    const cachedCompany = hubspotRecord(company);
    let companyRecord = {
      ...cachedCompany,
      properties: { ...cachedCompany.properties, ...(freshCompany.properties ?? {}), __hubspot_id: String(id) },
    };

    // HubSpot is the source of truth for associations. Supabase is used only as a fallback
    // when the association collection is not returned by HubSpot.
    const localContactIds = (localLinkedContacts.data || []).map((contact: any) => String(contact.hubspot_id));
    const contactIds = hasAssociationKey(freshCompany, "contacts")
      ? associationIds(freshCompany, "contacts")
      : localContactIds;

    const { data: cachedContactRows, error: cachedContactError } = contactIds.length
      ? await supabase.from("contacts").select("id,hubspot_id,raw_data").in("hubspot_id", contactIds)
      : { data: [], error: null } as any;
    if (cachedContactError) throw cachedContactError;

    const cachedContactMap = new Map((cachedContactRows || []).map((row: any) => [String(row.hubspot_id), row]));
    let freshContacts: HubSpotRecord[] = [];
    if (contactIds.length) {
      const data = await hubspotJson(`/crm/objects/2026-03/contacts/batch/read?associations=notes,calls,meetings,tasks`, {
        method: "POST",
        body: JSON.stringify({ properties: CONTACT_PROFILE_PROPERTIES, inputs: contactIds.map(contactId => ({ id: contactId })) }),
      });
      freshContacts = data.results || [];
    }

    const freshContactMap = new Map(freshContacts.map(contact => [String(contact.id), contact]));
    const contacts = contactIds.map(contactId => {
      const cached = cachedContactMap.get(contactId);
      const fresh = freshContactMap.get(contactId);
      return {
        ...(fresh || {}),
        id: contactId,
        properties: {
          ...(cached?.raw_data?.properties || {}),
          ...(fresh?.properties || {}),
          __hubspot_id: contactId,
        },
        associations: fresh?.associations || cached?.raw_data?.associations || {},
      };
    });

    // Keep the local company_id synchronized with the real HubSpot association set.
    if (contacts.length) {
      const localRows = contacts.map((contact: any) => {
        const properties = contact.properties || {};
        const cached = cachedContactMap.get(String(contact.id));
        return {
          hubspot_id: String(contact.id),
          company_id: company.id,
          first_name: properties.firstname ?? null,
          last_name: properties.lastname ?? null,
          email: properties.email ?? null,
          phone: properties.phone || properties.mobilephone || null,
          job_title: properties.jobtitle ?? null,
          owner_hubspot_id: properties.hubspot_owner_id ?? null,
          raw_data: {
            ...(cached?.raw_data || {}),
            ...contact,
            properties: { ...(cached?.raw_data?.properties || {}), ...properties },
          },
          hubspot_updated_at: contact.updatedAt || new Date().toISOString(),
        };
      });
      const { error: localSyncError } = await supabase.from("contacts").upsert(localRows, { onConflict: "hubspot_id" });
      if (localSyncError) console.error("Supabase sync HubSpot company contacts:", localSyncError.message);
    }

    // Promote existing contact-level qualification history to the company the first time it is missing there.
    const orderedContacts = sortContactsByActivity(contacts);
    const current = companyRecord.properties as Record<string, string>;
    const backfill: Record<string, string> = {};
    const setIfMissing = (property: string, value: string, requireCustomSchema = false) => {
      if (!valueExists(current[property]) && valueExists(value) && (!requireCustomSchema || qualificationSchema.available.includes(property))) {
        backfill[property] = value;
      }
    };

    setIfMissing("ce_quil_apprecie_chez_gando", mergeMulti(orderedContacts, "ce_quil_apprecie_chez_gando"), true);
    setIfMissing("objections__retours", mergeMulti(orderedContacts, "objections__retours"), true);
    setIfMissing("campagne_dacquisition", latestValue(orderedContacts, "campagne_dacquisition"), true);
    setIfMissing("suite", latestValue(orderedContacts, "suite"), true);
    setIfMissing("zip", latestValue(orderedContacts, "zip"));
    setIfMissing("taille_flotte", latestValue(orderedContacts, "taille_de_flo"));
    setIfMissing("hs_country_code", latestValue(orderedContacts, "hs_country_region_code"));
    setIfMissing("solution_paiement_reservation", latestValue(orderedContacts, "solution_paiement_reservation"));

    const contactCall = splitMulti(latestValue(orderedContacts, "statut_de_lappel")).at(-1) || "";
    setIfMissing("statut_de_lappel", CONTACT_TO_COMPANY_CALL[contactCall] || "");
    setIfMissing("statut_prospection", companyProspectionLabel({ ...current, ...backfill }), true);

    if (Object.keys(backfill).length) {
      try {
        const migrated = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ properties: backfill }),
        });
        companyRecord = {
          ...companyRecord,
          properties: { ...companyRecord.properties, ...backfill, ...(migrated.properties ?? {}), __hubspot_id: String(id) },
        };
        await updateLocalCompany(id, migrated, backfill);
      } catch (migrationError) {
        console.error("HubSpot qualification backfill company:", migrationError);
      }
    }

    // Build a centralized activity index: direct company activities + every activity
    // associated with any HubSpot contact of the company.
    const contactNameById = new Map<string, string>();
    const activitySourceContact = {
      notes: new Map<string, string>(),
      calls: new Map<string, string>(),
      meetings: new Map<string, string>(),
      tasks: new Map<string, string>(),
    };

    for (const contact of contacts) {
      const cp = contact.properties || {};
      contactNameById.set(String(contact.id), [cp.firstname, cp.lastname].filter(Boolean).join(" ") || cp.email || "Contact");
      for (const type of ["notes", "calls", "meetings", "tasks"] as const) {
        for (const activityId of associationIds(contact, type)) {
          if (!activitySourceContact[type].has(activityId)) activitySourceContact[type].set(activityId, String(contact.id));
        }
      }
    }

    const directIds = {
      notes: hasAssociationKey(freshCompany, "notes") ? associationIds(freshCompany, "notes") : [],
      calls: hasAssociationKey(freshCompany, "calls") ? associationIds(freshCompany, "calls") : [],
      meetings: hasAssociationKey(freshCompany, "meetings") ? associationIds(freshCompany, "meetings") : [],
      tasks: hasAssociationKey(freshCompany, "tasks") ? associationIds(freshCompany, "tasks") : [],
      deals: hasAssociationKey(freshCompany, "deals") ? associationIds(freshCompany, "deals") : (localCompanyDeals.data || []).map((deal: any) => String(deal.hubspot_id)),
    };

    const noteIds = unique([...directIds.notes, ...activitySourceContact.notes.keys()]);
    const callIds = unique([...directIds.calls, ...activitySourceContact.calls.keys()]);
    const meetingIds = unique([...directIds.meetings, ...activitySourceContact.meetings.keys()]);
    const taskIds = unique([...directIds.tasks, ...activitySourceContact.tasks.keys()]);

    const localContactInternalIds = (cachedContactRows || []).map((row: any) => row.id).filter(Boolean);
    const [localContactActivities, localContactTasks, freshNotes, freshCalls, freshMeetings, freshTasks, freshDeals] = await Promise.all([
      localContactInternalIds.length
        ? supabase.from("activities").select("hubspot_id,activity_type,occurred_at,contact_id,raw_data").in("contact_id", localContactInternalIds)
        : Promise.resolve({ data: [], error: null }),
      localContactInternalIds.length
        ? supabase.from("tasks").select("hubspot_id,contact_id,raw_data").in("contact_id", localContactInternalIds)
        : Promise.resolve({ data: [], error: null }),
      readHubSpotBatch("notes", noteIds, NOTE_PROPERTIES),
      readHubSpotBatch("calls", callIds, CALL_PROPERTIES),
      readHubSpotBatch("meetings", meetingIds, MEETING_PROPERTIES),
      readHubSpotBatch("tasks", taskIds, TASK_PROPERTIES),
      readHubSpotBatch("deals", directIds.deals, DEAL_PROPERTIES),
    ]);

    const localActivityRows = [...(localCompanyActivities.data || []), ...(localContactActivities.data || [])];
    const localTaskRows = [...(localCompanyTasks.data || []), ...(localContactTasks.data || [])];

    const sourceFor = (type: "notes" | "calls" | "meetings" | "tasks", record: any) => {
      const contactId = activitySourceContact[type].get(String(record.id));
      return contactId
        ? { sourceType: "contact", sourceContactId: contactId, sourceContactName: contactNameById.get(contactId) || "Contact" }
        : { sourceType: "company", sourceContactId: null, sourceContactName: null };
    };

    const localNotes = localActivityRows.filter((row: any) => row.activity_type === "note").map(hubspotRecord);
    const localCalls = localActivityRows.filter((row: any) => row.activity_type === "call").map(hubspotRecord);
    const localMeetings = localActivityRows.filter((row: any) => row.activity_type === "meeting").map(hubspotRecord);
    const localTasks = localTaskRows.map(hubspotRecord);

    const notes = mergeById(freshNotes, localNotes).map((record: any) => ({ ...record, ...sourceFor("notes", record) }));
    const calls = mergeById(freshCalls, localCalls)
      .map((record: any) => ({ ...record, ...sourceFor("calls", record) }))
      .sort((a: any, b: any) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());
    const meetings = mergeById(freshMeetings, localMeetings)
      .map((record: any) => {
        const startAt = record.properties?.hs_meeting_start_time || record.properties?.hs_timestamp || null;
        const outcome = record.properties?.hs_meeting_outcome || (startAt && new Date(startAt).getTime() >= Date.now() ? "SCHEDULED" : "UNREVIEWED");
        return { ...record, ...sourceFor("meetings", record), derived: { startAt, status: outcome } };
      })
      .sort((a: any, b: any) => new Date(b.derived.startAt || 0).getTime() - new Date(a.derived.startAt || 0).getTime());
    const tasks = mergeById(freshTasks, localTasks)
      .map((record: any) => ({ ...record, ...sourceFor("tasks", record) }))
      .sort((a: any, b: any) => new Date(b.properties?.hs_timestamp || 0).getTime() - new Date(a.properties?.hs_timestamp || 0).getTime());
    const deals = mergeById(freshDeals, (localCompanyDeals.data || []).map(hubspotRecord));

    const nextMeeting = [...meetings]
      .filter((meeting: any) => meeting.derived.status === "SCHEDULED" && new Date(meeting.derived.startAt || 0).getTime() >= Date.now())
      .sort((a: any, b: any) => new Date(a.derived.startAt).getTime() - new Date(b.derived.startAt).getTime())[0] || null;

    return NextResponse.json({
      company: companyRecord,
      contacts,
      notes,
      calls,
      meetings,
      deals,
      tasks,
      nextMeeting,
      qualificationSchema,
      activitySummary: {
        notes: notes.length,
        calls: calls.length,
        meetings: meetings.length,
        tasks: tasks.length,
        total: notes.length + calls.length + meetings.length + tasks.length,
      },
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message || "Erreur Supabase", details: e }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    let properties = Object.fromEntries(
      Object.entries(body.properties ?? {}).filter(([key, value]) => EDITABLE_PROPERTIES.has(key) && value !== undefined && value !== null),
    ) as Record<string, string>;

    if (!Object.keys(properties).length) {
      return NextResponse.json({ error: "Aucune propriété entreprise modifiable fournie" }, { status: 400 });
    }

    const requestedCustom = Object.keys(properties).filter(key => CUSTOM_QUALIFICATION_PROPERTIES.has(key));
    const needsQualificationSchema = requestedCustom.length > 0 || ["hs_lead_status", "lifecyclestage", "statut_de_lappel"].some(key => key in properties);
    let schemaAvailable = new Set<string>();
    if (needsQualificationSchema) {
      const schema = await ensureCompanyQualificationProperties();
      schemaAvailable = new Set(schema.available);
      const missingRequested = requestedCustom.filter(key => !schemaAvailable.has(key));
      if (missingRequested.length) {
        return NextResponse.json({
          error: `Propriété HubSpot indisponible : ${missingRequested.join(", ")}`,
          details: schema.unavailable,
        }, { status: 409 });
      }
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
    const existingProperties = existing?.raw_data?.properties ?? {};

    if (properties.statut_prospection) {
      properties = { ...properties, ...companyStatusProperties(properties.statut_prospection) };
    } else if (["hs_lead_status", "lifecyclestage", "statut_de_lappel"].some(key => key in properties) && schemaAvailable.has("statut_prospection")) {
      properties.statut_prospection = companyProspectionLabel({ ...existingProperties, ...properties });
    }

    const updated = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });

    await updateLocalCompany(id, updated, properties);
    return NextResponse.json(updated);
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e }, { status: e.status || 500 });
  }
}
