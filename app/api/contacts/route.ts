import { NextRequest, NextResponse } from "next/server";
import { pushLocalContactToHubSpot } from "@/lib/contact-sync-outbox";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const createAllowed = ["firstname","lastname","email","phone","mobilephone","jobtitle","company","city","state","hubspot_owner_id"];

function toHubSpotRecord(row: any) {
  const properties = {
    firstname: row.first_name ?? undefined,
    lastname: row.last_name ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    jobtitle: row.job_title ?? undefined,
    hubspot_owner_id: row.owner_hubspot_id ?? undefined,
    ...(row.raw_data?.properties ?? {}),
    __sync_status: row.hubspot_id ? "synced" : "pending",
  };
  return {
    id: row.hubspot_id ? String(row.hubspot_id) : `local:${row.id}`,
    local_id: String(row.id),
    properties,
    sync_status: row.hubspot_id ? "synced" : "pending",
  };
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

    let builder = getSupabaseAdmin().from("contacts").select("id,hubspot_id,first_name,last_name,email,phone,job_title,owner_hubspot_id,raw_data", { count: "exact" });
    if (owner) builder = builder.eq("owner_hubspot_id", owner);
    if (prospection) builder = builder.filter("raw_data->properties->>statut_prospection", "eq", prospection);
    if (callStatus) builder = builder.filter("raw_data->properties->>statut_de_lappel", "eq", callStatus);
    if (startMs) builder = builder.filter("raw_data->properties->>hs_last_sales_activity_timestamp", "gte", startMs);
    if (endMs) builder = builder.filter("raw_data->properties->>hs_last_sales_activity_timestamp", "lte", endMs);
    if (query) builder = builder.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
    builder = builder.order("hubspot_updated_at", { ascending: true, nullsFirst: true }).range(offset, offset + 99);

    const { data, error, count } = await builder;
    if (error) throw error;
    const results = (data ?? []).map(toHubSpotRecord);
    const total = count ?? results.length;
    const nextAfter = offset + results.length < total ? String(offset + 100) : null;
    return NextResponse.json({ results, total, paging: nextAfter ? { next: { after: nextAfter } } : null });
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
    ) as Record<string, string>;
    if (!props.firstname && !props.lastname && !props.email && !props.phone && !props.mobilephone) {
      return NextResponse.json({ error: "Renseignez au moins un nom, un email ou un téléphone." }, { status: 400 });
    }

    const companyIds = Array.isArray(body.companyIds)
      ? [...new Set(body.companyIds.map((value: unknown) => String(value).trim()).filter(Boolean))].slice(0, 20)
      : [];
    const supabase = getSupabaseAdmin();
    let localCompanyId: string | null = null;
    if (companyIds.length) {
      const { data: company } = await supabase.from("companies").select("id").eq("hubspot_id", companyIds[0]).maybeSingle();
      localCompanyId = company?.id ? String(company.id) : null;
    }

    const now = new Date().toISOString();
    const { data: localContact, error: insertError } = await supabase.from("contacts").insert({
      hubspot_id: null,
      company_id: localCompanyId,
      first_name: props.firstname ?? null,
      last_name: props.lastname ?? null,
      email: props.email ?? null,
      phone: props.phone || props.mobilephone || null,
      job_title: props.jobtitle ?? null,
      owner_hubspot_id: props.hubspot_owner_id ?? null,
      raw_data: {
        properties: props,
        __cockpit_sync: {
          status: "pending",
          pendingCompanyIds: companyIds,
          createdAt: now,
          updatedAt: now,
          lastError: null,
        },
      },
      hubspot_updated_at: null,
      updated_at: now,
    }).select("id").single();
    if (insertError) throw insertError;

    try {
      const synced = await pushLocalContactToHubSpot(String(localContact.id));
      return NextResponse.json(synced, { status: 201 });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : String(syncError);
      return NextResponse.json({
        id: `local:${localContact.id}`,
        local_id: String(localContact.id),
        properties: { ...props, __sync_status: "pending" },
        sync_status: "pending",
        sync_message: "Contact enregistré dans le Cockpit. Synchronisation HubSpot en attente.",
        sync_error: message,
      }, { status: 201 });
    }
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message || "Impossible d’enregistrer le contact dans le Cockpit", details: e }, { status: 500 });
  }
}
