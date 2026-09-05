import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;
type MirrorRow = { source_id: string; payload: Row };

type Deposit = {
  id: string;
  clientId: string;
  accountId: string;
  status: string;
  amountCents: number;
  createdAt: number | null;
  updatedAt: number | null;
  archived: boolean;
};

type Fee = {
  id: string;
  clientId: string;
  amountCents: number;
  createdAt: number | null;
};

type SourceMonth = {
  year: number;
  monthNumber: number;
  revenue: number;
  tdv: number;
  deposits: number;
  activeRenters: number;
  newUsers: number;
  registeredUsers: number;
  totalClients: number;
  cumulativeDepositVolume: number;
  depositCashouts: number;
  cashoutAmount: number;
  advancedGuarantee: number;
  churnedRenters: number | null;
};

type MutableMonth = {
  revenueCents: number;
  tdvCents: number;
  deposits: number;
  activeAccounts: Set<string>;
  newUsers: number;
  depositCashouts: number;
  cashoutAmountCents: number;
  advancedGuaranteeCents: number;
};

const SUCCESSFUL = new Set(["active", "close", "captured"]);
const MATCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
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

function ts(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function monthKey(value: number) {
  return new Date(value).toISOString().slice(0, 7);
}

function monthEndMs(key: string) {
  const [year, month] = key.split("-").map(Number);
  return Date.UTC(year, month, 1) - 1;
}

function centsToEuros(value: number) {
  return Math.round(value) / 100;
}

function emptyMonth(): MutableMonth {
  return {
    revenueCents: 0,
    tdvCents: 0,
    deposits: 0,
    activeAccounts: new Set<string>(),
    newUsers: 0,
    depositCashouts: 0,
    cashoutAmountCents: 0,
    advancedGuaranteeCents: 0,
  };
}

function getMonth(map: Map<string, MutableMonth>, key: string) {
  let month = map.get(key);
  if (!month) {
    month = emptyMonth();
    map.set(key, month);
  }
  return month;
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
    const current = byClient.get(deposit.clientId) || [];
    current.push(deposit);
    byClient.set(deposit.clientId, current);
  }

  const usedDeposits = new Set<string>();
  const matched = new Map<string, Fee>();

  for (const fee of [...fees].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) {
    if (fee.createdAt == null) continue;
    const best = (byClient.get(fee.clientId) || [])
      .filter(deposit => !usedDeposits.has(deposit.id))
      .map(deposit => {
        const dates = [deposit.createdAt, deposit.updatedAt].filter((value): value is number => value != null);
        const gap = dates.length
          ? Math.min(...dates.map(value => Math.abs(fee.createdAt! - value)))
          : Number.POSITIVE_INFINITY;
        return { deposit, gap };
      })
      .filter(candidate => candidate.gap <= MATCH_WINDOW_MS)
      .sort((a, b) => a.gap - b.gap)[0];

    if (!best) continue;
    usedDeposits.add(best.deposit.id);
    matched.set(best.deposit.id, fee);
  }

  return matched;
}

export async function getGandoMonthlySourceMetrics() {
  const [depositRows, operationRows, captureRows, guaranteeRows, userRows, clientRows] = await Promise.all([
    readSourceTable("deposits"),
    readSourceTable("client_operations"),
    readSourceTable("captures"),
    readSourceTable("guarantee_activations"),
    readSourceTable("users"),
    readSourceTable("clients"),
  ]);

  const deposits = buildDeposits(depositRows);
  const fees: Fee[] = operationRows
    .filter(row => str(row.payload.type) === "fee")
    .map(row => ({
      id: row.source_id,
      clientId: str(row.payload.client_id),
      amountCents: num(row.payload.amount),
      createdAt: ts(row.payload.created_at),
    }))
    .filter(row => row.clientId && row.amountCents > 0 && row.createdAt != null);

  const feeByDeposit = matchFees(deposits, fees);
  const wonDeposits = deposits.filter(deposit =>
    SUCCESSFUL.has(deposit.status) && !deposit.archived && feeByDeposit.has(deposit.id),
  );

  const months = new Map<string, MutableMonth>();

  for (const deposit of wonDeposits) {
    const fee = feeByDeposit.get(deposit.id);
    if (!fee?.createdAt) continue;
    const bucket = getMonth(months, monthKey(fee.createdAt));
    bucket.revenueCents += fee.amountCents;
    bucket.tdvCents += deposit.amountCents;
    bucket.deposits += 1;
    if (deposit.accountId) bucket.activeAccounts.add(deposit.accountId);
  }

  const userCreatedAt = userRows
    .map(row => ts(row.payload.created_at))
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  for (const createdAt of userCreatedAt) {
    getMonth(months, monthKey(createdAt)).newUsers += 1;
  }

  const clientCreatedAt = clientRows
    .map(row => ts(row.payload.created_at))
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

  const capturesById = new Map<string, MirrorRow>();
  for (const row of captureRows) {
    capturesById.set(row.source_id, row);
    if (str(row.payload.status) !== "paid") continue;
    const createdAt = ts(row.payload.created_at);
    if (createdAt == null) continue;
    const bucket = getMonth(months, monthKey(createdAt));
    bucket.depositCashouts += 1;
    bucket.cashoutAmountCents += num(row.payload.amount_cents);
  }

  for (const row of guaranteeRows) {
    if (str(row.payload.status) !== "accepted") continue;
    const createdAt = ts(row.payload.created_at);
    if (createdAt == null) continue;
    const capture = capturesById.get(str(row.payload.capture_id));
    if (!capture) continue;
    getMonth(months, monthKey(createdAt)).advancedGuaranteeCents += num(capture.payload.amount_cents);
  }

  const sortedKeys = [...months.keys()].sort();
  const result = new Map<string, SourceMonth>();
  let cumulativeTdvCents = 0;
  let previousActive = new Set<string>();
  let previousKey: string | null = null;

  for (const key of sortedKeys) {
    const bucket = months.get(key)!;
    cumulativeTdvCents += bucket.tdvCents;
    const [year, monthNumber] = key.split("-").map(Number);
    const end = monthEndMs(key);
    const registeredUsers = userCreatedAt.filter(value => value <= end).length;
    const totalClients = clientCreatedAt.filter(value => value <= end).length;

    let churnedRenters: number | null = null;
    if (previousKey) {
      const [prevYear, prevMonth] = previousKey.split("-").map(Number);
      const prevIndex = prevYear * 12 + prevMonth - 1;
      const currentIndex = year * 12 + monthNumber - 1;
      if (currentIndex - prevIndex === 1) {
        churnedRenters = [...previousActive].filter(accountId => !bucket.activeAccounts.has(accountId)).length;
      }
    }

    result.set(key, {
      year,
      monthNumber,
      revenue: centsToEuros(bucket.revenueCents),
      tdv: centsToEuros(bucket.tdvCents),
      deposits: bucket.deposits,
      activeRenters: bucket.activeAccounts.size,
      newUsers: bucket.newUsers,
      registeredUsers,
      totalClients,
      cumulativeDepositVolume: centsToEuros(cumulativeTdvCents),
      depositCashouts: bucket.depositCashouts,
      cashoutAmount: centsToEuros(bucket.cashoutAmountCents),
      advancedGuarantee: centsToEuros(bucket.advancedGuaranteeCents),
      churnedRenters,
    });

    previousActive = bucket.activeAccounts;
    previousKey = key;
  }

  return result;
}
