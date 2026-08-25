import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { refreshCallRecommendations } from "@/lib/call-recommendations";
import { ensureContactProspectionOptions } from "@/lib/hubspot/qualification-schema";

const CONTACT_DETAIL_PROPERTIES = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","city","state","country","company","hubspot_owner_id",
  "statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","date_recyclage","minari_call_count","referly_reason_to_reach_out",
  "notes_last_contacted","hs_last_sales_activity_timestamp","hs_object_source_label","createdate",
  "ce_quil_apprecie_chez_gando","objections__retours","zip","campagne_dacquisition","taille_de_flo","hs_country_region_code",
  "suite","solution_paiement_reservation",
];

const editable = [
  "firstname","lastname","email","phone","mobilephone","jobtitle","city","state","country","company","hubspot_owner_id",
  "statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","date_recyclage","ce_quil_apprecie_chez_gando",
  "objections__retours","zip","campagne_dacquisition","taille_de_flo","hs_country_region_code","suite","solution_paiement_reservation",
];

const ACTIVITY_TYPES: Record<string, { path: string; associationTypeId: number; allowed: string[]; type: string }> = {
  note: { path: "notes", associationTypeId: 202, allowed: ["hs_note_body","hs_timestamp","hubspot_owner_id"], type: "note" },
  call: { path: "calls", associationTypeId: 196, allowed: ["hs_call_title","hs_call_body","hs_call_status","hs_call_disposition","hs_call_duration","hs_timestamp","hubspot_owner_id"], type: "call" },
  task: { path: "tasks", associationTypeId: 197, allowed: ["hs_task_subject","hs_task_body","hs_task_status","hs_task_priority","hs_task_type","hs_timestamp","hubspot_owner_id"], type: "task" },
  meeting: { path: "meetings", associationTypeId: 200, allowed: ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hs_timestamp","hubspot_owner_id"], type: "meeting" },
};

const PROSPECTION_KEYS = new Set(["statut_prospection", "resultat_prospection", "statut_de_lappel", "date_prochaine_relance", "date_recyclage"]);

const COMPANY_STATUS_SCORE: Record<string, number> = {
  "À contacter": 30,
  "Tentative": 45,
  "Contact établi": 70,
  "À relancer": 80,
  "Ultérieur": 60,
  "Opportunité": 90,
  "Gagné": 100,
  "Pas intéressé": 10,
  "Perdu": 5,
};

const COMPANY_CALL_STATUS: Record<string, string> = {
  "Intéressé": "interesse",
  "Intéressé mais": "interesse_mais",
  "A une date ultérieure": "a_une_date_ulterieure",
  "À une date ultérieure": "a_une_date_ulterieure",
  "A Rappeler": "a_rappeler",
  "À rappeler": "a_rappeler",
  "pas intéressé": "pas_interesse",
  "Pas intéressé": "pas_interesse",
  "Occupé": "occupe",
  "NRP": "nrp",
  "HORS CIBLE": "hors_cible",
  "Hors cible": "hors_cible",
  "En attente décision": "en_attente_decision",
  "Numéro invalide": "numero_invalide",
  "Autres": "autres",
};

function hubspotRecord(row: any) {
  return { id: String(row.hubspot_id), properties: row.raw_data?.properties ?? {} };
}

function lastMultiValue(value?: string | null) {
  return String(value || "").split(";").map(item => item.trim()).filter(Boolean).at(-1) || "";
}

function contactStatusFromCall(value?: string | null) {
  const call = lastMultiValue(value);
  if (["NRP", "Occupé", "A Rappeler", "À rappeler"].includes(call)) return "En prospection";
  if (["Intéressé", "Intéressé mais", "En attente décision"].includes(call)) return "Conversation";
  if (["A une date ultérieure", "À une date ultérieure"].includes(call)) return "À recycler";
  if (["pas intéressé", "Pas intéressé"].includes(call)) return "Pas intéressé";
  if (["HORS CIBLE", "Hors cible", "Numéro invalide"].includes(call)) return "Non qualifié";
  return undefined;
}

function companyWorkflowFromContact(properties: Record<string, string | null | undefined>) {
  const contactStatus = String(properties.statut_prospection || "").trim();
  const rawCall = lastMultiValue(properties.statut_de_lappel);
  const callStatus = COMPANY_CALL_STATUS[rawCall] || rawCall;

  if (contactStatus === "RDV booké") return { status: "Opportunité", leadStatus: "OPEN_DEAL", callStatus: callStatus || "interesse" };
  if (contactStatus === "Conversation" && !["interesse_mais", "en_attente_decision"].includes(callStatus)) {
    return { status: "Contact établi", leadStatus: "CONNECTED", callStatus: callStatus || "interesse" };
  }
  if (contactStatus === "À recycler") return { status: "Ultérieur", leadStatus: "BAD_TIMING", callStatus: callStatus || "a_une_date_ulterieure" };
  if (contactStatus === "Pas intéressé") return { status: "Pas intéressé", leadStatus: "UNQUALIFIED", callStatus: callStatus || "pas_interesse" };
  if (contactStatus === "Non qualifié" || contactStatus === "Perdu") return { status: "Perdu", leadStatus: "UNQUALIFIED", callStatus };
  if (contactStatus === "À prospecter") return { status: "À contacter", leadStatus: "OPEN", callStatus };

  if (callStatus === "nrp") return { status: "Tentative", leadStatus: "ATTEMPTED_TO_CONTACT", callStatus };
  if (["a_rappeler", "occupe", "interesse_mais", "en_attente_decision"].includes(callStatus)) return { status: "À relancer", leadStatus: "BAD_TIMING", callStatus };
  if (callStatus === "a_une_date_ulterieure") return { status: "Ultérieur", leadStatus: "BAD_TIMING", callStatus };
  if (callStatus === "interesse") return { status: "Contact établi", leadStatus: "CONNECTED", callStatus };
  if (callStatus === "pas_interesse") return { status: "Pas intéressé", leadStatus: "UNQUALIFIED", callStatus };
  if (["hors_cible", "numero_invalide"].includes(callStatus)) return { status: "Perdu", leadStatus: "UNQUALIFIED", callStatus };
  if (contactStatus === "Conversation") return { status: "Contact établi", leadStatus: "CONNECTED", callStatus };
  if (contactStatus === "En prospection") return { status: "Tentative", leadStatus: "ATTEMPTED_TO_CONTACT", callStatus };
  return { status: "À contacter", leadStatus: "OPEN", callStatus };
}

async function syncCompanyProspectionFromContact(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  contact: any,
  contactProperties: Record<string, string | null | undefined>,
  source: string,
) {
  let companyRow: any = null;
  if (contact?.company_id) {
    const result = await supabase.from("companies").select("*").eq("id", contact.company_id).maybeSingle();
    companyRow = result.data;
  }

  if (!companyRow) {
    const contactWithAssociations = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(String(contact.hubspot_id))}?associations=companies`);
    const companyHubSpotId = contactWithAssociations.associations?.companies?.results?.[0]?.id;
    if (companyHubSpotId) {
      const result = await supabase.from("companies").select("*").eq("hubspot_id", String(companyHubSpotId)).maybeSingle();
      companyRow = result.data;
    }
  }

  if (!companyRow?.hubspot_id) return;

  const workflow = companyWorkflowFromContact(contactProperties);
  const reminder = contactProperties.date_recyclage || contactProperties.date_prochaine_relance || "";
  const companyProperties: Record<string, string> = {
    statut_prospection: workflow.status,
    hs_lead_status: workflow.leadStatus,
    statut_de_lappel: workflow.callStatus || "",
    date_de_rappel: reminder,
  };

  const updatedCompany = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(String(companyRow.hubspot_id))}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: companyProperties }),
  });

  const merged = { ...(companyRow.raw_data?.properties ?? {}), ...companyProperties, ...(updatedCompany.properties ?? {}) };
  const { error } = await supabase.from("companies").update({
    raw_data: { ...companyRow.raw_data, ...updatedCompany, properties: merged, updatedAt: new Date().toISOString() },
    hubspot_updated_at: new Date().toISOString(),
    prospecting_status: workflow.status,
    qualification_status: workflow.status,
    qualification_score: COMPANY_STATUS_SCORE[workflow.status] ?? companyRow.qualification_score,
    qualification_reason: `Statut mis à jour depuis le setter (${source})`,
    qualification_next_action_at: reminder || null,
    qualification_last_call_status: workflow.callStatus || companyRow.qualification_last_call_status || null,
    qualification_source: "sales_cockpit_setter",
  }).eq("hubspot_id", String(companyRow.hubspot_id));
  if (error) console.error("Supabase sync company from contact:", error.message);
}

async function refreshRecommendationScores() {
  try {
    await refreshCallRecommendations();
  } catch (error) {
    console.error("Call recommendation refresh:", error);
  }
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
      properties: { ...cachedContact.properties, ...(freshContact.properties ?? {}), __hubspot_id: String(id) },
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
    const properties = Object.fromEntries(Object.entries(body.properties ?? {}).filter(([key]) => editable.includes(key))) as Record<string, string>;
    if (!Object.keys(properties).length) return NextResponse.json({ error: "Aucune propriété modifiable fournie" }, { status: 400 });
    if ("statut_prospection" in properties) await ensureContactProspectionOptions();
    const data = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ properties }) });

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase.from("contacts").select("*").eq("hubspot_id", id).maybeSingle();
    if (existing) {
      const props = { ...(existing.raw_data?.properties ?? {}), ...properties } as Record<string, string | null | undefined>;
      const { error } = await supabase.from("contacts").update({
        raw_data: { ...existing.raw_data, properties: props, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
        first_name: props.firstname ?? null,
        last_name: props.lastname ?? null,
        email: props.email ?? null,
        phone: props.phone || props.mobilephone || null,
        job_title: props.jobtitle ?? null,
        owner_hubspot_id: props.hubspot_owner_id ?? null,
      }).eq("hubspot_id", id);
      if (error) console.error("Supabase update contact:", error.message);
      else {
        if (Object.keys(properties).some(key => PROSPECTION_KEYS.has(key))) {
          await syncCompanyProspectionFromContact(supabase, existing, props, "fiche contact");
        }
        await refreshRecommendationScores();
      }
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
    ) as Record<string, string>;
    if (!properties.hs_timestamp) properties.hs_timestamp = new Date().toISOString();
    if (!Object.keys(properties).length) return NextResponse.json({ error: "Aucune donnée à créer" }, { status: 400 });
    const data = await hubspotJson(`/crm/objects/2026-03/${def.path}`, {
      method: "POST",
      body: JSON.stringify({
        properties,
        associations: [{ to: { id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: def.associationTypeId }] }],
      }),
    });

    const supabase = getSupabaseAdmin();
    const { data: contact } = await supabase.from("contacts").select("*").eq("hubspot_id", id).maybeSingle();
    if (contact) {
      if (def.type === "task") {
        const taskRow = {
          hubspot_id: String(data.id),
          contact_id: contact.id,
          title: properties.hs_task_subject ?? null,
          body: properties.hs_task_body ?? null,
          status: properties.hs_task_status ?? "NOT_STARTED",
          priority: properties.hs_task_priority ?? null,
          due_at: properties.hs_timestamp || new Date().toISOString(),
          owner_hubspot_id: properties.hubspot_owner_id ?? null,
          raw_data: data,
          hubspot_updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("tasks").upsert(taskRow, { onConflict: "hubspot_id" });
        if (error) console.error("Supabase upsert task:", error.message);
        else await refreshRecommendationScores();
      } else {
        const activityRow = {
          hubspot_id: String(data.id),
          activity_type: def.type,
          contact_id: contact.id,
          occurred_at: def.type === "meeting"
            ? (properties.hs_meeting_start_time || properties.hs_timestamp || new Date().toISOString())
            : (properties.hs_timestamp || new Date().toISOString()),
          subject: def.type === "call" ? properties.hs_call_title ?? null : def.type === "meeting" ? properties.hs_meeting_title ?? null : null,
          body: def.type === "note" ? properties.hs_note_body ?? null : def.type === "call" ? properties.hs_call_body ?? null : properties.hs_meeting_location ?? null,
          outcome: def.type === "call" ? properties.hs_call_disposition ?? null : def.type === "meeting" ? properties.hs_meeting_outcome ?? null : null,
          owner_hubspot_id: properties.hubspot_owner_id ?? null,
          raw_data: data,
        };
        const { error } = await supabase.from("activities").upsert(activityRow, { onConflict: "hubspot_id" });
        if (error) console.error("Supabase upsert activity:", error.message);
        else {
          if (def.type === "call" && properties.hs_call_disposition) {
            const status = contactStatusFromCall(properties.hs_call_disposition);
            if (status) {
              const contactPatch = {
                statut_de_lappel: properties.hs_call_disposition,
                statut_prospection: status,
              };
              const updatedContact = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: JSON.stringify({ properties: contactPatch }),
              });
              const mergedContactProps = {
                ...(contact.raw_data?.properties ?? {}),
                ...contactPatch,
                ...(updatedContact.properties ?? {}),
              } as Record<string, string | null | undefined>;
              await supabase.from("contacts").update({
                raw_data: { ...contact.raw_data, ...updatedContact, properties: mergedContactProps, updatedAt: new Date().toISOString() },
                hubspot_updated_at: new Date().toISOString(),
              }).eq("hubspot_id", id);
              await syncCompanyProspectionFromContact(supabase, contact, mergedContactProps, "résultat d’appel");
            }
          }
          await refreshRecommendationScores();
        }
      }
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e }, { status: e.status || 500 });
  }
}
