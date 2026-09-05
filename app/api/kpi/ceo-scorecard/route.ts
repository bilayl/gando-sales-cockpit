import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type MirrorRow = { source_id: string; payload: Row };
type Deposit = { id: string; clientId: string; accountId: string; status: string; amountCents: number; createdAt: number | null; updatedAt: number | null; archived: boolean };
type Fee = { id: string; clientId: string; amountCents: number; createdAt: number | null };
type Tier = { min_cents?: number; max_cents?: number; reward_cents?: number };

const SUCCESSFUL = new Set(["active", "close", "captured"]);
const MATCH_WINDOW_MS = 14 * 86400000;
const DEFAULT_INSURANCE_RATE_BPS = 114;
const DEFAULT_INSURANCE_EFFECTIVE_FROM = Date.parse("2026-09-01T00:00:00.000Z");

function str(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function bool(value: unknown) { return value === true || value === "true"; }
function ts(value: unknown) { if (typeof value !== "string" || !value) return null; const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; }
function monthKey(value: number) { return new Date(value).toISOString().slice(0, 7); }
function startOfUtcMonth(value: number) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}
function previousUtcMonthStart(currentStart: number) {
  const date = new Date(currentStart);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1);
}
function reward(amountCents: number, tiers: Tier[]) {
  const tier = tiers.find(candidate => amountCents >= num(candidate.min_cents) && amountCents <= (candidate.max_cents == null ? Number.POSITIVE_INFINITY : num(candidate.max_cents)));
  return tier ? num(tier.reward_cents) : 0;
}
function perCaution(totalCents: number | null, count: number) {
  return totalCents == null || count <= 0 ? null : Math.round(totalCents / count);
}

async function read(table: string): Promise<MirrorRow[]> {
  const { data, error } = await getSupabaseAdmin().from("gando_source_records").select("source_id,payload").eq("source_table", table).order("source_id", { ascending: true });
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
    const admin = getSupabaseAdmin();
    const [depositRows, operationRows, captureRows, rulesResult, settingsResult, syncResult] = await Promise.all([
      read("deposits"),
      read("client_operations"),
      read("captures"),
      admin.from("kpi_partner_remuneration_rules").select("*"),
      admin.from("kpi_economics_settings").select("*").eq("id", "default").maybeSingle(),
      admin.from("gando_source_sync_state").select("last_completed_at,status").order("last_completed_at", { ascending: false }).limit(1),
    ]);
    if (rulesResult.error) throw rulesResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (syncResult.error) throw syncResult.error;

    const deposits = buildDeposits(depositRows);
    const fees: Fee[] = operationRows
      .filter(row => str(row.payload.type) === "fee")
      .map(row => ({ id: row.source_id, clientId: str(row.payload.client_id), amountCents: num(row.payload.amount), createdAt: ts(row.payload.created_at) }))
      .filter(row => row.clientId && row.amountCents > 0);
    const feeByDeposit = matchFees(deposits, fees);
    const wonDeposits = deposits.filter(deposit => SUCCESSFUL.has(deposit.status) && !deposit.archived && feeByDeposit.has(deposit.id));

    const now = Date.now();
    const currentStart = startOfUtcMonth(now);
    const previousStart = previousUtcMonthStart(currentStart);
    const elapsedThisMonth = now - currentStart;
    const previousComparableEnd = Math.min(previousStart + elapsedThisMonth, currentStart);
    const currentMonth = monthKey(currentStart);
    const previousMonth = monthKey(previousStart);

    const currentWon = wonDeposits.filter(deposit => {
      const paidAt = feeByDeposit.get(deposit.id)?.createdAt;
      return paidAt != null && paidAt >= currentStart && paidAt <= now;
    });
    const previousWon = wonDeposits.filter(deposit => {
      const paidAt = feeByDeposit.get(deposit.id)?.createdAt;
      return paidAt != null && paidAt >= previousStart && paidAt <= previousComparableEnd;
    });
    const currentMau = new Set(currentWon.map(deposit => deposit.accountId).filter(Boolean));
    const lifetimeActiveRenters = new Set(wonDeposits.map(deposit => deposit.accountId).filter(Boolean));
    const currentGuaranteeCents = currentWon.reduce((sum, deposit) => sum + deposit.amountCents, 0);
    const lifetimeGuaranteeCents = wonDeposits.reduce((sum, deposit) => sum + deposit.amountCents, 0);
    const currentGrossRevenueCents = currentWon.reduce((sum, deposit) => sum + (feeByDeposit.get(deposit.id)?.amountCents || 0), 0);
    const lifetimeGrossRevenueCents = wonDeposits.reduce((sum, deposit) => sum + (feeByDeposit.get(deposit.id)?.amountCents || 0), 0);

    const rules = (rulesResult.data || []) as Row[];
    function partnerCost(from: number | null, to: number | null) {
      let total = 0;
      for (const rule of rules) {
        if (!bool(rule.enabled) || !str(rule.account_id)) continue;
        const mode = str(rule.calculation_mode) || "fixed_tier";
        const accountId = str(rule.account_id);
        const rateBps = num(rule.rate_bps);
        const tiers = Array.isArray(rule.tiers) ? rule.tiers as Tier[] : [];
        const effectiveFrom = ts(rule.effective_from);
        const effectiveTo = ts(rule.effective_to);
        for (const deposit of deposits) {
          const fee = feeByDeposit.get(deposit.id);
          if (!fee || fee.createdAt == null || deposit.accountId !== accountId || deposit.archived) continue;
          if (from != null && fee.createdAt < from) continue;
          if (to != null && fee.createdAt > to) continue;
          if (effectiveFrom != null && fee.createdAt < effectiveFrom) continue;
          if (effectiveTo != null && fee.createdAt > effectiveTo) continue;
          if (mode === "active_volume_rate") {
            if (deposit.status === "active" && rateBps > 0) total += Math.round(deposit.amountCents * rateBps / 10000);
          } else if (SUCCESSFUL.has(deposit.status)) {
            total += reward(deposit.amountCents, tiers);
          }
        }
      }
      return total;
    }

    const currentPartnerCostCents = partnerCost(currentStart, now);
    const lifetimePartnerCostCents = partnerCost(null, now);

    const insuranceRateBps = settingsResult.data?.insurance_rate_bps == null
      ? DEFAULT_INSURANCE_RATE_BPS
      : num(settingsResult.data.insurance_rate_bps);
    const insuranceEffectiveFrom = ts(settingsResult.data?.insurance_effective_from) ?? DEFAULT_INSURANCE_EFFECTIVE_FROM;
    const currentInsuredGuaranteeCents = currentWon.reduce((sum, deposit) => {
      const feeAt = feeByDeposit.get(deposit.id)?.createdAt;
      return feeAt != null && feeAt >= insuranceEffectiveFrom ? sum + deposit.amountCents : sum;
    }, 0);
    const lifetimeInsuredGuaranteeCents = wonDeposits.reduce((sum, deposit) => {
      const feeAt = feeByDeposit.get(deposit.id)?.createdAt;
      return feeAt != null && feeAt >= insuranceEffectiveFrom ? sum + deposit.amountCents : sum;
    }, 0);
    const currentInsuranceCents = Math.round(currentInsuredGuaranteeCents * insuranceRateBps / 10000);
    const lifetimeInsuranceCents = Math.round(lifetimeInsuredGuaranteeCents * insuranceRateBps / 10000);
    const measuredContributionCents = currentGrossRevenueCents - currentPartnerCostCents - currentInsuranceCents;
    const lifetimeMeasuredContributionCents = lifetimeGrossRevenueCents - lifetimePartnerCostCents - lifetimeInsuranceCents;
    const contributionPerCautionCents = perCaution(measuredContributionCents, currentWon.length);
    const lifetimeContributionPerCautionCents = perCaution(lifetimeMeasuredContributionCents, wonDeposits.length);

    const guaranteeActivatedCaptures = captureRows.filter(row => str(row.payload.status) === "guarantee_activated");
    const guaranteeActivatedLossCents = guaranteeActivatedCaptures.reduce((sum, row) => sum + num(row.payload.amount_cents), 0);
    const currentGuaranteeActivatedCaptures = guaranteeActivatedCaptures.filter(row => {
      const createdAt = ts(row.payload.created_at);
      return createdAt != null && createdAt >= currentStart && createdAt <= now;
    });
    const currentGuaranteeActivatedLossCents = currentGuaranteeActivatedCaptures.reduce((sum, row) => sum + num(row.payload.amount_cents), 0);
    const lossRateProxy = lifetimeGuaranteeCents > 0 ? guaranteeActivatedLossCents / lifetimeGuaranteeCents : null;
    const currentLossRateProxy = currentGuaranteeCents > 0 ? currentGuaranteeActivatedLossCents / currentGuaranteeCents : null;

    return NextResponse.json({
      period: {
        currentMonth,
        previousMonth,
        comparisonMode: "same_elapsed_period_previous_month",
        comparisonThroughDay: new Date(now).getUTCDate(),
      },
      cautions: {
        current: currentWon.length,
        previous: previousWon.length,
        total: wonDeposits.length,
        mom: previousWon.length > 0 ? (currentWon.length - previousWon.length) / previousWon.length : null,
        tdvCents: currentGuaranteeCents,
        totalTdvCents: lifetimeGuaranteeCents,
      },
      mau: {
        current: currentMau.size,
        cautionsPerMau: currentMau.size > 0 ? currentWon.length / currentMau.size : null,
        activatedEver: lifetimeActiveRenters.size,
        cautionsPerActivatedEver: lifetimeActiveRenters.size > 0 ? wonDeposits.length / lifetimeActiveRenters.size : null,
      },
      guarantee: {
        providedCents: currentGuaranteeCents,
        totalProvidedCents: lifetimeGuaranteeCents,
        averagePerCautionCents: perCaution(currentGuaranteeCents, currentWon.length),
        totalAveragePerCautionCents: perCaution(lifetimeGuaranteeCents, wonDeposits.length),
        insuranceRateBps,
        insuranceEffectiveFrom: new Date(insuranceEffectiveFrom).toISOString().slice(0, 10),
        insuredGuaranteeCents: currentInsuredGuaranteeCents,
        totalInsuredGuaranteeCents: lifetimeInsuredGuaranteeCents,
        insuranceCostCents: currentInsuranceCents,
        totalInsuranceCostCents: lifetimeInsuranceCents,
        grossRevenueYield: currentGuaranteeCents > 0 ? currentGrossRevenueCents / currentGuaranteeCents : null,
        totalGrossRevenueYield: lifetimeGuaranteeCents > 0 ? lifetimeGrossRevenueCents / lifetimeGuaranteeCents : null,
        measuredContributionYield: currentGuaranteeCents > 0 ? measuredContributionCents / currentGuaranteeCents : null,
        totalMeasuredContributionYield: lifetimeGuaranteeCents > 0 ? lifetimeMeasuredContributionCents / lifetimeGuaranteeCents : null,
      },
      contribution: {
        perCautionCents: contributionPerCautionCents,
        measuredContributionCents,
        grossRevenueCents: currentGrossRevenueCents,
        grossRevenuePerCautionCents: perCaution(currentGrossRevenueCents, currentWon.length),
        partnerCostCents: currentPartnerCostCents,
        partnerCostPerCautionCents: perCaution(currentPartnerCostCents, currentWon.length),
        insuranceCostCents: currentInsuranceCents,
        insuranceCostPerCautionCents: perCaution(currentInsuranceCents, currentWon.length),
        totalPerCautionCents: lifetimeContributionPerCautionCents,
        totalMeasuredContributionCents: lifetimeMeasuredContributionCents,
        totalGrossRevenueCents: lifetimeGrossRevenueCents,
        totalGrossRevenuePerCautionCents: perCaution(lifetimeGrossRevenueCents, wonDeposits.length),
        totalPartnerCostCents: lifetimePartnerCostCents,
        totalPartnerCostPerCautionCents: perCaution(lifetimePartnerCostCents, wonDeposits.length),
        totalInsuranceCostCents: lifetimeInsuranceCents,
        totalInsuranceCostPerCautionCents: perCaution(lifetimeInsuranceCents, wonDeposits.length),
        complete: false,
        missing: ["PSP", "pertes finales / recouvrements"],
      },
      loss: {
        currentRate: currentLossRateProxy,
        currentAmountCents: currentGuaranteeActivatedLossCents,
        rate: lossRateProxy,
        amountCents: guaranteeActivatedLossCents,
        basis: "garanties activées / garantie fournie",
        isProxy: true,
      },
      source: { lastSyncedAt: syncResult.data?.[0]?.last_completed_at || null },
    });
  } catch (error) {
    console.error("CEO scorecard failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de calculer le CEO scorecard." }, { status: 500 });
  }
}
