import { NextResponse } from "next/server";
import { requireCockpitAdmin } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getConfiguredGandoSourceTables,
  getGandoSourceProjectRef,
} from "@/lib/gando-source-supabase";
import { syncGandoSourceTables } from "@/lib/gando-source-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;
  const message = error instanceof Error ? error.message : "Erreur inconnue";
  return NextResponse.json({ success: false, error: message }, { status });
}

async function bootstrapContinuousScheduler(request: Request) {
  const endpointUrl = `${new URL(request.url).origin}/api/system/supabase-sync/continuous`;
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("gando_source_sync_scheduler")
    .update({ endpoint_url: endpointUrl, enabled: true, updated_at: now })
    .eq("id", "default");
  if (error) throw error;
}

export async function GET() {
  try {
    await requireCockpitAdmin();

    const configuredTables = getConfiguredGandoSourceTables();
    const admin = getSupabaseAdmin();
    const [{ data, error }, schedulerResult] = await Promise.all([
      admin
        .from("gando_source_sync_state")
        .select(
          "source_project,source_schema,source_table,id_column,status,rows_synced,last_started_at,last_completed_at,last_error,updated_at",
        )
        .order("source_table", { ascending: true }),
      admin
        .from("gando_source_sync_scheduler")
        .select("enabled,endpoint_url,last_started_at,last_completed_at,last_success,last_error,updated_at")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    if (error) throw error;
    if (schedulerResult.error) throw schedulerResult.error;

    return NextResponse.json({
      success: true,
      configured: Boolean(
        process.env.GANDO_SOURCE_SUPABASE_URL?.trim() &&
          process.env.GANDO_SOURCE_SUPABASE_SECRET_KEY?.trim(),
      ),
      sourceProject: getGandoSourceProjectRef(),
      tables: configuredTables.map(table => ({
        table: table.key,
        idColumn: table.idColumn,
      })),
      state: data || [],
      scheduler: schedulerResult.data || null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireCockpitAdmin();
    await bootstrapContinuousScheduler(request);

    const body = await request.json().catch(() => ({}));
    const requestedTables = body?.tables;

    if (
      requestedTables !== undefined &&
      (!Array.isArray(requestedTables) || requestedTables.some(value => typeof value !== "string"))
    ) {
      return NextResponse.json(
        { success: false, error: "Le champ tables doit être une liste de noms de tables." },
        { status: 400 },
      );
    }

    const result = await syncGandoSourceTables(requestedTables);
    return NextResponse.json(result, { status: result.success ? 200 : 207 });
  } catch (error) {
    console.error("External Supabase sync failed", error);
    return errorResponse(error);
  }
}
