import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const properties = ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hubspot_owner_id","statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","minari_call_count","referly_call_outcome","referly_reason_to_reach_out","state","city","hs_last_sales_activity_timestamp","notes_last_contacted","hs_object_source_label","createdate"];

const createAllowed = ["firstname","lastname","email","phone","mobilephone","jobtitle","company","city","state","hubspot_owner_id"];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const segmentId = url.searchParams.get("segmentId");
    const after = url.searchParams.get("after");
    if (segmentId) {
      const internal = new URL(`/api/segments/${segmentId}/members`, request.url);
      if (after) internal.searchParams.set("after", after);
      const res = await fetch(internal, { headers: { cookie: request.headers.get("cookie") || "" }, cache: "no-store" });
      return new NextResponse(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
    }
    const query = url.searchParams.get("q")?.trim();
    const owner = url.searchParams.get("owner")?.trim();
    const prospection = url.searchParams.get("prospection")?.trim();
    const callStatus = url.searchParams.get("callStatus")?.trim();
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const filters = [] as { propertyName: string; operator: string; value: string }[];
    if (owner) filters.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: owner });
    if (prospection) filters.push({ propertyName: "statut_prospection", operator: "EQ", value: prospection });
    if (callStatus) filters.push({ propertyName: "statut_de_lappel", operator: "EQ", value: callStatus });
    if (start) filters.push({ propertyName: "hs_last_sales_activity_timestamp", operator: "GTE", value: start });
    if (end) filters.push({ propertyName: "hs_last_sales_activity_timestamp", operator: "LTE", value: end });
    const body: Record<string, unknown> = { limit: 100, properties, sorts: [{ propertyName: "hs_last_sales_activity_timestamp", direction: "ASCENDING" }] };
    if (query) body.query = query;
    if (after) body.after = after;
    if (filters.length) body.filterGroups = [{ filters }];
    const data = await hubspotJson("/crm/objects/2026-03/contacts/search", { method: "POST", body: JSON.stringify(body) });
    return NextResponse.json(data);
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const properties = Object.fromEntries(
      Object.entries(body.properties ?? {})
        .filter(([key, value]) => createAllowed.includes(key) && value !== undefined && value !== null && String(value).trim() !== "")
        .map(([key, value]) => [key, String(value).trim()])
    );
    if (!properties.firstname && !properties.lastname && !properties.email && !properties.phone) {
      return NextResponse.json({ error: "Renseignez au moins un nom, un email ou un téléphone" }, { status: 400 });
    }
    const data = await hubspotJson("/crm/objects/2026-03/contacts", { method: "POST", body: JSON.stringify({ properties }) });
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return apiError(error); }
}
