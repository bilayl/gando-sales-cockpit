import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type WorkflowAction =
  | "NEW"
  | "OPEN"
  | "ATTEMPTED_TO_CONTACT"
  | "CONNECTED"
  | "FOLLOW_UP"
  | "LATER"
  | "OPEN_DEAL"
  | "WON"
  | "LOST";

const HUBSPOT_LEAD_STATUS: Partial<Record<WorkflowAction, string>> = {
  NEW: "NEW",
  OPEN: "OPEN",
  ATTEMPTED_TO_CONTACT: "ATTEMPTED_TO_CONTACT",
  CONNECTED: "CONNECTED",
  FOLLOW_UP: "BAD_TIMING",
  LATER: "BAD_TIMING",
  OPEN_DEAL: "OPEN_DEAL",
  LOST: "UNQUALIFIED",
};

const PROSPECTION_LABEL: Record<WorkflowAction, string> = {
  NEW: "À travailler",
  OPEN: "À contacter",
  ATTEMPTED_TO_CONTACT: "Tentative",
  CONNECTED: "Contact établi",
  FOLLOW_UP: "À relancer",
  LATER: "Ultérieur",
  OPEN_DEAL: "Opportunité",
  WON: "Gagné",
  LOST: "Perdu",
};

const REFERENCE_CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "hubspot_owner_id",
  "hs_last_sales_activity_timestamp",
  "statut_prospection",
  "resultat_prospection",
  "statut_de_lappel",
  "date_prochaine_relance",
  "date_recyclage",
];

function parseReminder(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function contactWorkflowProperties(action: WorkflowAction, reminderAt: Date | null) {
  const clearDates = { date_prochaine_relance: "", date_recyclage: "" };
  switch (action) {
    case "NEW":
    case "OPEN":
      return {
        statut_prospection: "À prospecter",
        resultat_prospection: "",
        ...clearDates,
      };
    case "ATTEMPTED_TO_CONTACT":
      return {
        statut_prospection: "En prospection",
        resultat_prospection: "Sans réponse",
        ...clearDates,
      };
    case "CONNECTED":
      return {
        statut_prospection: "Conversation",
        resultat_prospection: "Conversation",
        ...clearDates,
      };
    case "FOLLOW_UP":
      return {
        statut_prospection: "En prospection",
        resultat_prospection: "À rappeler",
        date_prochaine_relance: reminderAt ? reminderAt.toISOString() : "",
        date_recyclage: "",
      };
    case "LATER":
      return {
        statut_prospection: "À recycler",
        resultat_prospection: "",
        date_prochaine_relance: "",
        date_recyclage: reminderAt ? reminderAt.toISOString() : "",
      };
    case "OPEN_DEAL":
      return {
        statut_prospection: "RDV booké",
        resultat_prospection: "RDV obtenu",
        ...clearDates,
      };
    case "WON":
      return {
        statut_prospection: "Gagné",
        resultat_prospection: "",
        ...clearDates,
      };
    case "LOST":
      return {
        statut_prospection: "Perdu",
        resultat_prospection: "Pas intéressé",
        ...clearDates,
      };
  }
}

async function findReferenceContact(company: any) {
  const ids = (company.associations?.contacts?.results || []).map((item: any) => String(item.id)).filter(Boolean);
  if (!ids.length) return null;

  const result = await hubspotJson("/crm/objects/2026-03/contacts/batch/read", {
    method: "POST",
    body: JSON.stringify({
      properties: REFERENCE_CONTACT_PROPERTIES,
      inputs: ids.slice(0, 100).map((id: string) => ({ id })),
    }),
  });

  const contacts = result.results || [];
  contacts.sort((a: any, b: any) => {
    const aOwnerMatch = a.properties?.hubspot_owner_id && a.properties.hubspot_owner_id === company.properties?.hubspot_owner_id ? 1 : 0;
    const bOwnerMatch = b.properties?.hubspot_owner_id && b.properties.hubspot_owner_id === company.properties?.hubspot_owner_id ? 1 : 0;
    if (aOwnerMatch !== bOwnerMatch) return bOwnerMatch - aOwnerMatch;
    const aDate = Date.parse(a.properties?.hs_last_sales_activity_timestamp || "") || 0;
    const bDate = Date.parse(b.properties?.hs_last_sales_activity_timestamp || "") || 0;
    return bDate - aDate;
  });
  return contacts[0] || null;
}

async function syncLocalContact(contact: any) {
  if (!contact?.id) return;
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("contacts").select("*").eq("hubspot_id", String(contact.id)).maybeSingle();
  if (!existing) return;
  const properties = { ...(existing.raw_data?.properties || {}), ...(contact.properties || {}) };
  const { error } = await supabase.from("contacts").update({
    raw_data: { ...existing.raw_data, ...contact, properties, updatedAt: new Date().toISOString() },
    hubspot_updated_at: new Date().toISOString(),
    owner_hubspot_id: properties.hubspot_owner_id ?? existing.owner_hubspot_id,
  }).eq("hubspot_id", String(contact.id));
  if (error) console.error("Supabase workflow contact:", error.message);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = String(body.action || "").trim() as WorkflowAction;
    const allowed: WorkflowAction[] = ["NEW", "OPEN", "ATTEMPTED_TO_CONTACT", "CONNECTED", "FOLLOW_UP", "LATER", "OPEN_DEAL", "WON", "LOST"];
    if (!allowed.includes(action)) return NextResponse.json({ error: "Action de workflow invalide" }, { status: 400 });

    const reminderAt = parseReminder(body.reminderAt);
    if (action === "LATER") {
      if (!reminderAt) return NextResponse.json({ error: "Une date de reprise est obligatoire pour Ultérieur" }, { status: 400 });
      if (reminderAt.getTime() <= Date.now()) return NextResponse.json({ error: "La date de reprise doit être dans le futur" }, { status: 400 });
    }

    const schema = await ensureCompanyQualificationProperties().catch(() => ({ available: [] as string[], created: [] as string[], unavailable: [] }));
    const company = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}?properties=name,domain,hubspot_owner_id,hs_lead_status,lifecyclestage,statut_de_lappel,date_de_rappel&associations=contacts`);
    const properties: Record<string, string> = {};
    const leadStatus = HUBSPOT_LEAD_STATUS[action];
    if (leadStatus) properties.hs_lead_status = leadStatus;
    if (schema.available.includes("statut_prospection")) properties.statut_prospection = PROSPECTION_LABEL[action];

    if (action !== "WON" && String(company.properties?.lifecyclestage || "").toLowerCase() === "customer") {
      properties.lifecyclestage = "";
    }

    switch (action) {
      case "NEW":
      case "OPEN":
      case "ATTEMPTED_TO_CONTACT":
      case "CONNECTED":
      case "OPEN_DEAL":
        properties.date_de_rappel = "";
        break;
      case "FOLLOW_UP":
        properties.statut_de_lappel = "a_rappeler";
        if (reminderAt) properties.date_de_rappel = reminderAt.toISOString();
        break;
      case "LATER":
        properties.statut_de_lappel = "a_une_date_ulterieure";
        properties.date_de_rappel = reminderAt!.toISOString();
        break;
      case "WON":
        properties.lifecyclestage = "customer";
        properties.statut_de_lappel = "interesse";
        properties.date_de_rappel = "";
        break;
      case "LOST":
        properties.statut_de_lappel = "pas_interesse";
        properties.date_de_rappel = "";
        break;
    }

    const updated = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });

    // HubSpot workflows remain the automation engine. Update exactly one reference
    // contact so WF01-WF04 can enroll without creating duplicate tasks for every
    // person associated with the same company.
    const referenceContact = await findReferenceContact(company).catch(error => {
      console.error("Find workflow reference contact:", error);
      return null;
    });
    let updatedContact = null;
    if (referenceContact) {
      const contactProperties = contactWorkflowProperties(action, reminderAt);
      updatedContact = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(String(referenceContact.id))}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: contactProperties }),
      });
      await syncLocalContact(updatedContact);
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
    if (existing) {
      const merged = { ...(existing.raw_data?.properties ?? {}), ...(updated.properties ?? properties) };
      const { error } = await supabase.from("companies").update({
        raw_data: { ...existing.raw_data, ...updated, properties: merged, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
      }).eq("hubspot_id", id);
      if (error) console.error("Supabase workflow company:", error.message);
    }

    return NextResponse.json({
      company: updated,
      contact: updatedContact,
      task: null,
      workflow: {
        action,
        reminderAt: reminderAt?.toISOString() || null,
        contactId: updatedContact ? String(updatedContact.id) : null,
        automationOwner: "hubspot",
      },
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur workflow HubSpot", details: e }, { status: e.status || 500 });
  }
}
