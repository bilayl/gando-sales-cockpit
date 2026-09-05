import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export type GandoSourceTableConfig = {
  schema: string;
  table: string;
  idColumn: string;
  key: string;
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function requireIdentifier(value: string, label: string) {
  if (!IDENTIFIER.test(value)) {
    throw new Error(`${label} invalide dans GANDO_SOURCE_SYNC_TABLES: ${value}`);
  }
  return value;
}

export function getGandoSourceProjectRef() {
  const rawUrl = process.env.GANDO_SOURCE_SUPABASE_URL?.trim();
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export function getGandoSourceSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.GANDO_SOURCE_SUPABASE_URL?.trim();
    const key = process.env.GANDO_SOURCE_SUPABASE_SECRET_KEY?.trim();

    if (!url || !/^https?:\/\/.+/.test(url) || !key) {
      throw new Error(
        "Supabase source non configuré : vérifiez GANDO_SOURCE_SUPABASE_URL et GANDO_SOURCE_SUPABASE_SECRET_KEY",
      );
    }

    client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return client;
}

/**
 * Syntaxe :
 *   GANDO_SOURCE_SYNC_TABLES=deposits,payments,public.users:user_id
 *
 * - schéma par défaut : public
 * - colonne d'identifiant par défaut : id
 */
export function getConfiguredGandoSourceTables(): GandoSourceTableConfig[] {
  const raw = process.env.GANDO_SOURCE_SYNC_TABLES?.trim();
  if (!raw) return [];

  const seen = new Set<string>();

  return raw
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [tablePart, rawIdColumn] = entry.split(":", 2);
      const parts = tablePart.split(".");
      const schema = requireIdentifier(parts.length === 2 ? parts[0] : "public", "Schéma");
      const table = requireIdentifier(parts.length === 2 ? parts[1] : parts[0], "Table");
      const idColumn = requireIdentifier(rawIdColumn?.trim() || "id", "Colonne d'identifiant");
      const key = `${schema}.${table}`;

      if (seen.has(key)) {
        throw new Error(`Table dupliquée dans GANDO_SOURCE_SYNC_TABLES: ${key}`);
      }
      seen.add(key);

      return { schema, table, idColumn, key };
    });
}
