import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const properties = ["name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id","num_associated_contacts","hs_last_sales_activity_timestamp","hs_object_source_label","createdate"];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const segmentId = url.searchParams.get("segmentId");
    const after = url.searchParams.get("after");
    if (segmentId) {
      const internal = new URL(`/api/segments/${segmentId}/members`, request.url);
      internal.searchParams.set("objectTypeId", "0-2");
      if (after) internal.searchParams.set("after", after);
      const res = await fetch(internal, { headers: { cookie: request.headers.get("cookie") || "" }, cache: "no-store" });
      return new NextResponse(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
    }
    const query = url.searchParams.get("q")?.trim();
    const owner = url.searchParams.get("owner")?.trim();
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const filters = [] as { propertyName: string; operator: string; value: string }[];
    if (owner) filters.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: owner });
    if (start) filters.push({ propertyName: "hs_last_sales_activity_timestamp", operator: "GTE", value: start });
    if (end) filters.push({ propertyName: "hs_last_sales_activity_timestamp", operator: "LTE", value: end });
    const body: Record<string, unknown> = { limit: 100, properties, sorts: [{ propertyName: "hs_last_sales_activity_timestamp", direction: "ASCENDING" }] };
    if (query) body.query = query;
    if (after) body.after = after;
    if (filters.length) body.filterGroups = [{ filters }];
    const data = await hubspotJson("/crm/objects/2026-03/companies/search", { method: "POST", body: JSON.stringify(body) });
    return NextResponse.json(data);
  } catch (error) { return apiError(error); }
}
