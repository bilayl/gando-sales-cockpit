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
  | "DEMO_SCHEDULED"
  | "OPEN_DEAL"
  | "WON"
  | "NOT_INTERESTED"
  | "LOST";

const HUBSPOT_LEAD_STATUS: Partial<Record<WorkflowAction, string>> = {
  NEW: "NEW",
  OPEN: "OPEN",
  ATTEMPTED_TO_CONTACT: "ATTEMPTED_TO_CONTACT",
  CONNECTED: "CONNECTED",
  FOLLOW_UP: "BAD_TIMING",
  LATER: "BAD_TIMING",
  DEMO_SCHEDULED: "CONNECTED",
  OPEN_DEAL: "OPEN_DEAL",
  NOT_INTERESTED: "UNQUALIFIED",
  LOST: "UNQUALIFIED",
};

const PROSPECTION_LABEL: Record<WorkflowAction, string> = {
  NEW: "À travailler",
  OPEN: "À contacter",
  ATTEMPTED_TO_CONTACT: "Tentative",
  CONNECTED: "Contact établi",
  FOLLOW_UP: "À relancer",
  LATER: "Ultérieur",
  DEMO_SCHEDULED: "Démo prévue",
  OPEN_DEAL: "Opportunité",
  WON: "Gagné",
  NOT_INTERESTED: "Pas intéressé",
  LOST: "Perdu",
};

const QUALIFICATION_SCORE: Record<WorkflowAction, number> = {
  NEW: 20,
  OPEN: 30,
  ATTEMPTED_TO_CONTACT: 45,
  CONNECTED: 70,
  FOLLOW_UP: 80,
  LATER: 60,
  DEMO_SCHEDULED: 85,
  OPEN_DEAL: 90,
  WON: 100,
  NOT_INTERESTED: 10,
  LOST: 5,
};

function parseReminder(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Identifiant HubSpot entreprise invalide." }, { status: 400 });

    const body = await request.json();
    const action = String(body.action || "").trim() as WorkflowAction;
    const allowed: WorkflowAction[] = ["NEW", "OPEN", "ATTEMPTED_TO_CONTACT", "CONNECTED", "FOLLOW_UP", "LATER", "DEMO_SCHEDULED", "OPEN_DEAL", "WON", "NOT_INTERESTED", "LOST"];
    if (!allowed.includes(action)) return NextResponse.json({ error: "Action de workflow invalide" }, { status: 400 });

    const reminderAt = parseReminder(body.reminderAt);
    if (action === "LATER") {
      if (!reminderAt) return NextResponse.json({ error: "Une date de reprise est obligatoire pour Ultérieur" }, { status: 400 });
      if (reminderAt.getTime() <= Date.now()) return NextResponse.json({ error: "La date de reprise doit être dans le futur" }, { status: 400 });
    }

    const schema = await ensureCompanyQualificationProperties().catch(() => ({ available: [] as string[], created: [] as string[], unavailable: [] }));
    const company = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}?properties=name,domain,hubspot_owner_id,hs_lead_status,lifecyclestage,statut_de_lappel,date_de_rappel`);
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
        properties.statut_de_lappel = "";
        properties.date_de_rappel = "";
        break;
      case "ATTEMPTED_TO_CONTACT":
        properties.statut_de_lappel = "nrp";
        properties.date_de_rappel = "";
        break;
      case "CONNECTED":
      case "DEMO_SCHEDULED":
      case "OPEN_DEAL":
        properties.statut_de_lappel = "interesse";
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
      case "NOT_INTERESTED":
        properties.statut_de_lappel = "pas_interesse";
        properties.date_de_rappel = "";
        break;
      case "WON":
        properties.lifecyclestage = "customer";
        properties.statut_de_lappel = "interesse";
        properties.date_de_rappel = "";
        break;
      case "LOST":
        properties.date_de_rappel = "";
        break;
    }

    const updated = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
    if (existing) {
      const merged = { ...(existing.raw_data?.properties ?? {}), ...(updated.properties ?? properties) };
      const { error } = await supabase.from("companies").update({
        raw_data: { ...existing.raw_data, ...updated, properties: merged, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
        prospecting_status: PROSPECTION_LABEL[action],
        qualification_status: PROSPECTION_LABEL[action],
        qualification_score: QUALIFICATION_SCORE[action],
        qualification_reason: body.reason ? String(body.reason) : "Statut modifié depuis le Gando Sales Cockpit",
        qualification_next_action_at: reminderAt?.toISOString() || null,
        qualification_last_call_status: properties.statut_de_lappel || existing.qualification_last_call_status || null,
        qualification_source: "sales_cockpit_manual",
      }).eq("hubspot_id", id);
      if (error) console.error("Supabase workflow company:", error.message);
    }

    const companyResponse = {
      ...updated,
      properties: {
        ...(updated.properties || {}),
        qualification_status: PROSPECTION_LABEL[action],
        qualification_score: String(QUALIFICATION_SCORE[action]),
        qualification_reason: body.reason ? String(body.reason) : "Statut modifié depuis le Gando Sales Cockpit",
        qualification_next_action_at: reminderAt?.toISOString() || "",
      },
    };

    return NextResponse.json({
      company: companyResponse,
      contact: null,
      task: null,
      workflow: {
        action,
        reminderAt: reminderAt?.toISOString() || null,
        contactId: null,
        automationOwner: "company",
      },
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur workflow HubSpot", details: e }, { status: e.status || 500 });
  }
}
