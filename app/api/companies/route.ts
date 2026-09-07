import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const COMPANY_PROSPECTION_PROPERTIES = [
  "name","domain","phone","website","zip","city","state","country","industry","description","hubspot_owner_id",
  "num_associated_contacts","num_associated_deals","hs_lead_status","lifecyclestage","statut_de_lappel","date_de_rappel","statut_prospection",
  "notes_next_activity_date","notes_last_updated","hs_last_sales_activity_timestamp","hs_object_source_label","createdate",
  "taille_flotte","taille_de_flo","solution_paiement_reservation","objections__retours",
];

const QUALIFICATION_SELECT = [
  "qualification_status","qualification_score","qualification_reason","qualification_last_activity_at","qualification_next_action_at",
  "qualification_contacts_count","qualification_open_tasks","qualification_overdue_tasks","qualification_deals_count",
  "qualification_last_call_status","qualification_source","prospecting_status",
].join(",");

const LOCAL_SELECT = [
  "hubspot_id","name","domain","phone","website","city","postal_code","country","owner_hubspot_id","raw_data","hubspot_updated_at",
  QUALIFICATION_SELECT,
].join(",");

function value(input: unknown) {
  return input === undefined || input === null ? undefined : String(input);
}

function hasMeaningfulValue(input: unknown) {
  if (input === undefined || input === null) return false;
  if (typeof input === "string") return input.trim() !== "";
  return true;
}

function mergeMeaningfulProperties(
  base: Record<string, unknown>,
  fresh: Record<string, unknown>,
) {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, freshValue] of Object.entries(fresh)) {
    if (hasMeaningfulValue(freshValue)) merged[key] = freshValue;
  }
  return merged;
}

function qualificationProperties(row: any) {
  return {
    qualification_status: value(row.qualification_status || row.prospecting_status),
    qualification_score: value(row.qualification_score),
    qualification_reason: value(row.qualification_reason),
    qualification_last_activity_at: value(row.qualification_last_activity_at),
    qualification_next_action_at: value(row.qualification_next_action_at),
    qualification_contacts_count: value(row.qualification_contacts_count),
    qualification_open_tasks: value(row.qualification_open_tasks),
    qualification_overdue_tasks: value(row.qualification_overdue_tasks),
    qualification_deals_count: value(row.qualification_deals_count),
    qualification_last_call_status: value(row.qualification_last_call_status),
    qualification_source: value(row.qualification_source),
  };
}

function localProperties(row: any) {
  const raw = row.raw_data?.properties ?? {};
  return {
    ...raw,
    // Les colonnes Cockpit restent la source de repli lorsqu'une propriété HubSpot
    // est absente du cache JSON ou que HubSpot n'est pas disponible.
    name: raw.name || row.name || undefined,
    domain: raw.domain || row.domain || undefined,
    phone: raw.phone || row.phone || undefined,
    website: raw.website || row.website || undefined,
    city: raw.city || row.city || undefined,
    zip: raw.zip || row.postal_code || undefined,
    postal_code: raw.postal_code || row.postal_code || undefined,
    state: raw.state || undefined,
    country: raw.country || row.country || undefined,
    hubspot_owner_id: raw.hubspot_owner_id || row.owner_hubspot_id || undefined,
    ...qualificationProperties(row),
  };
}

function toHubSpotRecord(row: any) {
  return {
    id: String(row.hubspot_id),
    properties: localProperties(row),
  };
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

    let builder = getSupabaseAdmin().from("companies").select(LOCAL_SELECT, { count: "exact" });
    if (owner) builder = builder.eq("owner_hubspot_id", owner);
    if (query) builder = builder.or(`name.ilike.%${query}%,domain.ilike.%${query}%,city.ilike.%${query}%`);
    if (startMs) builder = builder.filter("raw_data->properties->>hs_last_sales_activity_timestamp", "gte", startMs);
    if (endMs) builder = builder.filter("raw_data->properties->>hs_last_sales_activity_timestamp", "lte", endMs);
    builder = builder.order("hubspot_updated_at", { ascending: false, nullsFirst: false }).range(offset, offset + 99);

    const { data, error, count } = await builder;
    if (error) throw error;
    const cached = (data ?? []).map(toHubSpotRecord);
    const ids = cached.map(record => record.id);
    let results = cached;
    let hubspotFresh = false;

    if (ids.length) {
      try {
        const fresh = await hubspotJson(`/crm/objects/2026-03/companies/batch/read`, {
          method: "POST",
          body: JSON.stringify({ properties: COMPANY_PROSPECTION_PROPERTIES, inputs: ids.map(id => ({ id })) }),
        });
        const freshById = new Map((fresh.results ?? []).map((record: any) => [String(record.id), record.properties ?? {}]));
        results = cached.map(record => {
          const merged = mergeMeaningfulProperties(
            record.properties,
            (freshById.get(record.id) ?? {}) as Record<string, unknown>,
          );
          return {
            ...record,
            properties: {
              ...merged,
              qualification_status: record.properties.qualification_status,
            },
          };
        });
        hubspotFresh = true;
      } catch (hubspotError) {
        // HubSpot ne doit jamais masquer les entreprises déjà stockées dans le Cockpit.
        console.warn("Companies HubSpot refresh unavailable, serving Cockpit cache:", hubspotError);
      }
    }

    const total = count ?? results.length;
    const nextAfter = offset + results.length < total ? String(offset + 100) : null;
    return NextResponse.json({
      results,
      total,
      source: hubspotFresh ? "cockpit+hubspot" : "cockpit",
      paging: nextAfter ? { next: { after: nextAfter } } : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message || "Erreur Supabase", details: e }, { status: 500 });
  }
}

const COMPANY_CREATE_ALLOWED = [
  "name", "domain", "phone", "website", "address", "address2", "city", "zip", "state", "country", "industry", "description", "hubspot_owner_id",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const props: Record<string, string> = Object.fromEntries(
      Object.entries(body.properties ?? {})
        .filter(([key, input]) => COMPANY_CREATE_ALLOWED.includes(key) && input !== undefined && input !== null && String(input).trim() !== "")
        .map(([key, input]) => [key, String(input).trim()]),
    );
    if (!props.name && !props.domain) {
      return NextResponse.json({ error: "Renseignez au moins un nom d’entreprise ou un domaine." }, { status: 400 });
    }

    const data = await hubspotJson("/crm/objects/2026-03/companies", {
      method: "POST",
      body: JSON.stringify({ properties: props }),
    });

    const row = {
      hubspot_id: String(data.id),
      name: props.name || props.domain || "Sans nom",
      domain: props.domain ?? null,
      phone: props.phone ?? null,
      website: props.website ?? null,
      city: props.city ?? null,
      postal_code: props.zip ?? null,
      country: props.country ?? null,
      owner_hubspot_id: props.hubspot_owner_id ?? null,
      raw_data: data,
      hubspot_updated_at: data.updatedAt || new Date().toISOString(),
    };
    const { error } = await getSupabaseAdmin().from("companies").upsert(row, { onConflict: "hubspot_id" });
    if (error) console.error("Supabase upsert company:", error.message);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e }, { status: e.status || 500 });
  }
}
