import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const createAllowed = ["firstname","lastname","email","phone","mobilephone","jobtitle","company","city","state","hubspot_owner_id"];

function toHubSpotRecord(row: any) {
  return { id: String(row.hubspot_id), properties: row.raw_data?.properties ?? {} };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const segmentId = url.searchParams.get("segmentId");
    const after = url.searchParams.get("after");
    if (segmentId) {
      const internal = new URL(`/api/segments/${segmentId}/members`, request.url);
      internal.searchParams.set("objectTypeId", "0-1");
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
    const offset = Math.max(0, Number(url.searchParams.get("after")) || 0);
    const startMs = start && !Number.isNaN(Date.parse(start)) ? String(Date.parse(start)) : start;
    const endMs = end && !Number.isNaN(Date.parse(end)) ? String(Date.parse(end)) : end;

    let builder = getSupabaseAdmin().from("contacts").select("hubspot_id,raw_data", { count: "exact" });
    if (owner) builder = builder.eq("owner_hubspot_id", owner);
    if (prospection) builder = builder.filter("raw_data->properties->>statut_prospection", "eq", prospection);
    if (callStatus) builder = builder.filter("raw_data->properties->>statut_de_lappel", "eq", callStatus);
    if (startMs) builder = builder.filter("raw_data->properties->>hs_last_sales_activity_timestamp", "gte", startMs);
    if (endMs) builder = builder.filter("raw_data->properties->>hs_last_sales_activity_timestamp", "lte", endMs);
    if (query) builder = builder.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const props = Object.fromEntries(
      Object.entries(body.properties ?? {})
        .filter(([key, value]) => createAllowed.includes(key) && value !== undefined && value !== null && String(value).trim() !== "")
        .map(([key, value]) => [key, String(value).trim()])
    );
    if (!props.firstname && !props.lastname && !props.email && !props.phone) {
      return NextResponse.json({ error: "Renseignez au moins un nom, un email ou un tÃ©lÃ©phone" }, { status: 400 });
    }
    const data = await hubspotJson("/crm/objects/2026-03/contacts", { method: "POST", body: JSON.stringify({ properties: props }) });
    const row = {
      hubspot_id: String(data.id),
      first_name: props.firstname ?? null,
      last_name: props.lastname ?? null,
      email: props.email ?? null,
      phone: props.phone ?? null,
      job_title: props.jobtitle ?? null,
      owner_hubspot_id: props.hubspot_owner_id ?? null,
      raw_data: data,
      hubspot_updated_at: new Date().toISOString(),
    };
    const { error } = await getSupabaseAdmin().from("contacts").upsert(row, { onConflict: "hubspot_id" });
    if (error) console.error("Supabase upsert contact:", error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e }, { status: e.status || 500 });
  }
}
