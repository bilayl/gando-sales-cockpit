import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function toHubSpotRecord(row: any) {
  return { id: String(row.hubspot_id), properties: row.raw_data?.properties ?? {} };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const segmentId = url.searchParams.get("segmentId");
    if (segmentId) {
      const internal = new URL(`/api/segments/${segmentId}/members`, request.url);
      const after = url.searchParams.get("after");
      internal.searchParams.set("objectTypeId", "0-2");
      if (after) internal.searchParams.set("after", after);
      const res = await fetch(internal, { headers: { cookie: request.headers.get("cookie") || "" }, cache: "no-store" });
      return new NextResponse(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
    }
    const query = url.searchParams.get("q")?.trim();
    const owner = url.searchParams.get("owner")?.trim();
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const offset = Math.max(0, Number(url.searchParams.get("after")) || 0);
    const startMs = start && !Number.isNaN(Date.parse(start)) ? String(Date.parse(start)) : start;
    const endMs = end && !Number.isNaN(Date.parse(end)) ? String(Date.parse(end)) : end;

    let builder = getSupabaseAdmin().from("companies").select("hubspot_id,raw_data", { count: "exact" });
    if (owner) builder = builder.eq("owner_hubspot_id", owner);
    if (query) builder = builder.or(`name.ilike.%${query}%,domain.ilike.%${query}%,city.ilike.%${query}%`);
    if (startMs) builder = builder.filter("raw_data->properties->>hs_last_sales_activity_timestamp", "gte", startMs);
    if (endMs) builder = builder.filter("raw_data->properties->>hs_last_sales_activity_timestamp", "lte", endMs);
    builder = builder.order("hubspot_updated_at", { ascending: true, nullsFirst: false }).range(offset, offset + 99);

    const { data, error, count } = await builder;
    if (error) throw error;
    const results = (data ?? []).map(toHubSpotRecord);
    const total = count ?? results.length;
    const nextAfter = offset + results.length < total ? String(offset + 100) : null;
    return NextResponse.json({
      results,
      total,
      paging: nextAfter ? { next: { after: nextAfter } } : null,
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message || "Erreur Supabase", details: e }, { status: 500 });
  }
}
