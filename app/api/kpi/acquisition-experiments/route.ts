import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableInteger(value: unknown) {
  const parsed = nullableNumber(value);
  return parsed == null ? null : Math.max(0, Math.round(parsed));
}

function validDate(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function toClient(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    startDate: String(row.start_date || ""),
    endDate: String(row.end_date || ""),
    source: row.source ? String(row.source) : null,
    acquisitionCost: Number(row.acquisition_cost || 0),
    prospectsContacted: nullableInteger(row.prospects_contacted),
    conversations: nullableInteger(row.conversations),
    qualifiedDeals: nullableInteger(row.qualified_deals),
    meetings: nullableInteger(row.meetings),
    rentersRegistered: nullableInteger(row.renters_registered),
    firstDepositRenters: nullableInteger(row.first_deposit_renters),
    mau30Renters: nullableInteger(row.mau_30_renters),
    margin30d: nullableNumber(row.margin_30d),
    notes: row.notes ? String(row.notes) : null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function listRows() {
  const { data, error } = await getSupabaseAdmin()
    .from("kpi_acquisition_experiments")
    .select("*")
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(row => toClient(row as Record<string, unknown>));
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    return NextResponse.json({ rows: await listRows(), canEdit: access.role !== "commercial" });
  } catch (error) {
    console.error("Acquisition experiment listing failed", error);
    return NextResponse.json({ error: "Impossible de charger les tests d’acquisition." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (access.role === "commercial") return NextResponse.json({ error: "Accès en lecture seule." }, { status: 403 });

    const body = await request.json();
    const id = nullableString(body?.id);
    const name = String(body?.name || "").trim();
    const startDate = validDate(body?.startDate);
    const endDate = validDate(body?.endDate);
    const acquisitionCost = Number(body?.acquisitionCost ?? 0);
    const firstDepositRenters = nullableInteger(body?.firstDepositRenters);
    const mau30Renters = nullableInteger(body?.mau30Renters);

    if (!name || !startDate || !endDate || endDate < startDate) {
      return NextResponse.json({ error: "Nom ou période du test invalide." }, { status: 400 });
    }
    if (!Number.isFinite(acquisitionCost) || acquisitionCost < 0) {
      return NextResponse.json({ error: "Coût d’acquisition invalide." }, { status: 400 });
    }
    if (mau30Renters != null && firstDepositRenters != null && mau30Renters > firstDepositRenters) {
      return NextResponse.json({ error: "Le MAU J+30 ne peut pas dépasser le nombre de loueurs activés." }, { status: 400 });
    }

    const payload = {
      name,
      start_date: startDate,
      end_date: endDate,
      source: nullableString(body?.source),
      acquisition_cost: acquisitionCost,
      prospects_contacted: nullableInteger(body?.prospectsContacted),
      conversations: nullableInteger(body?.conversations),
      qualified_deals: nullableInteger(body?.qualifiedDeals),
      meetings: nullableInteger(body?.meetings),
      renters_registered: nullableInteger(body?.rentersRegistered),
      first_deposit_renters: firstDepositRenters,
      mau_30_renters: mau30Renters,
      margin_30d: nullableNumber(body?.margin30d),
      notes: nullableString(body?.notes),
      updated_by: access.email || access.displayName || null,
      updated_at: new Date().toISOString(),
    };

    const admin = getSupabaseAdmin();
    const query = id
      ? admin.from("kpi_acquisition_experiments").update(payload).eq("id", id)
      : admin.from("kpi_acquisition_experiments").insert(payload);
    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("Acquisition experiment update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer le test." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (access.role === "commercial") return NextResponse.json({ error: "Accès en lecture seule." }, { status: 403 });

    const body = await request.json();
    const id = nullableString(body?.id);
    if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });

    const { error } = await getSupabaseAdmin().from("kpi_acquisition_experiments").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("Acquisition experiment delete failed", error);
    return NextResponse.json({ error: "Impossible de supprimer le test." }, { status: 500 });
  }
}
