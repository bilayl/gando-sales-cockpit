import { NextRequest, NextResponse } from "next/server";
import { syncActivities, syncCompanies, syncContacts, syncDeals, syncTasks } from "@/lib/sync";
import { refreshCompanyQualifications, syncCompanyContactLinks } from "@/lib/company-qualification-sync";
import { refreshCallRecommendations } from "@/lib/call-recommendations";
import { apiError, isHubSpotAuthenticated } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 300;

type SkippedSync = {
  resource: string;
  skipped: true;
  reason: "already_running";
};

async function runWithSyncLease<T>(resource: string, task: () => Promise<T>): Promise<T | SkippedSync> {
  const admin = getSupabaseAdmin();
  const lockResource = `lock:${resource}`;
  const { data: claimed, error: claimError } = await admin.rpc("claim_hubspot_sync", {
    p_resource: lockResource,
    p_stale_after_seconds: 600,
  });
  if (claimError) throw claimError;

  if (!claimed) {
    return { resource, skipped: true, reason: "already_running" };
  }

  try {
    const result = await task();
    await admin.from("hubspot_sync_state").upsert({
      resource: lockResource,
      last_synced_at: new Date().toISOString(),
      after_cursor: null,
      status: "complete",
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "resource" });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("hubspot_sync_state").upsert({
      resource: lockResource,
      last_synced_at: new Date().toISOString(),
      after_cursor: null,
      status: "error",
      last_error: message.slice(0, 2_000),
      updated_at: new Date().toISOString(),
    }, { onConflict: "resource" });
    throw error;
  }
}

async function refreshDerivedData() {
  return runWithSyncLease("derived", async () => {
    const associations = await syncCompanyContactLinks();
    const qualification = await refreshCompanyQualifications();
    const recommendations = await refreshCallRecommendations();
    return { associations, qualification, recommendations };
  });
}

export async function GET(request: NextRequest) {
  try {
    const expectedCronSecret = process.env.CRON_SECRET?.trim();
    if (expectedCronSecret) {
      const authorization = request.headers.get("authorization") ?? "";
      if (authorization !== `Bearer ${expectedCronSecret}`) {
        return NextResponse.json({ error: "UNAUTHORIZED", message: "Secret cron invalide." }, { status: 401 });
      }
    } else if (!(await isHubSpotAuthenticated())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
    }

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "all";
    let results: Record<string, unknown>;

    switch (resource) {
      case "companies":
        results = { companies: await runWithSyncLease("companies", () => syncCompanies()) };
        break;
      case "contacts":
        results = { contacts: await runWithSyncLease("contacts", () => syncContacts()) };
        break;
      case "deals":
        results = { deals: await runWithSyncLease("deals", () => syncDeals()) };
        break;
      case "tasks":
        results = { tasks: await runWithSyncLease("tasks", () => syncTasks()) };
        break;
      case "activities":
        results = { activities: await runWithSyncLease("activities", () => syncActivities()) };
        break;
      case "qualification": {
        const derived = await refreshDerivedData();
        results = "skipped" in derived ? { derived } : derived;
        break;
      }
      case "all": {
        const companies = await runWithSyncLease("companies", () => syncCompanies());
        const contacts = await runWithSyncLease("contacts", () => syncContacts());
        const deals = await runWithSyncLease("deals", () => syncDeals());
        const tasks = await runWithSyncLease("tasks", () => syncTasks());
        const activities = await runWithSyncLease("activities", () => syncActivities());
        const derived = await refreshDerivedData();
        results = { companies, contacts, deals, tasks, activities, derived };
        break;
      }
      default:
        return NextResponse.json({ error: `Ressource inconnue: ${resource}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return apiError(error);
  }
}
