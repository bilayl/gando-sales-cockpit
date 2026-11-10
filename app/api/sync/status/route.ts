import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCockpitAccess();
    const { data, error } = await getSupabaseAdmin().from("hubspot_sync_state")
      .select("resource,status,last_synced_at,last_error")
      .in("resource", ["lock:contacts", "contacts"]);
    if (error) throw error;
    const state = data?.find(row => row.resource === "lock:contacts")
      ?? data?.find(row => row.resource === "contacts");
    const lastSyncedAt = state?.last_synced_at ?? null;
    const elapsed = lastSyncedAt ? Date.now() - new Date(lastSyncedAt).getTime() : Infinity;

    return NextResponse.json({
      status: state?.status ?? "unknown",
      lastSyncedAt,
      lastError: state?.last_error ?? null,
      delayed: elapsed > 15 * 60_000,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const reason = error as Error & { status?: number };
    return NextResponse.json({ error: reason.message || "État HubSpot indisponible" }, { status: reason.status ?? 500 });
  }
}
