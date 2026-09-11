import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

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
  startAt: number | null;
  returnUrl: string;
  archived: boolean;
};
type FeeOperation = { id: string; clientId: string; amountCents: number; createdAt: number | null };
type Tier = { min_cents?: number; max_cents?: number; reward_cents?: number };

type EligibleItem = {
  deposit: Deposit;
  fee: FeeOperation | null;
  dueCents: number;
  month: string;
};

const SUCCESSFUL_STATUSES = new Set(["active", "close", "captured"]);
const FEE_MATCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

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
function monthKey(value: number | null) {
  if (value == null) return null;
  return new Date(value).toISOString().slice(0, 7);
}
function rewardForDeposit(amountCents: number, tiers: Tier[]) {
  const tier = tiers.find(candidate => {
    const min = num(candidate.min_cents);
    const max = candidate.max_cents == null ? Number.POSITIVE_INFINITY : num(candidate.max_cents);
    return amountCents >= min && amountCents <= max;
  });
  return tier ? num(tier.reward_cents) : 0;
}
function rateReward(amountCents: number, rateBps: number) {
  return Math.round(amountCents * rateBps / 10000);
}
function isEffective(at: number | null, effectiveFrom: unknown, effectiveTo: unknown) {
  const from = timestamp(effectiveFrom);
  const to = timestamp(effectiveTo);
  if (at == null) return from == null && to == null;
  if (from != null && at < from) return false;
  if (to != null && at > to + 86400000 - 1) return false;
  return true;
}

async function readSourceTable(table: string): Promise<MirrorRow[]> {
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
    createdAt: timestamp(row.payload.created_at),
    updatedAt: timestamp(row.payload.updated_at),
    startAt: timestamp(row.payload.start_at),
    returnUrl: str(row.payload.return_url),
    archived: bool(row.payload.is_archived),
  }));
}

function matchFees(deposits: Deposit[], fees: FeeOperation[]) {
  const byClient = new Map<string, Deposit[]>();
  for (const deposit of deposits) {
    if (deposit.archived || !deposit.clientId) continue;
    const list = byClient.get(deposit.clientId) || [];
    list.push(deposit);
    byClient.set(deposit.clientId, list);
  }

  const used = new Set<string>();
  const matched = new Map<string, FeeOperation>();
  for (const fee of [...fees].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) {
    if (fee.createdAt == null) continue;
    const candidates = (byClient.get(fee.clientId) || [])
      .filter(deposit => !used.has(deposit.id))
      .map(deposit => {
        const dates = [deposit.createdAt, deposit.updatedAt].filter((value): value is number => value != null);
        const gap = dates.length ? Math.min(...dates.map(value => Math.abs(fee.createdAt! - value))) : Number.POSITIVE_INFINITY;
        return { deposit, gap };
      })
      .filter(candidate => candidate.gap <= FEE_MATCH_WINDOW_MS)
      .sort((a, b) => a.gap - b.gap);
    if (!candidates[0]) continue;
    used.add(candidates[0].deposit.id);
    matched.set(candidates[0].deposit.id, fee);
  }
  return matched;
}

function guaranteedDepositIds(captureRows: MirrorRow[], guaranteeRows: MirrorRow[]) {
  const result = new Set<string>();
  const captureById = new Map(captureRows.map(row => [row.source_id, row.payload]));

  for (const capture of captureRows) {
    if (capture.payload.guarantee_activated_at) {
      const depositId = str(capture.payload.deposit_id);
      if (depositId) result.add(depositId);
    }
  }

  for (const guarantee of guaranteeRows) {
    if (str(guarantee.payload.status) !== "accepted") continue;
    const directDepositId = str(guarantee.payload.deposit_id);
    if (directDepositId) result.add(directDepositId);
    const capture = captureById.get(str(guarantee.payload.capture_id));
    const depositId = capture ? str(capture.deposit_id) : "";
    if (depositId) result.add(depositId);
  }

  return result;
}

export async function GET() {
  try {
    await requireCockpitAccess();
    const admin = getSupabaseAdmin();
    const [accountsRows, depositRows, operationRows, captureRows, guaranteeRows, rulesResult, syncResult] = await Promise.all([
      readSourceTable("accounts"),
      readSourceTable("deposits"),
      readSourceTable("client_operations"),
      readSourceTable("captures"),
      readSourceTable("guarantee_activations"),
      admin.from("kpi_partner_remuneration_rules").select("*").order("actor_label", { ascending: true }),
      admin.from("gando_source_sync_state").select("last_completed_at,status").order("last_completed_at", { ascending: false }).limit(1),
    ]);
    if (rulesResult.error) throw rulesResult.error;
    if (syncResult.error) throw syncResult.error;

    const accounts = new Map(accountsRows.map(row => [row.source_id, row.payload]));
    const deposits = buildDeposits(depositRows);
    const fleeteeAccountIds = new Set(
      deposits
        .filter(deposit => deposit.accountId && deposit.returnUrl.toLowerCase().includes("link.fleetee.io"))
        .map(deposit => deposit.accountId),
    );
    const guaranteed = guaranteedDepositIds(captureRows, guaranteeRows);
    const fees: FeeOperation[] = operationRows
      .filter(row => str(row.payload.type) === "fee")
      .map(row => ({
        id: row.source_id,
        clientId: str(row.payload.client_id),
        amountCents: num(row.payload.amount),
        createdAt: timestamp(row.payload.created_at),
      }))
      .filter(row => row.clientId && row.amountCents > 0);
    const feeByDeposit = matchFees(deposits, fees);

    const rows = ((rulesResult.data || []) as Row[]).map(rule => {
      const actorKey = str(rule.actor_key);
      const accountId = str(rule.account_id);
      const calculationMode = str(rule.calculation_mode) || "fixed_tier";
      const rateBps = num(rule.rate_bps);
      const tiers = Array.isArray(rule.tiers) ? rule.tiers as Tier[] : [];
      const isFleetee = actorKey === "fleetee" && calculationMode === "fleetee_active_deposit";
      const configured = bool(rule.enabled) && (isFleetee || Boolean(accountId));
      const account = accountId ? accounts.get(accountId) : null;
      const actorDeposits = isFleetee
        ? deposits.filter(deposit => !deposit.archived && fleeteeAccountIds.has(deposit.accountId))
        : deposits.filter(deposit => deposit.accountId === accountId && !deposit.archived);

      const eligible = actorDeposits.flatMap<EligibleItem>(deposit => {
        if (!configured) return [];

        if (isFleetee) {
          // Fleetee rémunère toutes les cautions des loueurs associés dès lors qu'elles ont
          // été activées. `start_at` garde cette preuve même après clôture ou annulation.
          if (deposit.startAt == null) return [];
          if (deposit.amountCents <= 80000) return [];
          if (guaranteed.has(deposit.id)) return [];
          const eventAt = deposit.startAt;
          if (!isEffective(eventAt, rule.effective_from, rule.effective_to)) return [];
          const dueCents = rewardForDeposit(deposit.amountCents, tiers) || 200;
          return [{
            deposit,
            fee: feeByDeposit.get(deposit.id) || null,
            dueCents,
            month: monthKey(eventAt) || "unknown",
          }];
        }

        const fee = feeByDeposit.get(deposit.id);
        if (!fee || !isEffective(fee.createdAt, rule.effective_from, rule.effective_to)) return [];

        let dueCents = 0;
        if (calculationMode === "active_volume_rate") {
          if (deposit.status !== "active" || rateBps <= 0) return [];
          dueCents = rateReward(deposit.amountCents, rateBps);
        } else {
          if (!SUCCESSFUL_STATUSES.has(deposit.status)) return [];
          dueCents = rewardForDeposit(deposit.amountCents, tiers);
        }
        if (dueCents <= 0) return [];

        return [{ deposit, fee, dueCents, month: monthKey(fee.createdAt) || "unknown" }];
      });

      const monthlyMap = new Map<string, { month: string; deposits: number; tdvCents: number; securingFeesCents: number; dueCents: number }>();
      for (const item of eligible) {
        const current = monthlyMap.get(item.month) || { month: item.month, deposits: 0, tdvCents: 0, securingFeesCents: 0, dueCents: 0 };
        current.deposits += 1;
        current.tdvCents += item.deposit.amountCents;
        current.securingFeesCents += item.fee?.amountCents || 0;
        current.dueCents += item.dueCents;
        monthlyMap.set(item.month, current);
      }
      const monthly = [...monthlyMap.values()].sort((a, b) => b.month.localeCompare(a.month));

      const breakdownMap = new Map<string, { accountId: string; accountName: string; deposits: number; tdvCents: number; dueCents: number }>();
      for (const item of eligible) {
        const itemAccount = accounts.get(item.deposit.accountId);
        const accountName = itemAccount
          ? str(itemAccount.display_name) || str(itemAccount.company_name) || item.deposit.accountId
          : item.deposit.accountId || "Compte inconnu";
        const key = item.deposit.accountId || accountName;
        const current = breakdownMap.get(key) || { accountId: item.deposit.accountId, accountName, deposits: 0, tdvCents: 0, dueCents: 0 };
        current.deposits += 1;
        current.tdvCents += item.deposit.amountCents;
        current.dueCents += item.dueCents;
        breakdownMap.set(key, current);
      }
      const breakdown = [...breakdownMap.values()].sort((a, b) => b.dueCents - a.dueCents || a.accountName.localeCompare(b.accountName));

      return {
        actorKey,
        actorLabel: str(rule.actor_label),
        accountId: accountId || null,
        accountName: account ? str(account.display_name) || str(account.company_name) || null : null,
        mechanism: str(rule.mechanism),
        calculationMode,
        rateBps: rateBps || null,
        configured,
        eligibleDeposits: eligible.length,
        eligibleTdvCents: eligible.reduce((sum, item) => sum + item.deposit.amountCents, 0),
        eligibleSecuringFeesCents: eligible.reduce((sum, item) => sum + (item.fee?.amountCents || 0), 0),
        dueCents: eligible.reduce((sum, item) => sum + item.dueCents, 0),
        monthly,
        breakdown,
        notes: str(rule.notes) || null,
        consistencyWarning: actorKey === "lr" && rateBps === 114
          ? "Les exemples 6,65 € sur 950 € et 10,50 € sur 1 500 € correspondent à 0,70 %, alors que la règle septembre configurée est 1,14 %."
          : null,
      };
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthDueCents = rows.reduce((sum, row) => sum + (row.monthly.find(month => month.month === currentMonth)?.dueCents || 0), 0);

    return NextResponse.json({
      source: {
        lastSyncedAt: syncResult.data?.[0]?.last_completed_at || null,
      },
      currentMonth,
      currentMonthDueCents,
      configuredPartners: rows.filter(row => row.configured).length,
      rows,
    });
  } catch (error) {
    console.error("Partner remuneration KPI failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de calculer les rémunérations partenaires." },
      { status: 500 },
    );
  }
}
