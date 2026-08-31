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
    id: String(row.id || ""),
    year: Number(row.year),
    monthNumber: Number(row.month_number),
    source: String(row.source || ""),
    campaign: String(row.campaign || ""),
    spend: nullableNumber(row.spend),
    leads: nullableInteger(row.leads),
    meetings: nullableInteger(row.meetings),
    clients: nullableInteger(row.clients),
    signedRevenue: nullableNumber(row.signed_revenue),
    cashCollected: nullableNumber(row.cash_collected),
  };
}

async function listRows() {
  const { data, error } = await getSupabaseAdmin()
    .from("kpi_campaign_performance")
    .select("*")
    .order("year", { ascending: true })
    .order("month_number", { ascending: true })
    .order("source", { ascending: true });
  if (error) throw error;
  return (data || []).map(row => toClient(row as Record<string, unknown>));
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    return NextResponse.json({ rows: await listRows(), canEdit: access.role !== "commercial" });
  } catch (error) {
    console.error("Campaign KPI listing failed", error);
    return NextResponse.json({ error: "Impossible de charger l’attribution campagnes." }, { status: 500 });
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
    const source = String(body?.source || "").trim();
    const campaign = String(body?.campaign || "").trim();
    if (!Number.isFinite(year) || year < 2020 || year > 2100 || monthNumber < 1 || monthNumber > 12 || !source || !campaign) {
      return NextResponse.json({ error: "Source, campagne ou mois invalide." }, { status: 400 });
    }

    const payload = {
      year,
      month_number: monthNumber,
      source,
      campaign,
      spend: nullableNumber(body?.spend),
      leads: nullableInteger(body?.leads),
      meetings: nullableInteger(body?.meetings),
      clients: nullableInteger(body?.clients),
      signed_revenue: nullableNumber(body?.signedRevenue),
      cash_collected: nullableNumber(body?.cashCollected),
      updated_by: access.email || access.displayName || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await getSupabaseAdmin()
      .from("kpi_campaign_performance")
      .upsert(payload, { onConflict: "year,month_number,source,campaign" });
    if (error) throw error;
    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("Campaign KPI update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer la campagne." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (access.role === "commercial") return NextResponse.json({ error: "Accès en lecture seule." }, { status: 403 });
    const body = await request.json();
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("kpi_campaign_performance").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("Campaign KPI delete failed", error);
    return NextResponse.json({ error: "Impossible de supprimer la campagne." }, { status: 500 });
  }
}
