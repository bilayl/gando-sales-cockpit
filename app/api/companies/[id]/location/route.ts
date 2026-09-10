import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const LOCATION_PROPERTIES = ["address", "address2", "zip", "city", "state", "country"] as const;
type LocationProperty = typeof LOCATION_PROPERTIES[number];

function pickLocation(properties: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(LOCATION_PROPERTIES.map(key => [key, String(properties?.[key] ?? "")])) as Record<LocationProperty, string>;
}

function assertHubSpotCompanyId(id: string) {
  if (!/^\d+$/.test(id)) {
    const error = new Error("Identifiant HubSpot entreprise invalide.") as Error & { status?: number };
    error.status = 400;
    throw error;
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCockpitAccess();
    const { id } = await params;
    assertHubSpotCompanyId(id);

    const supabase = getSupabaseAdmin();
    const { data: local, error: localError } = await supabase
      .from("companies")
      .select("hubspot_id,city,postal_code,country,raw_data")
      .eq("hubspot_id", id)
      .maybeSingle();
    if (localError) throw localError;

    const localProperties = {
      ...(local?.raw_data?.properties ?? {}),
      city: local?.city ?? local?.raw_data?.properties?.city,
      zip: local?.postal_code ?? local?.raw_data?.properties?.zip,
      country: local?.country ?? local?.raw_data?.properties?.country,
    };

    try {
      const remote = await hubspotJson(
        `/crm/objects/2026-03/companies/${encodeURIComponent(id)}?properties=${LOCATION_PROPERTIES.join(",")}`,
      );
      return NextResponse.json({ id, location: pickLocation({ ...localProperties, ...(remote.properties ?? {}) }) }, { headers: { "cache-control": "no-store" } });
    } catch (hubspotError) {
      if (!local) throw hubspotError;
      return NextResponse.json({ id, location: pickLocation(localProperties), source: "cockpit-cache" }, { headers: { "cache-control": "no-store" } });
    }
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de charger la localisation." }, { status: e.status || 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCockpitAccess();
    const { id } = await params;
    assertHubSpotCompanyId(id);

    const body = await request.json().catch(() => ({}));
    const incoming = body.location ?? body.properties ?? {};
    const properties = Object.fromEntries(
      LOCATION_PROPERTIES
        .filter(key => Object.prototype.hasOwnProperty.call(incoming, key))
        .map(key => [key, String(incoming[key] ?? "").trim()]),
    ) as Record<LocationProperty, string>;

    if (!Object.keys(properties).length) {
      return NextResponse.json({ error: "Aucune donnée de localisation fournie." }, { status: 400 });
    }

    const updated = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });

    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      const mergedProperties = {
        ...(existing.raw_data?.properties ?? {}),
        ...properties,
        ...(updated.properties ?? {}),
      };
      const { error: updateError } = await supabase.from("companies").update({
        city: mergedProperties.city || null,
        postal_code: mergedProperties.zip || null,
        country: mergedProperties.country || null,
        raw_data: {
          ...(existing.raw_data ?? {}),
          ...updated,
          properties: mergedProperties,
          updatedAt: updated.updatedAt || new Date().toISOString(),
        },
        hubspot_updated_at: updated.updatedAt || new Date().toISOString(),
      }).eq("hubspot_id", id);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ id, location: pickLocation({ ...properties, ...(updated.properties ?? {}) }) });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de modifier la localisation." }, { status: e.status || 500 });
  }
}
