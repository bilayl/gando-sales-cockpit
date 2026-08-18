import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { createCompanyReminderTask } from "@/lib/hubspot/tasks";
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

function parseReminder(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
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

    const company = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}?properties=name,domain,hubspot_owner_id,hs_lead_status,lifecyclestage,statut_de_lappel,date_de_rappel`);
    const properties: Record<string, string> = {};
    const leadStatus = HUBSPOT_LEAD_STATUS[action];
    if (leadStatus) properties.hs_lead_status = leadStatus;

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

    let task = null;
    if (action === "LATER" && reminderAt) {
      task = await createCompanyReminderTask(company, reminderAt, body.reason ? String(body.reason) : undefined);
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

      if (task) {
        const tp = task.properties ?? {};
        const { error: taskError } = await supabase.from("tasks").upsert({
          hubspot_id: String(task.id),
          company_id: existing.id,
          title: tp.hs_task_subject ?? null,
          body: tp.hs_task_body ?? null,
          status: tp.hs_task_status ?? null,
          priority: tp.hs_task_priority ?? null,
          due_at: tp.hs_timestamp ? new Date(tp.hs_timestamp).toISOString() : null,
          owner_hubspot_id: tp.hubspot_owner_id ?? null,
          raw_data: task,
          hubspot_updated_at: new Date().toISOString(),
        }, { onConflict: "hubspot_id" });
        if (taskError) console.error("Supabase workflow task:", taskError.message);
      }
    }

    return NextResponse.json({ company: updated, task, workflow: { action, reminderAt: reminderAt?.toISOString() || null } });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur workflow HubSpot", details: e }, { status: e.status || 500 });
  }
}
