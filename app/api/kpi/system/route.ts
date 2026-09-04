import { NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function nullable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function ratio(top: unknown, bottom: unknown) {
  const t = nullable(top);
  const b = nullable(bottom);
  return t != null && b != null && b > 0 ? t / b : null;
}
function monthKey(row: Row) {
  return n(row.year) * 12 + n(row.month_number);
}
function latestPopulated(rows: Row[], fields: string[]) {
  return [...rows]
    .filter(row => fields.some(field => row[field] !== null && row[field] !== undefined))
    .sort((a, b) => monthKey(b) - monthKey(a))[0] || null;
}
function previousRow(rows: Row[], current: Row | null) {
  if (!current) return null;
  return [...rows]
    .filter(row => monthKey(row) < monthKey(current) && ["deposits_activated", "active_renters"].some(field => row[field] != null))
    .sort((a, b) => monthKey(b) - monthKey(a))[0] || null;
}
function delta(current: unknown, previous: unknown) {
  const prev = nullable(previous);
  const cur = nullable(current);
  return prev != null && cur != null && prev !== 0 ? (cur - prev) / Math.abs(prev) : null;
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const admin = getSupabaseAdmin();
    const [coreResult, funnelResult, experimentResult] = await Promise.all([
      admin.from("kpi_monthly_metrics").select("*").order("year", { ascending: true }).order("month_number", { ascending: true }),
      admin.from("kpi_value_funnel_monthly").select("*").order("year", { ascending: true }).order("month_number", { ascending: true }),
      admin.from("kpi_acquisition_experiments").select("*").order("start_date", { ascending: false }),
    ]);
    if (coreResult.error) throw coreResult.error;
    if (funnelResult.error) throw funnelResult.error;
    if (experimentResult.error) throw experimentResult.error;

    const coreRows = (coreResult.data || []) as Row[];
    const funnelRows = (funnelResult.data || []) as Row[];
    const experiments = (experimentResult.data || []) as Row[];

    const core = latestPopulated(coreRows, ["deposits_activated", "active_renters", "revenue", "tdv"]);
    const previousCore = previousRow(coreRows, core);
    const funnel = latestPopulated(funnelRows, ["prospects_contacted", "renters_registered", "first_deposit_renters", "net_margin"]);
    const matureExperiment = experiments.find(row => row.first_deposit_renters != null && row.mau_30_renters != null) || null;

    const acquisitionCost = funnel
      ? n(funnel.paid_spend) + n(funnel.sales_cost) + n(funnel.tooling_cost) + n(funnel.agency_cost) + n(funnel.creative_cost) + n(funnel.other_acquisition_cost)
      : null;

    const deposits = nullable(core?.deposits_activated);
    const activeRenters = nullable(core?.active_renters);
    const revenue = nullable(core?.revenue);
    const tdv = nullable(core?.tdv);
    const netMargin = nullable(funnel?.net_margin);
    const firstDepositRenters = nullable(funnel?.first_deposit_renters);
    const rentersRegistered = nullable(funnel?.renters_registered);

    const experimentCost = nullable(matureExperiment?.acquisition_cost);
    const experimentFirstDeposit = nullable(matureExperiment?.first_deposit_renters);
    const experimentMau30 = nullable(matureExperiment?.mau_30_renters);
    const experimentMargin30d = nullable(matureExperiment?.margin_30d);

    const depositsPerMau = activeRenters != null && activeRenters > 0 && deposits != null ? deposits / activeRenters : null;
    const cacActivation = acquisitionCost != null && firstDepositRenters != null && firstDepositRenters > 0 ? acquisitionCost / firstDepositRenters : null;
    const activationRate = ratio(firstDepositRenters, rentersRegistered);
    const mau30Rate = ratio(experimentMau30, experimentFirstDeposit);
    const cacMau30 = experimentCost != null && experimentMau30 != null && experimentMau30 > 0 ? experimentCost / experimentMau30 : null;
    const marginPerMau30 = experimentMargin30d != null && experimentMau30 != null && experimentMau30 > 0 ? experimentMargin30d / experimentMau30 : null;
    const paybackMonths = cacMau30 != null && marginPerMau30 != null && marginPerMau30 > 0 ? cacMau30 / marginPerMau30 : null;
    const takeRate = ratio(revenue, tdv);
    const marginPerMau = activeRenters != null && activeRenters > 0 && netMargin != null ? netMargin / activeRenters : null;
    const marginPerDeposit = deposits != null && deposits > 0 && netMargin != null ? netMargin / deposits : null;
    const claimRate = ratio(core?.deposit_cashouts, core?.deposits_activated);

    const automatic: string[] = [];
    const cohort: string[] = [];
    const missing: string[] = [];
    const register = (label: string, value: unknown, bucket = automatic) => (value == null ? missing : bucket).push(label);

    register("Cautions activées", deposits);
    register("MAU loueurs", activeRenters);
    register("Cautions / MAU", depositsPerMau);
    register("TDV sécurisé", tdv);
    register("CA / take rate", takeRate);
    register("Marge", netMargin);
    register("CAC activation", cacActivation);
    register("Taux d’activation", activationRate);
    register("Taux de demandes d’encaissement", claimRate);
    register("CAC MAU J+30", cacMau30, cohort);
    register("Rétention J+30", mau30Rate, cohort);
    register("Payback cohorte", paybackMonths, cohort);
    missing.push("Loss rate définitif", "Rétention J+60 / J+90", "Attribution automatique source → activation");

    return NextResponse.json({
      period: core ? { year: n(core.year), monthNumber: n(core.month_number) } : null,
      northStar: {
        depositsActivated: deposits,
        depositsDelta: delta(core?.deposits_activated, previousCore?.deposits_activated),
        activeRenters,
        activeRentersDelta: delta(core?.active_renters, previousCore?.active_renters),
        depositsPerMau,
        tdv,
      },
      acquisition: {
        acquisitionCost,
        prospectsContacted: nullable(funnel?.prospects_contacted),
        meetings: nullable(funnel?.meetings),
        firstDepositRenters,
        cacActivation,
        cacMau30,
        cohortName: matureExperiment ? String(matureExperiment.name || "") : null,
      },
      activation: {
        rentersRegistered,
        firstDepositRenters,
        activationRate,
        avgClosingDays: nullable(funnel?.avg_closing_days),
      },
      retention: {
        firstDepositRenters: experimentFirstDeposit,
        mau30Renters: experimentMau30,
        mau30Rate,
        cohortName: matureExperiment ? String(matureExperiment.name || "") : null,
      },
      economics: {
        revenue,
        netMargin,
        marginRate: ratio(netMargin, revenue),
        marginPerMau,
        marginPerDeposit,
        takeRate,
        cacPaybackMonths: paybackMonths,
      },
      risk: {
        claimsCount: nullable(core?.deposit_cashouts),
        claimRate,
        cashoutAmount: nullable(core?.cashout_amount),
        advancedGuarantee: nullable(core?.advanced_guarantee_amount),
        lossRate: null,
        lossRateAvailable: false,
      },
      quality: { automatic, cohort, missing },
    });
  } catch (error) {
    console.error("KPI system failed", error);
    return NextResponse.json({ error: "Impossible de calculer le système KPI." }, { status: 500 });
  }
}
