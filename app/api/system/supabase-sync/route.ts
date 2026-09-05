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

export async function GET() {
  try {
    await requireCockpitAdmin();

    const configuredTables = getConfiguredGandoSourceTables();
    const { data, error } = await getSupabaseAdmin()
      .from("gando_source_sync_state")
      .select(
        "source_project,source_schema,source_table,id_column,status,rows_synced,last_started_at,last_completed_at,last_error,updated_at",
      )
      .order("source_table", { ascending: true });

    if (error) throw error;

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
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireCockpitAdmin();

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
