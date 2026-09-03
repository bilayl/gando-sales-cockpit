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
  return parsed == null ? null : Math.max(0, Math.round(parsed));
}

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function toClient(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    year: Number(row.year),
    monthNumber: Number(row.month_number),
    targetLeads: nullableInteger(row.target_leads),
    targetMeetings: nullableInteger(row.target_meetings),
    targetClients: nullableInteger(row.target_clients),
    targetFirstDepositRenters: nullableInteger(row.target_first_deposit_renters),
    targetSignedRevenue: nullableNumber(row.target_signed_revenue),
    targetCashCollected: nullableNumber(row.target_cash_collected),
    maxTotalCost: nullableNumber(row.max_total_cost),
    maxCac: nullableNumber(row.max_cac),
    minCashRoi: nullableNumber(row.min_cash_roi),
    minSignedRoi: nullableNumber(row.min_signed_roi),
    notes: row.notes ? String(row.notes) : null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function listRows() {
  const { data, error } = await getSupabaseAdmin()
    .from("kpi_acquisition_monthly_targets")
    .select("*")
    .order("year", { ascending: false })
    .order("month_number", { ascending: false });
  if (error) throw error;
  return (data || []).map(row => toClient(row as Record<string, unknown>));
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    return NextResponse.json({ rows: await listRows(), canEdit: access.role !== "commercial" });
  } catch (error) {
    console.error("Acquisition targets listing failed", error);
    return NextResponse.json({ error: "Impossible de charger les objectifs d’acquisition." }, { status: 500 });
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
      target_leads: nullableInteger(body?.targetLeads),
      target_meetings: nullableInteger(body?.targetMeetings),
      target_clients: nullableInteger(body?.targetClients),
      target_first_deposit_renters: nullableInteger(body?.targetFirstDepositRenters),
      target_signed_revenue: nullableNumber(body?.targetSignedRevenue),
      target_cash_collected: nullableNumber(body?.targetCashCollected),
      max_total_cost: nullableNumber(body?.maxTotalCost),
      max_cac: nullableNumber(body?.maxCac),
      min_cash_roi: nullableNumber(body?.minCashRoi),
      min_signed_roi: nullableNumber(body?.minSignedRoi),
      notes: nullableString(body?.notes),
      updated_by: access.email || access.displayName || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await getSupabaseAdmin()
      .from("kpi_acquisition_monthly_targets")
      .upsert(payload, { onConflict: "year,month_number" });
    if (error) throw error;
    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("Acquisition targets update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer les objectifs." }, { status: 500 });
  }
}
