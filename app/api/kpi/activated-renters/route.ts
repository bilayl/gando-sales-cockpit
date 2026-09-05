import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type MirrorRow = { source_id: string; payload: Row };
type Deposit = { id: string; clientId: string; accountId: string; status: string; amountCents: number; createdAt: number | null; updatedAt: number | null; archived: boolean };
type Fee = { id: string; clientId: string; amountCents: number; createdAt: number | null };

const SUCCESSFUL = new Set(["active", "close", "captured"]);
const MATCH_WINDOW_MS = 14 * 86400000;

function str(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function bool(value: unknown) { return value === true || value === "true"; }
function ts(value: unknown) { if (typeof value !== "string" || !value) return null; const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; }

async function read(table: string): Promise<MirrorRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("gando_source_records")
    .select("source_id,payload")
    .eq("source_table", table)
    .order("source_id", { ascending: true });
  if (error) throw error;
  return (data || []) as MirrorRow[];
}

function buildDeposits(rows: MirrorRow[]): Deposit[] {
  return rows.map(row => ({
    id: row.source_id,
    clientId: str(row.payload.client_id),
    accountId: str(row.payload.account_id),
    status: str(row.payload.status),
    amountCents: num(row.payload.amount_cents),
    createdAt: ts(row.payload.created_at),
    updatedAt: ts(row.payload.updated_at),
    archived: bool(row.payload.is_archived),
  }));
}

function matchFees(deposits: Deposit[], fees: Fee[]) {
  const byClient = new Map<string, Deposit[]>();
  for (const deposit of deposits) {
    if (deposit.archived || !deposit.clientId) continue;
    const list = byClient.get(deposit.clientId) || [];
    list.push(deposit);
    byClient.set(deposit.clientId, list);
  }

  const used = new Set<string>();
  const result = new Map<string, Fee>();
  for (const fee of [...fees].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) {
    if (fee.createdAt == null) continue;
    const best = (byClient.get(fee.clientId) || [])
      .filter(deposit => !used.has(deposit.id))
      .map(deposit => {
        const dates = [deposit.createdAt, deposit.updatedAt].filter((value): value is number => value != null);
        const gap = dates.length ? Math.min(...dates.map(value => Math.abs(fee.createdAt! - value))) : Number.POSITIVE_INFINITY;
        return { deposit, gap };
      })
      .filter(item => item.gap <= MATCH_WINDOW_MS)
      .sort((a, b) => a.gap - b.gap)[0];
    if (!best) continue;
    used.add(best.deposit.id);
    result.set(best.deposit.id, fee);
  }
  return result;
}

export async function GET() {
  try {
    await requireCockpitAccess();
    const [depositRows, operationRows, accountRows] = await Promise.all([
      read("deposits"),
      read("client_operations"),
      read("accounts"),
    ]);

    const deposits = buildDeposits(depositRows);
    const fees: Fee[] = operationRows
      .filter(row => str(row.payload.type) === "fee")
      .map(row => ({ id: row.source_id, clientId: str(row.payload.client_id), amountCents: num(row.payload.amount), createdAt: ts(row.payload.created_at) }))
      .filter(row => row.clientId && row.amountCents > 0 && row.createdAt != null);
    const feeByDeposit = matchFees(deposits, fees);
    const wonDeposits = deposits.filter(deposit => SUCCESSFUL.has(deposit.status) && !deposit.archived && feeByDeposit.has(deposit.id));

    const accounts = new Map(accountRows.map(row => [row.source_id, row.payload]));
    const now = Date.now();
    const currentStart = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1);
    const grouped = new Map<string, {
      accountId: string
      name: string
      companyName: string
      totalDeposits: number
      totalVolumeCents: number
      totalRevenueCents: number
      currentMonthDeposits: number
      currentMonthVolumeCents: number
      firstActivationAt: number
      lastActivationAt: number
    }>();

    for (const deposit of wonDeposits) {
      const fee = feeByDeposit.get(deposit.id);
      if (!fee?.createdAt || !deposit.accountId) continue;
      const account = accounts.get(deposit.accountId) || {};
      const displayName = str(account.display_name).trim();
      const companyName = str(account.company_name).trim();
      const name = displayName || companyName || `Compte ${deposit.accountId.slice(-6)}`;
      const current = grouped.get(deposit.accountId) || {
        accountId: deposit.accountId,
        name,
        companyName,
        totalDeposits: 0,
        totalVolumeCents: 0,
        totalRevenueCents: 0,
        currentMonthDeposits: 0,
        currentMonthVolumeCents: 0,
        firstActivationAt: fee.createdAt,
        lastActivationAt: fee.createdAt,
      };

      current.totalDeposits += 1;
      current.totalVolumeCents += deposit.amountCents;
      current.totalRevenueCents += fee.amountCents;
      current.firstActivationAt = Math.min(current.firstActivationAt, fee.createdAt);
      current.lastActivationAt = Math.max(current.lastActivationAt, fee.createdAt);
      if (fee.createdAt >= currentStart && fee.createdAt <= now) {
        current.currentMonthDeposits += 1;
        current.currentMonthVolumeCents += deposit.amountCents;
      }
      grouped.set(deposit.accountId, current);
    }

    const rows = [...grouped.values()]
      .map(row => ({
        ...row,
        averageDepositCents: row.totalDeposits > 0 ? Math.round(row.totalVolumeCents / row.totalDeposits) : 0,
        firstActivationAt: new Date(row.firstActivationAt).toISOString(),
        lastActivationAt: new Date(row.lastActivationAt).toISOString(),
        daysSinceLastActivation: Math.max(0, Math.floor((now - row.lastActivationAt) / 86400000)),
      }))
      .sort((a, b) => Date.parse(b.lastActivationAt) - Date.parse(a.lastActivationAt));

    return NextResponse.json({
      summary: {
        activatedRenters: rows.length,
        activeThisMonth: rows.filter(row => row.currentMonthDeposits > 0).length,
        totalDeposits: rows.reduce((sum, row) => sum + row.totalDeposits, 0),
        totalVolumeCents: rows.reduce((sum, row) => sum + row.totalVolumeCents, 0),
      },
      rows,
    });
  } catch (error) {
    console.error("Activated renters KPI failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les loueurs activés." }, { status: 500 });
  }
}
