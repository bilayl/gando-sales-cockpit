import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { saveCallOutcome } from "@/lib/hubspot/contacts";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const outcome = String(body.outcome || "").trim();
    const reminderAt = body.reminderAt ? String(body.reminderAt) : undefined;
    if (!outcome) return NextResponse.json({ error: "Choisissez un résultat d’appel" }, { status: 400 });
    const result = await saveCallOutcome(id, outcome, reminderAt);

    const { data: existing } = await supabaseAdmin.from("contacts").select("*").eq("hubspot_id", id).maybeSingle();
    if (existing) {
      const updated = result.contact as { properties?: Record<string, string | null | undefined>; updatedAt?: string };
      const props = { ...(existing.raw_data?.properties ?? {}), ...(updated.properties ?? {}) };
      const { error } = await supabaseAdmin.from("contacts").update({
        raw_data: { ...existing.raw_data, properties: props, updatedAt: new Date().toISOString() },
        hubspot_updated_at: new Date().toISOString(),
        owner_hubspot_id: props.hubspot_owner_id ?? existing.owner_hubspot_id,
      }).eq("hubspot_id", id);
      if (error) console.error("Supabase update contact outcome:", error.message);
    }

    if (result.task) {
      const task = result.task as { id: string; properties?: Record<string, string | null | undefined>; createdAt?: string };
      const tp = task.properties ?? {};
      const { data: contact } = await supabaseAdmin.from("contacts").select("id").eq("hubspot_id", id).maybeSingle();
      const { error } = await supabaseAdmin.from("tasks").upsert({
        hubspot_id: String(task.id),
        contact_id: contact?.id ?? null,
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
