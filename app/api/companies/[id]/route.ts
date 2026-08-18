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
  "suite","solution_paiement_reservation","hs_last_sales_activity_timestamp",
];

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

    const [contactsResult, activitiesResult, dealsResult, tasksResult, freshCompany] = await Promise.all([
      supabase.from("contacts").select("hubspot_id,raw_data").eq("company_id", company.id),
      supabase.from("activities").select("hubspot_id,activity_type,occurred_at,raw_data").eq("company_id", company.id),
      supabase.from("deals").select("hubspot_id,raw_data").eq("company_id", company.id),
      supabase.from("tasks").select("hubspot_id,raw_data").eq("company_id", company.id),
      hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}?properties=${encodeURIComponent(companyProperties.join(","))}`),
    ]);
    if (contactsResult.error) throw contactsResult.error;
    if (activitiesResult.error) throw activitiesResult.error;
    if (dealsResult.error) throw dealsResult.error;
    if (tasksResult.error) throw tasksResult.error;

    const cachedCompany = hubspotRecord(company);
    let companyRecord = {
      ...cachedCompany,
      properties: { ...cachedCompany.properties, ...(freshCompany.properties ?? {}), __hubspot_id: String(id) },
    };

    const cachedContacts = (contactsResult.data ?? []).map(hubspotRecord);
    const contactIds = cachedContacts.map(contact => contact.id);
    let contacts = cachedContacts.map(contact => ({
      ...contact,
      properties: { ...contact.properties, __hubspot_id: contact.id },
    }));
    if (contactIds.length) {
      const freshContacts = await hubspotJson(`/crm/objects/2026-03/contacts/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties: CONTACT_PROFILE_PROPERTIES, inputs: contactIds.map(contactId => ({ id: contactId })) }),
      });
      const freshById = new Map((freshContacts.results ?? []).map((record: any) => [String(record.id), record.properties ?? {}]));
      contacts = cachedContacts.map(contact => ({
        ...contact,
        properties: { ...contact.properties, ...(freshById.get(contact.id) ?? {}), __hubspot_id: contact.id },
      }));
    }

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

    return NextResponse.json({ company: companyRecord, contacts, notes, calls, meetings, deals, tasks, nextMeeting, qualificationSchema });
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
