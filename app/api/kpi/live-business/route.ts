import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type MirrorRow = { source_id: string; payload: Row; synced_at?: string | null };
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
type FeeOperation = { id: string; clientId: string; amountCents: number; createdAt: number | null };
type Tier = { min_cents?: number; max_cents?: number; reward_cents?: number };

const SUCCESSFUL_DEPOSIT_STATUSES = new Set(["active", "close", "captured"]);
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
function gapToDeposit(feeAt: number | null, deposit: Deposit) {
  if (feeAt == null) return Number.POSITIVE_INFINITY;
  const candidates = [deposit.createdAt, deposit.updatedAt].filter((value): value is number => value != null);
  if (!candidates.length) return Number.POSITIVE_INFINITY;
  return Math.min(...candidates.map(value => Math.abs(feeAt - value)));
}

async function readSourceTable(table: string): Promise<MirrorRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("gando_source_records")
    .select("source_id,payload,synced_at")
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
    archived: bool(row.payload.is_archived),
  }));
}

function matchFeesToSuccessfulDeposits(deposits: Deposit[], feeOperations: FeeOperation[]) {
  const depositsByClient = new Map<string, Deposit[]>();
  for (const deposit of deposits) {
    if (!SUCCESSFUL_DEPOSIT_STATUSES.has(deposit.status) || deposit.archived || !deposit.clientId) continue;
    const list = depositsByClient.get(deposit.clientId) || [];
    list.push(deposit);
    depositsByClient.set(deposit.clientId, list);
  }

  const usedDeposits = new Set<string>();
  const matched = new Map<string, FeeOperation>();
  const sortedFees = [...feeOperations].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  for (const fee of sortedFees) {
    const candidates = (depositsByClient.get(fee.clientId) || [])
      .filter(deposit => !usedDeposits.has(deposit.id))
      .map(deposit => ({ deposit, gap: gapToDeposit(fee.createdAt, deposit) }))
      .filter(candidate => candidate.gap <= FEE_MATCH_WINDOW_MS)
      .sort((a, b) => a.gap - b.gap);

    const best = candidates[0];
    if (!best) continue;
    usedDeposits.add(best.deposit.id);
    matched.set(best.deposit.id, fee);
  }

  return matched;
}

function rewardForDeposit(amountCents: number, tiers: Tier[]) {
  const tier = tiers.find(candidate => {
    const min = num(candidate.min_cents);
    const max = candidate.max_cents == null ? Number.POSITIVE_INFINITY : num(candidate.max_cents);
    return amountCents >= min && amountCents <= max;
  });
  return tier ? num(tier.reward_cents) : 0;
}

export async function GET() {
  try {
    await requireCockpitAccess();
    const admin = getSupabaseAdmin();

    const [accountsRows, clientsRows, depositRows, operationRows, captureRows, guaranteeRows, rulesResult, settingsResult, syncResult] = await Promise.all([
      readSourceTable("accounts"),
      readSourceTable("clients"),
      readSourceTable("deposits"),
      readSourceTable("client_operations"),
      readSourceTable("captures"),
      readSourceTable("guarantee_activations"),
      admin.from("kpi_partner_remuneration_rules").select("*").order("actor_label", { ascending: true }),
      admin.from("kpi_economics_settings").select("*").eq("id", "default").maybeSingle(),
      admin.from("gando_source_sync_state").select("source_table,rows_synced,last_completed_at,status").order("last_completed_at", { ascending: false }),
    ]);

    if (rulesResult.error) throw rulesResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (syncResult.error) throw syncResult.error;

    const accounts = new Map(accountsRows.map(row => [row.source_id, row.payload]));
    const clients = new Map(clientsRows.map(row => [row.source_id, row.payload]));
    const deposits = buildDeposits(depositRows);
    const successfulDeposits = deposits.filter(deposit => SUCCESSFUL_DEPOSIT_STATUSES.has(deposit.status) && !deposit.archived);

    const feeOperations: FeeOperation[] = operationRows
      .filter(row => str(row.payload.type) === "fee")
      .map(row => ({
        id: row.source_id,
        clientId: str(row.payload.client_id),
        amountCents: num(row.payload.amount),
        createdAt: timestamp(row.payload.created_at),
      }))
      .filter(row => row.clientId && row.amountCents > 0);

    const feeByDeposit = matchFeesToSuccessfulDeposits(deposits, feeOperations);
    const feeOperationsTotalCents = feeOperations.reduce((sum, operation) => sum + operation.amountCents, 0);
    const matchedSecuringFeesCents = [...feeByDeposit.values()].reduce((sum, operation) => sum + operation.amountCents, 0);
    const totalSecuredCents = successfulDeposits.reduce((sum, deposit) => sum + deposit.amountCents, 0);
    const activeAccounts = new Set(successfulDeposits.map(deposit => deposit.accountId).filter(Boolean));

    const paidCaptures = captureRows.filter(row => str(row.payload.status) === "paid");
    const paidCaptureAmountCents = paidCaptures.reduce((sum, row) => sum + num(row.payload.amount_cents), 0);
    const acceptedGuarantees = guaranteeRows.filter(row => str(row.payload.status) === "accepted");

    const rules = (rulesResult.data || []) as Row[];
    const remuneration = rules.map(rule => {
      const accountId = str(rule.account_id);
      const tiers = Array.isArray(rule.tiers) ? (rule.tiers as Tier[]) : [];
      const enabled = bool(rule.enabled);
      const actorDeposits = successfulDeposits.filter(deposit => deposit.accountId === accountId);
      const eligibleDeposits = enabled
        ? actorDeposits.filter(deposit => feeByDeposit.has(deposit.id) && rewardForDeposit(deposit.amountCents, tiers) > 0)
        : [];
      const cashbackDueCents = eligibleDeposits.reduce((sum, deposit) => sum + rewardForDeposit(deposit.amountCents, tiers), 0);
      const eligibleTdvCents = eligibleDeposits.reduce((sum, deposit) => sum + deposit.amountCents, 0);
      const eligibleSecuringFeesCents = eligibleDeposits.reduce((sum, deposit) => sum + (feeByDeposit.get(deposit.id)?.amountCents || 0), 0);
      const account = accountId ? accounts.get(accountId) : null;

      return {
        actorKey: str(rule.actor_key),
        actorLabel: str(rule.actor_label),
        accountId: accountId || null,
        accountName: account ? str(account.display_name) || str(account.company_name) || null : null,
        mechanism: str(rule.mechanism),
        configured: enabled && Boolean(accountId),
        eligibleDeposits: eligibleDeposits.length,
        successfulDeposits: actorDeposits.length,
        eligibleTdvCents,
        eligibleSecuringFeesCents,
        cashbackDueCents,
        tiers,
        notes: str(rule.notes) || null,
      };
    });

    const insuranceUnitCents = settingsResult.data?.insurance_cost_per_won_deposit_cents == null
      ? null
      : num(settingsResult.data.insurance_cost_per_won_deposit_cents);
    const insuranceTotalCents = insuranceUnitCents == null ? null : successfulDeposits.length * insuranceUnitCents;
    const cashbackTotalCents = remuneration.reduce((sum, row) => sum + row.cashbackDueCents, 0);
    const contributionAfterCashbackAndInsuranceCents = insuranceTotalCents == null
      ? null
      : matchedSecuringFeesCents - cashbackTotalCents - insuranceTotalCents;

    const matchedDepositCount = feeByDeposit.size;
    const successfulWithoutMatchedFee = Math.max(0, successfulDeposits.length - matchedDepositCount);
    const lastSyncedAt = (syncResult.data || [])
      .map(row => row.last_completed_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null;

    const accountRows = [...activeAccounts].map(accountId => {
      const account = accounts.get(accountId) || {};
      const accountDeposits = successfulDeposits.filter(deposit => deposit.accountId === accountId);
      const accountFees = accountDeposits.reduce((sum, deposit) => sum + (feeByDeposit.get(deposit.id)?.amountCents || 0), 0);
      return {
        accountId,
        accountName: str(account.display_name) || str(account.company_name) || "Loueur sans nom",
        successfulDeposits: accountDeposits.length,
        tdvCents: accountDeposits.reduce((sum, deposit) => sum + deposit.amountCents, 0),
        securingFeesCents: accountFees,
      };
    }).sort((a, b) => b.successfulDeposits - a.successfulDeposits);

    return NextResponse.json({
      source: {
        project: "Gando production",
        lastSyncedAt,
        sourceTables: (syncResult.data || []).filter(row => row.status === "success").length,
      },
      core: {
        successfulDeposits: successfulDeposits.length,
        activeAccounts: activeAccounts.size,
        totalSecuredCents,
        averageDepositCents: successfulDeposits.length ? Math.round(totalSecuredCents / successfulDeposits.length) : 0,
        securingFeesPaidCents: feeOperationsTotalCents,
        matchedSecuringFeesCents,
        paidCaptures: paidCaptures.length,
        paidCaptureAmountCents,
        acceptedGuarantees: acceptedGuarantees.length,
      },
      economics: {
        cashbackDueCents: cashbackTotalCents,
        insuranceCostPerWonDepositCents: insuranceUnitCents,
        insuranceTotalCents,
        contributionAfterCashbackAndInsuranceCents,
      },
      quality: {
        feeOperations: feeOperations.length,
        matchedFeeOperations: matchedDepositCount,
        unmatchedFeeOperations: Math.max(0, feeOperations.length - matchedDepositCount),
        successfulDepositsWithoutMatchedFee: successfulWithoutMatchedFee,
        feeMatchWindowDays: FEE_MATCH_WINDOW_MS / 86400000,
      },
      remuneration,
      accounts: accountRows,
      metadata: {
        clients: clients.size,
        accounts: accounts.size,
      },
    });
  } catch (error) {
    console.error("Live business KPI failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de calculer les KPI produit." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCockpitAccess();
    if (access.role === "commercial") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const raw = body?.insuranceCostPerWonDepositEuros;
    let cents: number | null = null;
    if (raw !== null && raw !== undefined && raw !== "") {
      const euros = Number(raw);
      if (!Number.isFinite(euros) || euros < 0 || euros > 10000) {
        return NextResponse.json({ error: "Coût assurance invalide." }, { status: 400 });
      }
      cents = Math.round(euros * 100);
    }

    const { error } = await getSupabaseAdmin()
      .from("kpi_economics_settings")
      .upsert({
        id: "default",
        insurance_cost_per_won_deposit_cents: cents,
        updated_at: new Date().toISOString(),
        updated_by: access.email || null,
      }, { onConflict: "id" });
    if (error) throw error;

    return NextResponse.json({ success: true, insuranceCostPerWonDepositCents: cents });
  } catch (error) {
    console.error("Live KPI settings update failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d’enregistrer le coût assurance." },
      { status: 500 },
    );
  }
}
