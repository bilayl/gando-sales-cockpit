import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type MirrorRow = { source_id: string; payload: Row };

const EVER_ACTIVE = new Set([
  "active",
  "processing",
  "captured",
  "close",
  "cancelled",
  "capture_issue",
]);
const PAGE_SIZE = 1000;

function str(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown) {
  return value === true || value === "true";
}

function timestamp(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readSourceTable(table: string): Promise<MirrorRow[]> {
  const admin = getSupabaseAdmin();
  const rows: MirrorRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("gando_source_records")
      .select("source_id,payload")
      .eq("source_table", table)
      .order("source_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data || []) as MirrorRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += page.length;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();

    const year = Number(request.nextUrl.searchParams.get("year"));
    const monthNumber = Number(request.nextUrl.searchParams.get("month"));

    if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      return NextResponse.json({ error: "Mois invalide." }, { status: 400 });
    }

    const [depositRows, accountRows] = await Promise.all([
      readSourceTable("deposits"),
      readSourceTable("accounts"),
    ]);

    const accounts = new Map(accountRows.map(row => [row.source_id, row.payload]));
    const start = Date.UTC(year, monthNumber - 1, 1);
    const end = Date.UTC(year, monthNumber, 1);

    const rows = depositRows
      .map(row => {
        const startAt = timestamp(row.payload.start_at);
        const status = str(row.payload.status);
        const accountId = str(row.payload.account_id);
        const account = accounts.get(accountId) || {};

        return {
          id: row.source_id,
          activationAt: startAt == null ? null : new Date(startAt).toISOString(),
          status,
          accountId,
          accountName: str(account.display_name) || str(account.company_name) || "Loueur sans nom",
          amountCents: num(row.payload.amount_cents),
          archived: bool(row.payload.is_archived),
        };
      })
      .filter(row =>
        !row.archived &&
        EVER_ACTIVE.has(row.status) &&
        row.activationAt != null &&
        Date.parse(row.activationAt) >= start &&
        Date.parse(row.activationAt) < end
      )
      .sort((a, b) => Date.parse(b.activationAt!) - Date.parse(a.activationAt!))
      .map(row => ({
        id: row.id,
        activationAt: row.activationAt!,
        status: row.status,
        accountId: row.accountId,
        accountName: row.accountName,
        amountCents: row.amountCents,
      }));

    return NextResponse.json({ year, monthNumber, count: rows.length, rows });
  } catch (error) {
    console.error("Activated deposits listing failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger les cautions activées." },
      { status: 500 },
    );
  }
}
