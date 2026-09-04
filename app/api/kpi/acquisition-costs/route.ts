import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["ads", "sales", "tooling", "agency", "creative", "other"]);

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function toClient(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    year: Number(row.year),
    monthNumber: Number(row.month_number),
    incurredOn: row.incurred_on ? String(row.incurred_on) : null,
    category: String(row.category || "other"),
    label: String(row.label || ""),
    amount: Number(row.amount || 0),
    source: row.source ? String(row.source) : null,
    campaign: row.campaign ? String(row.campaign) : null,
    notes: row.notes ? String(row.notes) : null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function listRows() {
  const { data, error } = await getSupabaseAdmin()
    .from("kpi_cost_entries")
    .select("*")
    .eq("family", "acquisition")
    .order("year", { ascending: false })
    .order("month_number", { ascending: false })
    .order("incurred_on", { ascending: false, nullsFirst: false })
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
    console.error("Acquisition cost listing failed", error);
    return NextResponse.json({ error: "Impossible de charger les coûts d’acquisition." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (access.role === "commercial") return NextResponse.json({ error: "Accès en lecture seule." }, { status: 403 });

    const body = await request.json();
    const id = nullableString(body?.id);
    const year = Math.round(Number(body?.year));
    const monthNumber = Math.round(Number(body?.monthNumber));
    const category = String(body?.category || "").trim();
    const label = String(body?.label || "").trim();
    const amount = Number(body?.amount);

    if (!Number.isFinite(year) || year < 2020 || year > 2100 || monthNumber < 1 || monthNumber > 12) {
      return NextResponse.json({ error: "Mois invalide." }, { status: 400 });
    }
    if (!CATEGORIES.has(category) || !label || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Catégorie, libellé ou montant invalide." }, { status: 400 });
    }

    const payload = {
      year,
      month_number: monthNumber,
      incurred_on: nullableString(body?.incurredOn),
      family: "acquisition",
      category,
      label,
      amount,
      source: nullableString(body?.source),
      campaign: nullableString(body?.campaign),
      notes: nullableString(body?.notes),
      updated_by: access.email || access.displayName || null,
      updated_at: new Date().toISOString(),
    };

    const admin = getSupabaseAdmin();
    const query = id
      ? admin.from("kpi_cost_entries").update(payload).eq("id", id).eq("family", "acquisition")
      : admin.from("kpi_cost_entries").insert(payload);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("Acquisition cost update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer le coût." }, { status: 500 });
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
    const { error } = await getSupabaseAdmin().from("kpi_cost_entries").delete().eq("id", id).eq("family", "acquisition");
    if (error) throw error;
    return NextResponse.json({ rows: await listRows() });
  } catch (error) {
    console.error("Acquisition cost delete failed", error);
    return NextResponse.json({ error: "Impossible de supprimer le coût." }, { status: 500 });
  }
}
