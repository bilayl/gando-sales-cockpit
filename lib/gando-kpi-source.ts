import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type GandoKpiMirrorRow = {
  source_id: string;
  payload: Record<string, unknown>;
};

const PAGE_SIZE = 500;

/**
 * Supabase/PostgREST limits unpaged requests to 1,000 rows by default.
 * KPI data must always read the complete source mirror, not the first page.
 */
export async function readGandoKpiSourceRecords(table: string): Promise<GandoKpiMirrorRow[]> {
  const admin = getSupabaseAdmin();
  const rows: GandoKpiMirrorRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("gando_source_records")
      .select("source_id,payload")
      .eq("source_table", table)
      .order("source_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data ?? []) as GandoKpiMirrorRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += page.length;
  }

  return rows;
}

export function parisMonthKey(at: number): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(at));
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}`;
}

export function parisDayOfMonth(at: number): number {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    day: "2-digit",
  }).format(new Date(at)));
}
