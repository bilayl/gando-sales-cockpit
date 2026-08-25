import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { saveCallOutcome } from "@/lib/hubspot/contacts";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const COMPANY_STATUS_SCORE: Record<string, number> = {
  "À contacter": 30,
  "Tentative": 45,
  "Contact établi": 70,
  "À relancer": 80,
  "Ultérieur": 60,
  "Démo prévue": 85,
  "Opportunité": 90,
  "Gagné": 100,
  "Pas intéressé": 10,
  "Perdu": 5,
};

function companyProspectionStatus(properties: Record<string, string | null | undefined>) {
  const explicit = String(properties.statut_prospection || "").trim();
  if (explicit) return explicit;
  if (String(properties.lifecyclestage || "").toLowerCase() === "customer") return "Gagné";

  if (properties.hs_lead_status === "UNQUALIFIED") return "Perdu";
  if (properties.hs_lead_status === "OPEN_DEAL") return "Opportunité";
  if (properties.hs_lead_status === "CONNECTED") return "Contact établi";
  if (properties.hs_lead_status === "ATTEMPTED_TO_CONTACT") return "Tentative";
  if (properties.hs_lead_status === "BAD_TIMING") {
    return properties.statut_de_lappel === "a_une_date_ulterieure" ? "Ultérieur" : "À relancer";
  }
  if (properties.hs_lead_status === "OPEN" || properties.hs_lead_status === "NEW") return "À contacter";

  if (properties.statut_de_lappel === "nrp") return "Tentative";
  if (["a_rappeler", "occupe", "interesse_mais", "en_attente_decision"].includes(String(properties.statut_de_lappel || ""))) return "À relancer";
  if (properties.statut_de_lappel === "a_une_date_ulterieure") return "Ultérieur";
  if (properties.statut_de_lappel === "interesse") return "Contact établi";
  if (properties.statut_de_lappel === "pas_interesse") return "Pas intéressé";
  if (["hors_cible", "numero_invalide"].includes(String(properties.statut_de_lappel || ""))) return "Perdu";
  return "À contacter";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const outcome = String(body.outcome || "").trim();
    const reminderAt = body.reminderAt ? String(body.reminderAt) : undefined;
    if (!outcome) return NextResponse.json({ error: "Choisissez un résultat d’appel" }, { status: 400 });
    const result = await saveCallOutcome(id, outcome, reminderAt);
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase.from("contacts").select("*").eq("hubspot_id", id).maybeSingle();
    if (existing) {
      const updated = result.contact as { properties?: Record<string, string | null | undefined>; updatedAt?: string };
      const props = { ...(existing.raw_data?.properties ?? {}), ...(updated.properties ?? {}) };
      const { error } = await supabase.from("contacts").update({
        raw_data: { ...existing.raw_data, properties: props, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
        owner_hubspot_id: props.hubspot_owner_id ?? existing.owner_hubspot_id,
      }).eq("hubspot_id", id);
      if (error) console.error("Supabase update contact outcome:", error.message);
    }

    if (result.company) {
      const company = result.company as { id: string; properties?: Record<string, string | null | undefined> };
      const { data: existingCompany } = await supabase.from("companies").select("*").eq("hubspot_id", String(company.id)).maybeSingle();
      if (existingCompany) {
        const props = { ...(existingCompany.raw_data?.properties ?? {}), ...(company.properties ?? {}) };
        const status = companyProspectionStatus(props);
        const nextActionAt = props.date_de_rappel || reminderAt || null;
        const { error } = await supabase.from("companies").update({
          raw_data: { ...existingCompany.raw_data, ...company, properties: props, updatedAt: new Date().toISOString() },
          hubspot_updated_at: new Date().toISOString(),
          owner_hubspot_id: props.hubspot_owner_id ?? existingCompany.owner_hubspot_id,
          prospecting_status: status,
          qualification_status: status,
          qualification_score: COMPANY_STATUS_SCORE[status] ?? existingCompany.qualification_score,
          qualification_reason: `Résultat d’appel setter : ${outcome}`,
          qualification_next_action_at: nextActionAt,
          qualification_last_call_status: props.statut_de_lappel || existingCompany.qualification_last_call_status || null,
          qualification_source: "sales_cockpit_setter",
        }).eq("hubspot_id", String(company.id));
        if (error) console.error("Supabase update company outcome:", error.message);
      }
    }

    if (result.task) {
      const task = result.task as { id: string; properties?: Record<string, string | null | undefined>; createdAt?: string };
      const tp = task.properties ?? {};
      const { data: contact } = await supabase.from("contacts").select("id,company_id").eq("hubspot_id", id).maybeSingle();
      const { error } = await supabase.from("tasks").upsert({
        hubspot_id: String(task.id),
        contact_id: contact?.id ?? null,
        company_id: contact?.company_id ?? null,
        title: tp.hs_task_subject ?? null,
        body: tp.hs_task_body ?? null,
        status: tp.hs_task_status ?? null,
        due_at: tp.hs_timestamp ? new Date(Number(tp.hs_timestamp)).toISOString() : null,
        owner_hubspot_id: tp.hubspot_owner_id ?? null,
        raw_data: task,
        hubspot_updated_at: new Date().toISOString(),
      }, { onConflict: "hubspot_id" });
      if (error) console.error("Supabase upsert reminder task:", error.message);
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
