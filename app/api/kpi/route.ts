import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getGandoMonthlySourceMetrics } from "@/lib/gando-monthly-source";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableInteger(value: unknown) {
  const parsed = nullableNumber(value);
  return parsed == null ? null : Math.round(parsed);
}

function toClientRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    year: Number(row.year),
    monthNumber: Number(row.month_number),
    month: String(row.month_label || ""),
    revenue: nullableNumber(row.revenue),
    tdv: nullableNumber(row.tdv),
    deposits: nullableInteger(row.deposits_activated),
    activeRenters: nullableInteger(row.active_renters),
    newUsers: nullableInteger(row.new_users),
    registeredUsers: nullableInteger(row.registered_users),
    totalClients: nullableInteger(row.total_clients),
    cumulativeDepositVolume: nullableNumber(row.cumulative_deposit_volume),
    depositCashouts: nullableInteger(row.deposit_cashouts),
    cashoutAmount: nullableNumber(row.cashout_amount),
    advancedGuarantee: nullableNumber(row.advanced_guarantee_amount),
    churnedRenters: nullableInteger(row.churned_renters),
    churnRate: nullableNumber(row.churn_rate),
    growth: nullableNumber(row.growth_rate),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function monthKey(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

async function listRows() {
  const [manualResult, sourceMetrics] = await Promise.all([
    getSupabaseAdmin()
      .from("kpi_monthly_metrics")
      .select("*")
      .order("year", { ascending: true })
      .order("month_number", { ascending: true }),
    getGandoMonthlySourceMetrics(),
  ]);

  if (manualResult.error) throw manualResult.error;

  return (manualResult.data || []).map(rawRow => {
    const row = toClientRow(rawRow as Record<string, unknown>);
    const source = sourceMetrics.get(monthKey(row.year, row.monthNumber));
    if (!source) return row;

    const sourceFilledFields: string[] = [];
    const fillNumber = (field: string, manual: number | null, automatic: number | null) => {
      if (manual != null) return manual;
      if (automatic != null) sourceFilledFields.push(field);
      return automatic;
    };

    return {
      ...row,
      revenue: fillNumber("revenue", row.revenue, source.revenue),
      tdv: fillNumber("tdv", row.tdv, source.tdv),
      deposits: fillNumber("deposits", row.deposits, source.deposits),
      activeRenters: fillNumber("activeRenters", row.activeRenters, source.activeRenters),
      newUsers: fillNumber("newUsers", row.newUsers, source.newUsers),
      registeredUsers: fillNumber("registeredUsers", row.registeredUsers, source.registeredUsers),
      totalClients: fillNumber("totalClients", row.totalClients, source.totalClients),
      cumulativeDepositVolume: fillNumber(
        "cumulativeDepositVolume",
        row.cumulativeDepositVolume,
        source.cumulativeDepositVolume,
      ),
      depositCashouts: fillNumber("depositCashouts", row.depositCashouts, source.depositCashouts),
      cashoutAmount: fillNumber("cashoutAmount", row.cashoutAmount, source.cashoutAmount),
      advancedGuarantee: fillNumber("advancedGuarantee", row.advancedGuarantee, source.advancedGuarantee),
      churnedRenters: fillNumber("churnedRenters", row.churnedRenters, source.churnedRenters),
      sourceFilledFields,
      sourceBackfill: sourceFilledFields.length > 0 ? "Gando Supabase" : null,
    };
  });
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    return NextResponse.json({ rows: await listRows(), canEdit: access.role !== "commercial" });
  } catch (error) {
    console.error("KPI listing failed", error);
    return NextResponse.json({ error: "Impossible de charger les KPI." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (access.role === "commercial") {
      return NextResponse.json({ error: "Vous n’avez pas les droits pour modifier les KPI." }, { status: 403 });
    }

    const body = await request.json();
    const year = Math.round(Number(body?.year));
    const monthNumber = Math.round(Number(body?.monthNumber));
    if (!Number.isFinite(year) || year < 2020 || year > 2100 || monthNumber < 1 || monthNumber > 12) {
      return NextResponse.json({ error: "Mois invalide." }, { status: 400 });
    }

    const payload = {
      year,
      month_number: monthNumber,
      month_label: MONTH_LABELS[monthNumber - 1],
      revenue: nullableNumber(body?.revenue),
      tdv: nullableNumber(body?.tdv),
      deposits_activated: nullableInteger(body?.deposits),
      active_renters: nullableInteger(body?.activeRenters),
      new_users: nullableInteger(body?.newUsers),
      registered_users: nullableInteger(body?.registeredUsers),
      total_clients: nullableInteger(body?.totalClients),
      cumulative_deposit_volume: nullableNumber(body?.cumulativeDepositVolume),
      deposit_cashouts: nullableInteger(body?.depositCashouts),
      cashout_amount: nullableNumber(body?.cashoutAmount),
      advanced_guarantee_amount: nullableNumber(body?.advancedGuarantee),
      churned_renters: nullableInteger(body?.churnedRenters),
      churn_rate: nullableNumber(body?.churnRate),
      growth_rate: nullableNumber(body?.growth),
      updated_by: access.email || access.displayName || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await getSupabaseAdmin()
      .from("kpi_monthly_metrics")
      .upsert(payload, { onConflict: "year,month_number" });
    if (error) throw error;

    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("KPI update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer les KPI." }, { status: 500 });
  }
}
