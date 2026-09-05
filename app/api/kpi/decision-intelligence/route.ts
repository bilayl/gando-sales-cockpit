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
  archived: boolean;
};
type Fee = { id: string; clientId: string; amountCents: number; createdAt: number | null };
type Tier = { min_cents?: number; max_cents?: number; reward_cents?: number };
type MonthBucket = {
  month: string;
  cautions: number;
  tdvCents: number;
  revenueCents: number;
  partnerCostCents: number;
  insuranceCostCents: number;
  contributionCents: number;
  lossProxyCents: number;
  mau: Set<string>;
};

const SUCCESSFUL = new Set(["active", "close", "captured"]);
const MATCH_WINDOW_MS = 14 * 86400000;
const DEFAULT_INSURANCE_RATE_BPS = 114;
const DEFAULT_INSURANCE_EFFECTIVE_FROM = Date.parse("2026-09-01T00:00:00.000Z");
const USAGE_REFERENCE = 3.5;

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
function monthStart(key: string) {
  const [year, month] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, 1);
}
function shiftMonth(key: string, delta: number) {
  const date = new Date(monthStart(key));
  return monthKey(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}
function daysInMonth(key: string) {
  const start = new Date(monthStart(key));
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
}
function reward(amountCents: number, tiers: Tier[]) {
  const tier = tiers.find(candidate => {
    const min = num(candidate.min_cents);
    const max = candidate.max_cents == null ? Number.POSITIVE_INFINITY : num(candidate.max_cents);
    return amountCents >= min && amountCents <= max;
  });
  return tier ? num(tier.reward_cents) : 0;
}
function safeRatio(top: number, bottom: number) {
  return bottom > 0 ? top / bottom : null;
}
function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function clampNonNegative(value: number) {
  return Math.max(0, value);
}

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
        const gap = dates.length
          ? Math.min(...dates.map(value => Math.abs(fee.createdAt! - value)))
          : Number.POSITIVE_INFINITY;
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

function newBucket(month: string): MonthBucket {
  return {
    month,
    cautions: 0,
    tdvCents: 0,
    revenueCents: 0,
    partnerCostCents: 0,
    insuranceCostCents: 0,
    contributionCents: 0,
    lossProxyCents: 0,
    mau: new Set<string>(),
  };
}

function linearForecast(values: number[]) {
  const n = values.length;
  if (n < 3) {
    return { slope: 0, intercept: values.at(-1) || 0, r2: 0, rmse: 0 };
  }
  const meanX = (n - 1) / 2;
  const meanY = avg(values);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (i - meanX) * (values[i] - meanY);
    denominator += (i - meanX) ** 2;
  }
  const slope = denominator > 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  const fitted = values.map((_, index) => intercept + slope * index);
  const ssRes = values.reduce((sum, value, index) => sum + (value - fitted[index]) ** 2, 0);
  const ssTot = values.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;
  const rmse = Math.sqrt(ssRes / n);
  return { slope, intercept, r2, rmse };
}

function confidenceLabel(historyPoints: number, r2: number) {
  if (historyPoints >= 6 && r2 >= 0.7) return "high" as const;
  if (historyPoints >= 4 && r2 >= 0.4) return "medium" as const;
  return "low" as const;
}

export async function GET() {
  try {
    await requireCockpitAccess();
    const admin = getSupabaseAdmin();

    const [depositRows, operationRows, captureRows, pspRows, rulesResult, settingsResult, acquisitionCostsResult, funnelResult] = await Promise.all([
      read("deposits"),
      read("client_operations"),
      read("captures"),
      read("psp_transactions"),
      admin.from("kpi_partner_remuneration_rules").select("*"),
      admin.from("kpi_economics_settings").select("*").eq("id", "default").maybeSingle(),
      admin.from("kpi_acquisition_cost_entries").select("year,month_number,amount"),
      admin.from("kpi_value_funnel_monthly").select("year,month_number,renters_activated,first_deposit_renters"),
    ]);

    if (rulesResult.error) throw rulesResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (acquisitionCostsResult.error) throw acquisitionCostsResult.error;
    if (funnelResult.error) throw funnelResult.error;

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
    const wonDeposits = deposits.filter(deposit => SUCCESSFUL.has(deposit.status) && !deposit.archived && feeByDeposit.has(deposit.id));
    const rules = (rulesResult.data || []) as Row[];
    const insuranceRateBps = settingsResult.data?.insurance_rate_bps == null
      ? DEFAULT_INSURANCE_RATE_BPS
      : num(settingsResult.data.insurance_rate_bps);
    const insuranceEffectiveFrom = ts(settingsResult.data?.insurance_effective_from) ?? DEFAULT_INSURANCE_EFFECTIVE_FROM;

    const buckets = new Map<string, MonthBucket>();
    const ensureBucket = (key: string) => {
      const existing = buckets.get(key);
      if (existing) return existing;
      const created = newBucket(key);
      buckets.set(key, created);
      return created;
    };

    function partnerCostForDeposit(deposit: Deposit, feeAt: number) {
      let cost = 0;
      for (const rule of rules) {
        if (!bool(rule.enabled) || str(rule.account_id) !== deposit.accountId) continue;
        const effectiveFrom = ts(rule.effective_from);
        const effectiveTo = ts(rule.effective_to);
        if (effectiveFrom != null && feeAt < effectiveFrom) continue;
        if (effectiveTo != null && feeAt > effectiveTo) continue;
        const mode = str(rule.calculation_mode) || "fixed_tier";
        if (mode === "active_volume_rate") {
          if (deposit.status === "active") cost += Math.round(deposit.amountCents * num(rule.rate_bps) / 10000);
        } else {
          const tiers = Array.isArray(rule.tiers) ? rule.tiers as Tier[] : [];
          cost += reward(deposit.amountCents, tiers);
        }
      }
      return cost;
    }

    for (const deposit of wonDeposits) {
      const fee = feeByDeposit.get(deposit.id);
      if (!fee?.createdAt) continue;
      const key = monthKey(fee.createdAt);
      const bucket = ensureBucket(key);
      bucket.cautions += 1;
      bucket.tdvCents += deposit.amountCents;
      bucket.revenueCents += fee.amountCents;
      if (deposit.accountId) bucket.mau.add(deposit.accountId);
      if (fee.createdAt >= insuranceEffectiveFrom) {
        bucket.insuranceCostCents += Math.round(deposit.amountCents * insuranceRateBps / 10000);
      }
      bucket.partnerCostCents += partnerCostForDeposit(deposit, fee.createdAt);
    }

    for (const row of captureRows) {
      if (str(row.payload.status) !== "guarantee_activated") continue;
      const createdAt = ts(row.payload.guarantee_activated_at) ?? ts(row.payload.created_at);
      if (createdAt == null) continue;
      ensureBucket(monthKey(createdAt)).lossProxyCents += num(row.payload.amount_cents);
    }

    const currentMonth = monthKey(Date.now());
    const earliestMonth = [...buckets.keys()].sort()[0] || currentMonth;
    for (let key = earliestMonth; key <= currentMonth; key = shiftMonth(key, 1)) {
      ensureBucket(key);
      if (key === currentMonth) break;
    }

    const accountMonths = new Map<string, Set<string>>();
    for (const deposit of wonDeposits) {
      const feeAt = feeByDeposit.get(deposit.id)?.createdAt;
      if (feeAt == null || !deposit.accountId) continue;
      const set = accountMonths.get(deposit.accountId) || new Set<string>();
      set.add(monthKey(feeAt));
      accountMonths.set(deposit.accountId, set);
    }

    const actual = [...buckets.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(bucket => {
        bucket.contributionCents = bucket.revenueCents - bucket.insuranceCostCents - bucket.partnerCostCents;
        const previousMonth = shiftMonth(bucket.month, -1);
        const previousAccounts = new Set(
          [...accountMonths.entries()]
            .filter(([, months]) => months.has(previousMonth))
            .map(([accountId]) => accountId),
        );
        const retainedAccounts = [...previousAccounts].filter(accountId => accountMonths.get(accountId)?.has(bucket.month)).length;
        return {
          month: bucket.month,
          partial: bucket.month === currentMonth,
          cautions: bucket.cautions,
          tdvCents: bucket.tdvCents,
          revenueCents: bucket.revenueCents,
          insuranceCostCents: bucket.insuranceCostCents,
          partnerCostCents: bucket.partnerCostCents,
          contributionCents: bucket.contributionCents,
          lossProxyCents: bucket.lossProxyCents,
          mau: bucket.mau.size,
          cautionsPerMau: bucket.mau.size > 0 ? bucket.cautions / bucket.mau.size : null,
          revenuePerCautionCents: bucket.cautions > 0 ? Math.round(bucket.revenueCents / bucket.cautions) : null,
          contributionPerCautionCents: bucket.cautions > 0 ? Math.round(bucket.contributionCents / bucket.cautions) : null,
          retentionRate: previousAccounts.size > 0 ? retainedAccounts / previousAccounts.size : null,
        };
      });

    const completed = actual.filter(row => !row.partial && row.cautions > 0);
    const regressionWindow = completed.slice(-6);
    const regression = linearForecast(regressionWindow.map(row => row.cautions));
    const trailing = completed.slice(-3);
    const trailingCautions = trailing.reduce((sum, row) => sum + row.cautions, 0);
    const trailingTdv = trailing.reduce((sum, row) => sum + row.tdvCents, 0);
    const trailingRevenue = trailing.reduce((sum, row) => sum + row.revenueCents, 0);
    const trailingPartnerCost = trailing.reduce((sum, row) => sum + row.partnerCostCents, 0);
    const trailingMau = trailing.map(row => row.mau).filter(value => value > 0);
    const recentFreq = trailing.length ? avg(trailing.map(row => row.cautionsPerMau || 0).filter(value => value > 0)) : 0;
    const avgTdvPerCautionCents = trailingCautions > 0 ? trailingTdv / trailingCautions : 0;
    const avgRevenuePerCautionCents = trailingCautions > 0 ? trailingRevenue / trailingCautions : 0;
    const partnerYield = trailingTdv > 0 ? trailingPartnerCost / trailingTdv : 0;
    const futureContributionPerCautionCents = avgRevenuePerCautionCents - avgTdvPerCautionCents * (insuranceRateBps / 10000 + partnerYield);

    const forecast = [1, 2, 3].map((offset, index) => {
      const month = shiftMonth(currentMonth, offset);
      const x = regressionWindow.length + index;
      const baseCautions = Math.round(clampNonNegative(regression.intercept + regression.slope * x));
      const lowCautions = Math.round(clampNonNegative(baseCautions - regression.rmse));
      const highCautions = Math.round(clampNonNegative(baseCautions + regression.rmse));
      const tdvCents = Math.round(baseCautions * avgTdvPerCautionCents);
      const revenueCents = Math.round(baseCautions * avgRevenuePerCautionCents);
      const contributionCents = Math.round(baseCautions * futureContributionPerCautionCents);
      const projectedMau = recentFreq > 0 ? Math.max(1, Math.round(baseCautions / recentFreq)) : null;
      return { month, baseCautions, lowCautions, highCautions, tdvCents, revenueCents, contributionCents, projectedMau };
    });

    const current = actual.find(row => row.month === currentMonth) || actual.at(-1)!;
    const today = new Date();
    const elapsedDays = Math.max(1, today.getUTCDate());
    const currentRunRateCautions = current
      ? Math.round(current.cautions / elapsedDays * daysInMonth(currentMonth))
      : 0;

    const monthlyContributionPerMauCents = recentFreq > 0 ? Math.round(recentFreq * futureContributionPerCautionCents) : 0;
    const plusOneMau = {
      extraCautionsPerMonth: recentFreq,
      extraRevenueCentsPerMonth: Math.round(recentFreq * avgRevenuePerCautionCents),
      extraContributionCentsPerMonth: monthlyContributionPerMauCents,
    };
    const currentMauForImpact = current?.mau || Math.round(avg(trailingMau));
    const plusOneCautionPerMau = {
      extraCautionsPerMonth: currentMauForImpact,
      extraRevenueCentsPerMonth: Math.round(currentMauForImpact * avgRevenuePerCautionCents),
      extraContributionCentsPerMonth: Math.round(currentMauForImpact * futureContributionPerCautionCents),
    };

    const recentMonths = [shiftMonth(currentMonth, -3), shiftMonth(currentMonth, -2), shiftMonth(currentMonth, -1)];
    const acquisitionCostCents = (acquisitionCostsResult.data || [])
      .filter(row => recentMonths.includes(`${row.year}-${String(row.month_number).padStart(2, "0")}`))
      .reduce((sum, row) => sum + Math.round(num(row.amount) * 100), 0);
    const acquiredRenters = (funnelResult.data || [])
      .filter(row => recentMonths.includes(`${row.year}-${String(row.month_number).padStart(2, "0")}`))
      .reduce((sum, row) => sum + Math.max(num(row.first_deposit_renters), num(row.renters_activated)), 0);
    const cacCents = acquiredRenters > 0 && acquisitionCostCents > 0 ? Math.round(acquisitionCostCents / acquiredRenters) : null;
    const paybackMonths = cacCents != null && monthlyContributionPerMauCents > 0
      ? cacCents / monthlyContributionPerMauCents
      : null;

    const blockers: string[] = [];
    if (cacCents == null) blockers.push("CAC par loueur actif non mesuré");
    if (pspRows.length === 0) blockers.push("coûts PSP réels non reliés");
    blockers.push("perte nette finale après recouvrement non reliée");

    const usageGap = Math.max(0, USAGE_REFERENCE - (current?.cautionsPerMau || 0));
    const priority = usageGap > 0
      ? {
          code: "usage",
          title: "Activation, réactivation et fréquence d’usage",
          rationale: `La fréquence est à ${(current?.cautionsPerMau || 0).toFixed(1)} caution(s) / MAU contre un repère de ${USAGE_REFERENCE.toFixed(1)}. Faire +1 caution par MAU vaut déjà environ ${(plusOneCautionPerMau.extraContributionCentsPerMonth / 100).toFixed(0)} € de contribution mesurée supplémentaire par mois.`,
        }
      : blockers.length
        ? {
            code: "economics",
            title: "Fiabiliser l’économie avant de scaler l’acquisition",
            rationale: `L’usage est au niveau du repère, mais le scale paid reste bloqué par : ${blockers.join(", ")}.`,
          }
        : {
            code: "acquisition",
            title: "Acquisition de nouveaux loueurs actifs",
            rationale: "L’usage et l’économie sont suffisamment mesurés pour comparer le CAC au rendement mensuel d’un MAU.",
          };

    return NextResponse.json({
      actual,
      forecast: {
        method: "linear_trend_last_6_completed_months",
        historyPoints: regressionWindow.length,
        r2: regression.r2,
        rmseCautions: regression.rmse,
        confidence: confidenceLabel(regressionWindow.length, regression.r2),
        next90Days: forecast,
        currentMonthRunRateCautions,
        trailing: {
          avgTdvPerCautionCents: Math.round(avgTdvPerCautionCents),
          avgRevenuePerCautionCents: Math.round(avgRevenuePerCautionCents),
          measuredContributionPerCautionCents: Math.round(futureContributionPerCautionCents),
          cautionsPerMau: recentFreq,
          partnerYield,
          insuranceRateBps,
        },
      },
      drivers: {
        usageReference: USAGE_REFERENCE,
        plusOneMau,
        plusOneCautionPerMau,
      },
      investment: {
        paidScaleReady: blockers.length === 0,
        blockers,
        cacCents,
        acquiredRentersLast3CompletedMonths: acquiredRenters,
        acquisitionCostCentsLast3CompletedMonths: acquisitionCostCents,
        measuredContributionPerMauCents: monthlyContributionPerMauCents,
        paybackMonths,
        priority,
      },
      caveats: [
        "La prévision est un run-rate de pilotage, pas une promesse commerciale.",
        "La contribution prévisionnelle reste avant PSP et perte nette finale tant que ces coûts ne sont pas reliés.",
        "Le mois en cours est partiel et n’entre pas dans la régression de tendance.",
      ],
    });
  } catch (error) {
    console.error("Decision intelligence failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de calculer la trajectoire KPI." },
      { status: 500 },
    );
  }
}
