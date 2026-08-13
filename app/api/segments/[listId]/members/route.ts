import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const contactProps = ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hubspot_owner_id","statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","minari_call_count","referly_call_outcome","referly_reason_to_reach_out","state","city","hs_last_sales_activity_timestamp","notes_last_contacted","hs_object_source_label","createdate"];

const companyProps = ["name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id","num_associated_contacts","hs_last_sales_activity_timestamp","hs_object_source_label","createdate"];

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
    const data = await hubspotJson(`/crm/objects/2026-03/${objectPath}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ properties: props, inputs: ids.map((id: string) => ({ id })) }),
    });
    return NextResponse.json({ results: data.results ?? [], total: memberships.total ?? ids.length, paging: memberships.paging ?? null });
  } catch (error) { return apiError(error); }
}
