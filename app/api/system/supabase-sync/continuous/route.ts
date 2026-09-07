import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { syncGandoSourceTables } from "@/lib/gando-source-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONTINUOUS_TABLES = [
  "public.accounts",
  "public.clients",
  "public.users",
  "public.deposits",
  "public.client_operations",
  "public.fees",
  "public.captures",
  "public.guarantee_activations",
  "public.psp_transactions",
  "public.payments",
];

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const admin = getSupabaseAdmin();
  const { data: scheduler, error: schedulerError } = await admin
    .from("gando_source_sync_scheduler")
    .select("auth_token,enabled")
    .eq("id", "default")
    .maybeSingle();

  if (schedulerError) {
    console.error("Continuous sync scheduler lookup failed", schedulerError);
    return NextResponse.json({ success: false, error: "Scheduler indisponible" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const expected = scheduler?.auth_token ? `Bearer ${scheduler.auth_token}` : "";
  if (!scheduler?.enabled || !expected || !secureEqual(authHeader, expected)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  await admin
    .from("gando_source_sync_scheduler")
    .update({ last_started_at: startedAt, last_error: null, updated_at: startedAt })
    .eq("id", "default");

  try {
    const result = await syncGandoSourceTables(CONTINUOUS_TABLES);
    const completedAt = new Date().toISOString();

    await admin
      .from("gando_source_sync_scheduler")
      .update({
        last_completed_at: completedAt,
        last_success: result.success,
        last_error: result.success
          ? null
          : result.tables.filter(table => !table.success).map(table => `${table.table}: ${"error" in table ? table.error : "Erreur"}`).join(" | ").slice(0, 4000),
        updated_at: completedAt,
      })
      .eq("id", "default");

    return NextResponse.json(
      {
        success: result.success,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        tables: result.tables.map(table => ({ table: table.table, success: table.success, rowsSynced: table.rowsSynced })),
      },
      { status: result.success ? 200 : 207 },
    );
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Erreur inconnue";

    await admin
      .from("gando_source_sync_scheduler")
      .update({ last_success: false, last_error: message.slice(0, 4000), updated_at: failedAt })
      .eq("id", "default");

    console.error("Continuous Gando source sync failed", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
