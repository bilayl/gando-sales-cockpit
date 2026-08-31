import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableInteger(value: unknown) {
  const parsed = nullableNumber(value);
  return parsed == null ? null : Math.round(parsed);
}

function toClient(row: Record<string, unknown>) {
  return {
    id: row.id,
    year: Number(row.year),
    monthNumber: Number(row.month_number),
    prospectsContacted: nullableInteger(row.prospects_contacted),
    callsMade: nullableInteger(row.calls_made),
    meetings: nullableInteger(row.meetings),
    rentersRegistered: nullableInteger(row.renters_registered),
    rentersActivated: nullableInteger(row.renters_activated),
    firstDepositRenters: nullableInteger(row.first_deposit_renters),
    paidSpend: nullableNumber(row.paid_spend),
    salesCost: nullableNumber(row.sales_cost),
    toolingCost: nullableNumber(row.tooling_cost),
    agencyCost: nullableNumber(row.agency_cost),
    creativeCost: nullableNumber(row.creative_cost),
    otherAcquisitionCost: nullableNumber(row.other_acquisition_cost),
    paidLeads: nullableInteger(row.paid_leads),
    organicLeads: nullableInteger(row.organic_leads),
    signedRevenue: nullableNumber(row.signed_revenue),
    cashCollected: nullableNumber(row.cash_collected),
    mrr: nullableNumber(row.mrr),
    refunds: nullableNumber(row.refunds),
    netMargin: nullableNumber(row.net_margin),
    avgClosingDays: nullableNumber(row.avg_closing_days),
    medianClosingDays: nullableNumber(row.median_closing_days),
    avgDealAgeDays: nullableNumber(row.avg_deal_age_days),
    oldestOpenDealDays: nullableNumber(row.oldest_open_deal_days),
    openDealsCount: nullableInteger(row.open_deals_count),
    dealsOver40Days: nullableInteger(row.deals_over_40_days),
    decisionsTaken: nullableInteger(row.decisions_taken),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function listRows() {
  const { data, error } = await getSupabaseAdmin()
    .from("kpi_value_funnel_monthly")
    .select("*")
    .order("year", { ascending: true })
    .order("month_number", { ascending: true });
  if (error) throw error;
  return (data || []).map(row => toClient(row as Record<string, unknown>));
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    return NextResponse.json({ rows: await listRows(), canEdit: access.role !== "commercial" });
  } catch (error) {
    console.error("Value KPI listing failed", error);
    return NextResponse.json({ error: "Impossible de charger le funnel KPI." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (access.role === "commercial") return NextResponse.json({ error: "Accès en lecture seule." }, { status: 403 });

    const body = await request.json();
    const year = Math.round(Number(body?.year));
    const monthNumber = Math.round(Number(body?.monthNumber));
    if (!Number.isFinite(year) || year < 2020 || year > 2100 || monthNumber < 1 || monthNumber > 12) {
      return NextResponse.json({ error: "Mois invalide." }, { status: 400 });
    }

    const payload = {
      year,
      month_number: monthNumber,
      prospects_contacted: nullableInteger(body?.prospectsContacted),
      calls_made: nullableInteger(body?.callsMade),
      meetings: nullableInteger(body?.meetings),
      renters_registered: nullableInteger(body?.rentersRegistered),
      renters_activated: nullableInteger(body?.rentersActivated),
      first_deposit_renters: nullableInteger(body?.firstDepositRenters),
      paid_spend: nullableNumber(body?.paidSpend),
      sales_cost: nullableNumber(body?.salesCost),
      tooling_cost: nullableNumber(body?.toolingCost),
      agency_cost: nullableNumber(body?.agencyCost),
      creative_cost: nullableNumber(body?.creativeCost),
      other_acquisition_cost: nullableNumber(body?.otherAcquisitionCost),
      paid_leads: nullableInteger(body?.paidLeads),
      organic_leads: nullableInteger(body?.organicLeads),
      signed_revenue: nullableNumber(body?.signedRevenue),
      cash_collected: nullableNumber(body?.cashCollected),
      mrr: nullableNumber(body?.mrr),
      refunds: nullableNumber(body?.refunds),
      net_margin: nullableNumber(body?.netMargin),
      avg_closing_days: nullableNumber(body?.avgClosingDays),
      median_closing_days: nullableNumber(body?.medianClosingDays),
      avg_deal_age_days: nullableNumber(body?.avgDealAgeDays),
      oldest_open_deal_days: nullableNumber(body?.oldestOpenDealDays),
      open_deals_count: nullableInteger(body?.openDealsCount),
      deals_over_40_days: nullableInteger(body?.dealsOver40Days),
      decisions_taken: nullableInteger(body?.decisionsTaken),
      updated_by: access.email || access.displayName || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await getSupabaseAdmin()
      .from("kpi_value_funnel_monthly")
      .upsert(payload, { onConflict: "year,month_number" });
    if (error) throw error;

    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("Value KPI update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer le funnel KPI." }, { status: 500 });
  }
}
