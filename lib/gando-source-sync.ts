import "server-only";

import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getConfiguredGandoSourceTables,
  getGandoSourceProjectRef,
  getGandoSourceSupabase,
  type GandoSourceTableConfig,
} from "@/lib/gando-source-supabase";

type Row = Record<string, unknown>;

const PAGE_SIZE = 250;

function toIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sourceUpdatedAt(row: Row) {
  return (
    toIsoTimestamp(row.updated_at) ||
    toIsoTimestamp(row.modified_at) ||
    toIsoTimestamp(row.created_at) ||
    null
  );
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Erreur inconnue";
  }
}

async function syncOneTable(config: GandoSourceTableConfig) {
  const source = getGandoSourceSupabase();
  const destination = getSupabaseAdmin();
  const sourceProject = getGandoSourceProjectRef() || "external-supabase";
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  let rowsSynced = 0;

  await destination.from("gando_source_sync_state").upsert(
    {
      source_project: sourceProject,
      source_schema: config.schema,
      source_table: config.table,
      id_column: config.idColumn,
      status: "running",
      rows_synced: 0,
      last_started_at: startedAt,
      last_error: null,
      last_run_id: runId,
      updated_at: startedAt,
    },
    { onConflict: "source_project,source_schema,source_table" },
  );

  try {
    let offset = 0;

    while (true) {
      const { data, error } = await source
        .schema(config.schema)
        .from(config.table)
        .select("*")
        .order(config.idColumn, { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const rows = (data || []) as Row[];
      if (!rows.length) break;

      const mirroredRows = rows.map(row => {
        const rawId = row[config.idColumn];
        if (rawId === null || rawId === undefined || String(rawId).trim() === "") {
          throw new Error(
            `La table ${config.key} contient une ligne sans ${config.idColumn}. Configurez la bonne colonne d'identifiant.`,
          );
        }

        return {
          source_project: sourceProject,
          source_schema: config.schema,
          source_table: config.table,
          source_id: String(rawId),
          payload: row,
          source_updated_at: sourceUpdatedAt(row),
          sync_run_id: runId,
          synced_at: new Date().toISOString(),
        };
      });

      const { error: upsertError } = await destination
        .from("gando_source_records")
        .upsert(mirroredRows, {
          onConflict: "source_project,source_schema,source_table,source_id",
        });

      if (upsertError) throw upsertError;

      rowsSynced += mirroredRows.length;
      offset += rows.length;

      if (rows.length < PAGE_SIZE) break;
    }

    // La synchronisation est un miroir complet : si une ligne a disparu de la
    // source, elle est retirée du miroir uniquement après un run terminé.
    const { error: cleanupError } = await destination
      .from("gando_source_records")
      .delete()
      .eq("source_project", sourceProject)
      .eq("source_schema", config.schema)
      .eq("source_table", config.table)
      .neq("sync_run_id", runId);

    if (cleanupError) throw cleanupError;

    const completedAt = new Date().toISOString();
    const { error: stateError } = await destination.from("gando_source_sync_state").upsert(
      {
        source_project: sourceProject,
        source_schema: config.schema,
        source_table: config.table,
        id_column: config.idColumn,
        status: "success",
        rows_synced: rowsSynced,
        last_started_at: startedAt,
        last_completed_at: completedAt,
        last_error: null,
        last_run_id: runId,
        updated_at: completedAt,
      },
      { onConflict: "source_project,source_schema,source_table" },
    );

    if (stateError) throw stateError;

    return {
      table: config.key,
      idColumn: config.idColumn,
      success: true as const,
      rowsSynced,
      startedAt,
      completedAt,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = formatError(error).slice(0, 4000);

    await destination.from("gando_source_sync_state").upsert(
      {
        source_project: sourceProject,
        source_schema: config.schema,
        source_table: config.table,
        id_column: config.idColumn,
        status: "error",
        rows_synced: rowsSynced,
        last_started_at: startedAt,
        last_error: message,
        last_run_id: runId,
        updated_at: failedAt,
      },
      { onConflict: "source_project,source_schema,source_table" },
    );

    return {
      table: config.key,
      idColumn: config.idColumn,
      success: false as const,
      rowsSynced,
      startedAt,
      completedAt: null,
      error: message,
    };
  }
}

function resolveRequestedTables(requestedTables?: string[]) {
  const configured = getConfiguredGandoSourceTables();
  if (!configured.length) {
    throw new Error("Aucune table configurée dans GANDO_SOURCE_SYNC_TABLES.");
  }

  if (!requestedTables?.length) return configured;

  const requested = new Set(requestedTables.map(value => value.trim()).filter(Boolean));
  const selected = configured.filter(config => requested.has(config.key) || requested.has(config.table));
  const selectedAliases = new Set(selected.flatMap(config => [config.key, config.table]));
  const unknown = [...requested].filter(value => !selectedAliases.has(value));

  if (unknown.length) {
    throw new Error(`Tables non autorisées ou non configurées : ${unknown.join(", ")}`);
  }

  return selected;
}

export async function syncGandoSourceTables(requestedTables?: string[]) {
  const selected = resolveRequestedTables(requestedTables);
  const startedAt = new Date().toISOString();
  const results = [];

  // Séquentiel volontairement : évite de saturer la source et rend les erreurs
  // plus faciles à diagnostiquer table par table.
  for (const table of selected) {
    results.push(await syncOneTable(table));
  }

  return {
    sourceProject: getGandoSourceProjectRef(),
    startedAt,
    completedAt: new Date().toISOString(),
    success: results.every(result => result.success),
    tables: results,
  };
}
