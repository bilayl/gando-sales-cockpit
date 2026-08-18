import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const contactProps = ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hubspot_owner_id","statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","minari_call_count","referly_call_outcome","referly_reason_to_reach_out","state","city","hs_last_sales_activity_timestamp","notes_last_contacted","hs_object_source_label","createdate"];

const companyProps = [
  "name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id",
  "num_associated_contacts","num_associated_deals","hs_lead_status","statut_de_lappel","date_de_rappel",
  "notes_next_activity_date","notes_last_updated","hs_last_sales_activity_timestamp","hs_object_source_label","createdate",
];

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

    const { data, error } = await getSupabaseAdmin()
      .from(objectPath)
      .select("hubspot_id,raw_data")
      .in("hubspot_id", ids);
    if (error) throw error;
    const byId = new Map((data ?? []).map(r => [String(r.hubspot_id), r.raw_data]));

    // Company-first requires fresh account-level statuses. Read the current HubSpot properties
    // for company segments so an existing hs_lead_status/callback is never hidden by an older cache.
    if (objectTypeId === "0-2") {
      const fresh = await hubspotJson(`/crm/objects/2026-03/${objectPath}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties: props, inputs: ids.map((id: string) => ({ id })) }),
      });
      const freshById = new Map((fresh.results ?? []).map((r: any) => [String(r.id), r.properties ?? {}]));
      const results = ids.map((id: string) => ({
        id,
        properties: { ...(byId.get(id)?.properties ?? {}), ...(freshById.get(id) ?? {}) },
      }));
      return NextResponse.json({ results, total: memberships.total ?? results.length, paging: memberships.paging ?? null });
    }

    const results = ids
      .filter((id: string) => byId.has(id))
      .map((id: string) => ({ id, properties: byId.get(id)?.properties ?? {} }));
    const missing = ids.length - results.length;

    if (missing > 0) {
      const fallbackData = await hubspotJson(`/crm/objects/2026-03/${objectPath}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties: props, inputs: ids.map((id: string) => ({ id })) }),
      });
      const fallback = new Map((fallbackData.results ?? []).map((r: any) => [String(r.id), r.properties]));
      const merged = ids.map((id: string) => {
        const existing = byId.get(id);
        return { id, properties: existing?.properties ?? fallback.get(id) ?? {} };
      });
      return NextResponse.json({ results: merged, total: memberships.total ?? ids.length, paging: memberships.paging ?? null });
    }

    return NextResponse.json({ results, total: memberships.total ?? results.length, paging: memberships.paging ?? null });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur", details: e }, { status: e.status || 500 });
  }
}
