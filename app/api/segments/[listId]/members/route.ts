import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const contactProps = ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hubspot_owner_id","statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","minari_call_count","referly_call_outcome","referly_reason_to_reach_out","state","city","hs_last_sales_activity_timestamp","notes_last_contacted","hs_object_source_label","createdate"];

const companyProps = [
  "name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id",
  "num_associated_contacts","num_associated_deals","hs_lead_status","lifecyclestage","statut_de_lappel","date_de_rappel","statut_prospection",
  "notes_next_activity_date","notes_last_updated","hs_last_sales_activity_timestamp","hs_object_source_label","createdate",
];

const QUALIFICATION_COLUMNS = [
  "qualification_status","qualification_score","qualification_reason","qualification_last_activity_at","qualification_next_action_at",
  "qualification_contacts_count","qualification_open_tasks","qualification_overdue_tasks","qualification_deals_count",
  "qualification_last_call_status","qualification_source","prospecting_status",
];

function qualificationProperties(row: any) {
  const value = (input: unknown) => input === undefined || input === null ? undefined : String(input);
  return {
    qualification_status: value(row?.qualification_status || row?.prospecting_status),
    qualification_score: value(row?.qualification_score),
    qualification_reason: value(row?.qualification_reason),
    qualification_last_activity_at: value(row?.qualification_last_activity_at),
    qualification_next_action_at: value(row?.qualification_next_action_at),
    qualification_contacts_count: value(row?.qualification_contacts_count),
    qualification_open_tasks: value(row?.qualification_open_tasks),
    qualification_overdue_tasks: value(row?.qualification_overdue_tasks),
    qualification_deals_count: value(row?.qualification_deals_count),
    qualification_last_call_status: value(row?.qualification_last_call_status),
    qualification_source: value(row?.qualification_source),
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const url = new URL(request.url);
    const after = url.searchParams.get("after");
    const objectTypeId = url.searchParams.get("objectTypeId") === "0-2" ? "0-2" : "0-1";
    const objectPath = objectTypeId === "0-2" ? "companies" : "contacts";
    const props = objectTypeId === "0-2" ? companyProps : contactProps;
    const membershipPath = `/crm/lists/2026-03/${encodeURIComponent(listId)}/memberships?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const memberships = await hubspotJson(membershipPath);
    const ids = (memberships.results ?? []).map((r: { recordId: string }) => String(r.recordId));
    if (!ids.length) return NextResponse.json({ results: [], total: memberships.total ?? 0, paging: memberships.paging ?? null });

    const select = objectTypeId === "0-2" ? `hubspot_id,raw_data,${QUALIFICATION_COLUMNS.join(",")}` : "hubspot_id,raw_data";
    const { data, error } = await getSupabaseAdmin()
      .from(objectPath)
      .select(select)
      .in("hubspot_id", ids);
    if (error) throw error;
    const byId = new Map((data ?? []).map((row: any) => [String(row.hubspot_id), row]));

    if (objectTypeId === "0-2") {
      const fresh = await hubspotJson(`/crm/objects/2026-03/${objectPath}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties: props, inputs: ids.map((id: string) => ({ id })) }),
      });
      const freshById = new Map((fresh.results ?? []).map((r: any) => [String(r.id), r.properties ?? {}]));
      const results = ids.map((id: string) => {
        const local: any = byId.get(id);
        return {
          id,
          properties: {
            ...(local?.raw_data?.properties ?? {}),
            ...(freshById.get(id) ?? {}),
            ...qualificationProperties(local),
          },
        };
      });
      return NextResponse.json({ results, total: memberships.total ?? results.length, paging: memberships.paging ?? null });
    }

    const results = ids
      .filter((id: string) => byId.has(id))
      .map((id: string) => ({ id, properties: (byId.get(id) as any)?.raw_data?.properties ?? {} }));
    const missing = ids.length - results.length;

    if (missing > 0) {
      const fallbackData = await hubspotJson(`/crm/objects/2026-03/${objectPath}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties: props, inputs: ids.map((id: string) => ({ id })) }),
      });
      const fallback = new Map((fallbackData.results ?? []).map((r: any) => [String(r.id), r.properties]));
      const merged = ids.map((id: string) => {
        const existing: any = byId.get(id);
        return { id, properties: existing?.raw_data?.properties ?? fallback.get(id) ?? {} };
      });
      return NextResponse.json({ results: merged, total: memberships.total ?? ids.length, paging: memberships.paging ?? null });
    }

    return NextResponse.json({ results, total: memberships.total ?? results.length, paging: memberships.paging ?? null });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur", details: e }, { status: e.status || 500 });
  }
}
