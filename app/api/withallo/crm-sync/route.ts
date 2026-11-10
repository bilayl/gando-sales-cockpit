import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess, requireCockpitAdmin } from "@/lib/cockpit-access";
import { isAuthorizedGitHubSyncToken } from "@/lib/github-actions-oidc";
import { getWithAlloCrmSyncStatus, syncCockpitContactsToAllo, syncOneCockpitContact } from "@/lib/withallo-crm-sync";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function fail(error: unknown) {
  const status = Number((error as { status?: number })?.status || 500);
  return NextResponse.json({
    error: error instanceof Error ? error.message : "Synchronisation Allo indisponible.",
  }, { status: [400, 401, 403, 404, 409, 429, 503].includes(status) ? status : 500 });
}

export async function GET() {
  try {
    const access = await requireCockpitAccess();
    return NextResponse.json({
      ...await getWithAlloCrmSyncStatus(),
      canSync: access.canManageTeam,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    const isAutomation = token ? await isAuthorizedGitHubSyncToken(token) : false;
    const payload = await request.json().catch(() => ({}));
    if (isAutomation) {
      if (process.env.WITHALLO_CRM_SYNC_ENABLED !== "true") {
        return NextResponse.json({ skipped: true, reason: "WITHALLO_CRM_SYNC_ENABLED is not enabled" });
      }
    } else if (payload.contactId || payload.phone) {
      await requireCockpitAccess();
    } else {
      await requireCockpitAdmin();
    }

    if (payload.contactId) {
      return NextResponse.json({
        ok: true, outcome: await syncOneCockpitContact(String(payload.contactId)),
      }, { headers: { "cache-control": "private, no-store" } });
    }

    if (payload.phone) {
      const phone = normalizeWithAlloDialNumber(payload.phone);
      if (!phone) return NextResponse.json({ error: "Numéro invalide" }, { status: 400 });
      const suffix = phone.replace(/\D/g, "").slice(-9);
      const db = getSupabaseAdmin();
      const { data, error } = await db.rpc("lookup_cockpit_contacts_by_phone_suffix", { p_suffix: suffix });
      if (error) throw error;
      // The phone lookup returns at most 51 rows. A truncated result cannot be treated as unique.
      if (Array.isArray(data) && data.length >= 51) {
        return NextResponse.json({ ok: true, skipped: true, reason: "too_many_phone_matches" });
      }
      const candidates = (Array.isArray(data) ? data : []).filter(row =>
        [row.phone, row.mobilephone].some(value => normalizeWithAlloDialNumber(value) === phone));
      const matches = [...new Set(candidates.map(row => String(row.hubspot_id)).filter(id => /^\d{1,25}$/.test(id)))];
      if (matches.length !== 1) return NextResponse.json({ ok: true, skipped: true, reason: matches.length ? "ambiguous_phone" : "not_found" });
      return NextResponse.json({ ok: true, outcome: await syncOneCockpitContact(matches[0]) });
    }

    const limit = Math.min(40, Math.max(1, Math.floor(Number(payload.limit) || 30)));
    const db = getSupabaseAdmin();
    const { data: claimed, error: claimError } = await db.rpc("claim_hubspot_sync", {
      p_resource: "lock:withallo:crm", p_stale_after_seconds: 600,
    });
    if (claimError) throw claimError;
    if (!claimed) return NextResponse.json({ skipped: true, reason: "already_running" });
    try {
      const result = await syncCockpitContactsToAllo(limit);
      await db.from("hubspot_sync_state").upsert({
        resource: "lock:withallo:crm", last_synced_at: new Date().toISOString(),
        status: "complete", after_cursor: null, last_error: null, updated_at: new Date().toISOString(),
      }, { onConflict: "resource" });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      await db.from("hubspot_sync_state").upsert({
        resource: "lock:withallo:crm", last_synced_at: new Date().toISOString(),
        status: "error", after_cursor: null,
        last_error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        updated_at: new Date().toISOString(),
      }, { onConflict: "resource" });
      throw error;
    }
  } catch (error) { return fail(error); }
}
