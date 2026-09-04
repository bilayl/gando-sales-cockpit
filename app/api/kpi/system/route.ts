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
  const b = n(bottom);
  return b > 0 ? n(top) / b : null;
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
  return [...rows].filter(row => monthKey(row) < monthKey(current)).sort((a, b) => monthKey(b) - monthKey(a))[0] || null;
}

function delta(current: unknown, previous: unknown) {
  const prev = nullable(previous);
  const cur = nullable(current);
  if (prev == null || cur == null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
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
      : 0;

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

    const cacActivation = firstDepositRenters && firstDepositRenters > 0 ? acquisitionCost / firstDepositRenters : null;
    const cacMau30 = experimentCost != null && experimentMau30 && experimentMau30 > 0 ? experimentCost / experimentMau30 : null;
    const marginPerMau30 = experimentMargin30d != null && experimentMau30 && experimentMau30 > 0 ? experimentMargin30d / experimentMau30 : null;
    const paybackMonths = cacMau30 != null && marginPerMau30 != null && marginPerMau30 > 0 ? cacMau30 / marginPerMau30 : null;

    const riskLossAvailable = false;

    return NextResponse.json({
      period: core ? { year: n(core.year), monthNumber: n(core.month_number) } : null,
      northStar: {
        depositsActivated: deposits,
        depositsDelta: delta(core?.deposits_activated, previousCore?.deposits_activated),
        activeRenters,
        activeRentersDelta: delta(core?.active_renters, previousCore?.active_renters),
        depositsPerMau: activeRenters && activeRenters > 0 && deposits != null ? deposits / activeRenters : null,
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
        activationRate: ratio(firstDepositRenters, rentersRegistered),
        avgClosingDays: nullable(funnel?.avg_closing_days),
      },
      retention: {
        firstDepositRenters: experimentFirstDeposit,
        mau30Renters: experimentMau30,
        mau30Rate: ratio(experimentMau30, experimentFirstDeposit),
        cohortName: matureExperiment ? String(matureExperiment.name || "") : null,
      },
      economics: {
        revenue,
        netMargin,
        marginRate: ratio(netMargin, revenue),
        marginPerMau: activeRenters && activeRenters > 0 && netMargin != null ? netMargin / activeRenters : null,
        marginPerDeposit: deposits && deposits > 0 && netMargin != null ? netMargin / deposits : null,
        takeRate: ratio(revenue, tdv),
        cacPaybackMonths: paybackMonths,
      },
      risk: {
        claimsCount: nullable(core?.deposit_cashouts),
        claimRate: ratio(core?.deposit_cashouts, core?.deposits_activated),
        cashoutAmount: nullable(core?.cashout_amount),
        advancedGuarantee: nullable(core?.advanced_guarantee_amount),
        lossRate: null,
        lossRateAvailable: riskLossAvailable,
      },
      quality: {
        automatic: [
          "Cautions activées",
          "MAU loueurs",
          "Cautions / MAU",
          "TDV sécurisé",
          "CA / take rate",
          "Marge",
          "CAC activation",
          "Taux d’activation",
          "Taux de demandes d’encaissement",
        ],
        cohort: matureExperiment ? ["CAC MAU J+30", "Rétention J+30", "Payback cohorte"] : [],
        missing: [
          ...(matureExperiment ? [] : ["CAC MAU J+30", "Rétention J+30", "Payback cohorte"]),
          "Loss rate définitif",
          "Rétention J+60 / J+90",
          "Attribution automatique source → activation",
        ],
      },
    });
  } catch (error) {
    console.error("KPI system failed", error);
    return NextResponse.json({ error: "Impossible de calculer le système KPI." }, { status: 500 });
  }
}
