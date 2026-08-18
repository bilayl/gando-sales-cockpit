import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hubspotJson } from "@/lib/hubspot";

type HubSpotRecord = { id: string; properties: Record<string, string | null | undefined>; createdAt?: string; updatedAt?: string };

const COMPANY_PROPERTIES = [
  "name","domain","phone","website","city","zip","state","country","industry","description","hubspot_owner_id","num_associated_contacts","num_associated_deals",
  "hs_last_sales_activity_timestamp","hs_object_source_label","createdate","hs_lead_status","lifecyclestage","statut_de_lappel","date_de_rappel","statut_prospection",
  "ce_quil_apprecie_chez_gando","objections__retours","campagne_dacquisition","suite","taille_flotte","hs_country_code","solution_paiement_reservation",
];

const CONTACT_PROPERTIES = [
  "firstname","lastname","email","phone","mobilephone","company","jobtitle","hs_parent_company_id","hubspot_owner_id","statut_prospection","resultat_prospection",
  "statut_de_lappel","date_prochaine_relance","date_recyclage","minari_call_count","referly_call_outcome","referly_reason_to_reach_out","state","city",
  "hs_last_sales_activity_timestamp","notes_last_contacted","hs_object_source_label","createdate","ce_quil_apprecie_chez_gando","objections__retours","campagne_dacquisition",
  "suite","taille_de_flo","hs_country_region_code","solution_paiement_reservation",
];

const DEAL_PROPERTIES = ["dealname","amount","pipeline","dealstage","associatedcompanyid","hubspot_owner_id","closedate","createdate"];

const TASK_PROPERTIES = ["hs_task_subject","hs_task_body","hs_task_status","hs_task_priority","hs_task_type","hs_timestamp","hubspot_owner_id"];

const NOTE_PROPERTIES = ["hs_note_body","hs_timestamp","hs_createdate","hs_object_source_label"];
const CALL_PROPERTIES = ["hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_call_duration","hs_timestamp","hubspot_owner_id"];
const MEETING_PROPERTIES = ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hs_timestamp","hubspot_owner_id"];

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

type SyncResult = { resource: string; upserted: number; paged: boolean };

type SyncState = {
  resource: string;
  last_synced_at?: string | null;
  after_cursor?: string | null;
  status?: string | null;
  last_error?: string | null;
};

async function getState(resource: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin().from("hubspot_sync_state").select("after_cursor").eq("resource", resource).maybeSingle();
  return (data?.after_cursor as string | null) ?? null;
}

async function saveState(state: SyncState) {
  await getSupabaseAdmin().from("hubspot_sync_state").upsert({
    resource: state.resource,
    last_synced_at: state.last_synced_at ?? new Date().toISOString(),
    after_cursor: state.after_cursor ?? null,
    status: state.status ?? "complete",
    last_error: state.last_error ?? null,
  }, { onConflict: "resource" });
}

async function runSync(
  stateResource: string,
  table: string,
  objectPath: string,
  properties: string[],
  mapPage: (records: HubSpotRecord[]) => Promise<Record<string, unknown>[]>,
) {
  const initial = await getState(stateResource);
  const result = await paginate(objectPath, properties, async (records, nextAfter) => {
    const rows = await mapPage(records);
    await upsertRows(table, rows);
    await saveState({ resource: stateResource, after_cursor: nextAfter, status: nextAfter ? "in_progress" : "complete" });
  }, initial);
  if (!result.paged) await saveState({ resource: stateResource, after_cursor: null, status: "complete" });
  return { resource: stateResource.split(":")[0], ...result };
}

async function loadIdMap(table: "companies" | "contacts" | "deals") {
  const { data, error } = await getSupabaseAdmin().from(table).select("hubspot_id,id");
  if (error) throw error;
  return new Map((data ?? []).map(r => [String(r.hubspot_id), String(r.id)]));
}

async function upsertRows(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { error } = await getSupabaseAdmin().from(table).upsert(rows, { onConflict: "hubspot_id" });
  if (error) throw error;
}

async function associationTargets(fromType: string, toType: "contacts" | "companies" | "deals", ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string[]>();
  try {
    const data = await hubspotJson(`/crm/associations/2026-03/${fromType}/${toType}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ inputs: unique.map(id => ({ id })) }),
    });
    return new Map<string, string[]>((data.results || []).map((row: any) => [
      String(row.from?.id || row.fromObjectId || ""),
      (row.to || []).map((target: any) => String(target.toObjectId || target.id || "")).filter(Boolean),
    ]));
  } catch (error) {
    console.error(`HubSpot sync association ${fromType}->${toType}:`, error);
    return new Map<string, string[]>();
  }
}

async function fetchAssociations(type: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, { contactId: string | null; companyId: string | null; dealId: string | null }>();
  const [contacts, companies, deals] = await Promise.all([
    associationTargets(type, "contacts", unique),
    associationTargets(type, "companies", unique),
    associationTargets(type, "deals", unique),
  ]);
  const map = new Map<string, { contactId: string | null; companyId: string | null; dealId: string | null }>();
  for (const id of unique) {
    map.set(id, {
      contactId: contacts.get(id)?.[0] ?? null,
      companyId: companies.get(id)?.[0] ?? null,
      dealId: deals.get(id)?.[0] ?? null,
    });
  }
  return map;
}

async function paginate(objectPath: string, properties: string[], onPage: (records: HubSpotRecord[], nextAfter: string | null) => Promise<void>, initialAfter: string | null) {
  let after = initialAfter;
  let pages = 0;
  let total = 0;
  let hasMore = true;
  while (pages < 200 && hasMore) {
    const body: Record<string, unknown> = { limit: 100, properties };
    if (after) body.after = after;
    const data = await hubspotJson(`/crm/objects/2026-03/${objectPath}/search`, { method: "POST", body: JSON.stringify(body) });
    const results = (data.results ?? []) as HubSpotRecord[];
    total += results.length;
    const nextAfter = data.paging?.next?.after ?? null;
    await onPage(results, nextAfter);
    hasMore = Boolean(nextAfter) && results.length > 0;
    if (hasMore) after = nextAfter;
    pages++;
  }
  return { upserted: total, paged: hasMore };
}

export async function syncCompanies(): Promise<SyncResult> {
  return runSync("companies", "companies", "companies", COMPANY_PROPERTIES, async records =>
    records.map(r => {
      const p = r.properties ?? {};
      return {
        hubspot_id: String(r.id),
        name: p.name || p.domain || "Sans nom",
        domain: p.domain ?? null,
        phone: p.phone ?? null,
        website: p.website ?? null,
        city: p.city ?? null,
        postal_code: p.zip ?? null,
        country: p.country ?? null,
        owner_hubspot_id: p.hubspot_owner_id ?? null,
        raw_data: r,
        hubspot_updated_at: r.updatedAt ?? null,
      };
    }),
  );
}

export async function syncContacts(): Promise<SyncResult> {
  const companyIdMap = await loadIdMap("companies");
  return runSync("contacts", "contacts", "contacts", CONTACT_PROPERTIES, async records => {
    const assocMap = await fetchAssociations("contacts", records.map(r => String(r.id)));
    return records.map(r => {
      const p = r.properties ?? {};
      const associatedCompany = assocMap.get(String(r.id))?.companyId || p.hs_parent_company_id || null;
      return {
        hubspot_id: String(r.id),
        company_id: associatedCompany ? companyIdMap.get(String(associatedCompany)) ?? null : null,
        first_name: p.firstname ?? null,
        last_name: p.lastname ?? null,
        email: p.email ?? null,
        phone: p.phone || p.mobilephone || null,
        job_title: p.jobtitle ?? null,
        owner_hubspot_id: p.hubspot_owner_id ?? null,
        raw_data: r,
        hubspot_updated_at: r.updatedAt ?? null,
      };
    });
  });
}

export async function syncDeals(): Promise<SyncResult> {
  const companyIdMap = await loadIdMap("companies");
  return runSync("deals", "deals", "deals", DEAL_PROPERTIES, async records => {
    const assocMap = await fetchAssociations("deals", records.map(r => String(r.id)));
    return records.map(r => {
      const p = r.properties ?? {};
      const company = assocMap.get(String(r.id))?.companyId || p.associatedcompanyid;
      return {
        hubspot_id: String(r.id),
        company_id: company ? companyIdMap.get(String(company)) ?? null : null,
        name: p.dealname ?? null,
        pipeline_id: p.pipeline ?? null,
        stage_id: p.dealstage ?? null,
        amount: p.amount ? Number(p.amount) : null,
        owner_hubspot_id: p.hubspot_owner_id ?? null,
        close_date: toIso(p.closedate),
        raw_data: r,
        hubspot_updated_at: r.updatedAt ?? null,
      };
    });
  });
}

export async function syncTasks(): Promise<SyncResult> {
  const companyIdMap = await loadIdMap("companies");
  const contactIdMap = await loadIdMap("contacts");
  const dealIdMap = await loadIdMap("deals");
  return runSync("tasks", "tasks", "tasks", TASK_PROPERTIES, async records => {
    const assocMap = await fetchAssociations("tasks", records.map(r => String(r.id)));
    return records.map(r => {
      const p = r.properties ?? {};
      const a = assocMap.get(String(r.id)) ?? { contactId: null, companyId: null, dealId: null };
      return {
        hubspot_id: String(r.id),
        company_id: a.companyId ? companyIdMap.get(a.companyId) ?? null : null,
        contact_id: a.contactId ? contactIdMap.get(a.contactId) ?? null : null,
        deal_id: a.dealId ? dealIdMap.get(a.dealId) ?? null : null,
        title: p.hs_task_subject ?? null,
        body: p.hs_task_body ?? null,
        status: p.hs_task_status ?? null,
        priority: p.hs_task_priority ?? null,
        due_at: toIso(p.hs_timestamp),
        owner_hubspot_id: p.hubspot_owner_id ?? null,
        raw_data: r,
        hubspot_updated_at: r.updatedAt ?? null,
      };
    });
  });
}

async function syncActivitiesType(activityType: string, objectPath: string, properties: string[]): Promise<SyncResult> {
  const companyIdMap = await loadIdMap("companies");
  const contactIdMap = await loadIdMap("contacts");
  const dealIdMap = await loadIdMap("deals");
  const stateResource = `activities:${activityType}`;
  return runSync(stateResource, "activities", objectPath, properties, async records => {
    const assocMap = await fetchAssociations(objectPath, records.map(r => String(r.id)));
    return records.map(r => {
      const p = r.properties ?? {};
      const a = assocMap.get(String(r.id)) ?? { contactId: null, companyId: null, dealId: null };
      let subject: string | null = null;
      let body: string | null = null;
      let outcome: string | null = null;
      let occurredAt: string | null = null;
      if (activityType === "note") {
        body = p.hs_note_body ?? null;
        occurredAt = p.hs_timestamp || p.hs_createdate || r.createdAt || null;
      } else if (activityType === "call") {
        subject = p.hs_call_title ?? null;
        body = p.hs_call_body ?? null;
        outcome = p.hs_call_disposition ?? null;
        occurredAt = p.hs_timestamp || r.createdAt || null;
      } else if (activityType === "meeting") {
        subject = p.hs_meeting_title ?? null;
        outcome = p.hs_meeting_outcome ?? null;
        occurredAt = p.hs_meeting_start_time || p.hs_timestamp || r.createdAt || null;
      }
      return {
        hubspot_id: String(r.id),
        activity_type: activityType,
        company_id: a.companyId ? companyIdMap.get(a.companyId) ?? null : null,
        contact_id: a.contactId ? contactIdMap.get(a.contactId) ?? null : null,
        deal_id: a.dealId ? dealIdMap.get(a.dealId) ?? null : null,
        occurred_at: toIso(occurredAt),
        subject,
        body,
        outcome,
        owner_hubspot_id: p.hubspot_owner_id ?? null,
        raw_data: r,
      };
    });
  });
}

export async function syncActivities(): Promise<SyncResult[]> {
  const [notes, calls, meetings] = await Promise.all([
    syncActivitiesType("note", "notes", NOTE_PROPERTIES),
    syncActivitiesType("call", "calls", CALL_PROPERTIES),
    syncActivitiesType("meeting", "meetings", MEETING_PROPERTIES),
  ]);
  return [notes, calls, meetings];
}

export async function syncAll() {
  const results: Record<string, unknown> = {};
  results.companies = await syncCompanies();
  results.contacts = await syncContacts();
  results.deals = await syncDeals();
  results.tasks = await syncTasks();
  const activities = await syncActivities();
  for (const a of activities) results[a.resource] = a;
  return results;
}
