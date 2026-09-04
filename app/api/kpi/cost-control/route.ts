import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const FAMILIES = new Set(["acquisition", "transaction", "risk", "partners", "structure"]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function validPeriod(yearValue: unknown, monthValue: unknown) {
  const year = Math.round(Number(yearValue));
  const monthNumber = Math.round(Number(monthValue));
  if (!Number.isFinite(year) || year < 2020 || year > 2100 || monthNumber < 1 || monthNumber > 12) return null;
  return { year, monthNumber };
}

function entryToClient(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    year: Number(row.year),
    monthNumber: Number(row.month_number),
    incurredOn: row.incurred_on ? String(row.incurred_on) : null,
    family: String(row.family || "structure"),
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

function budgetToClient(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    year: Number(row.year),
    monthNumber: Number(row.month_number),
    family: String(row.family || "structure"),
    budgetAmount: Number(row.budget_amount || 0),
    notes: row.notes ? String(row.notes) : null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function coreToClient(row: Record<string, unknown>) {
  return {
    year: Number(row.year),
    monthNumber: Number(row.month_number),
    revenue: row.revenue == null ? null : Number(row.revenue),
    tdv: row.tdv == null ? null : Number(row.tdv),
    deposits: row.deposits_activated == null ? null : Number(row.deposits_activated),
    activeRenters: row.active_renters == null ? null : Number(row.active_renters),
  };
}

async function payload() {
  const admin = getSupabaseAdmin();
  const [entriesResult, budgetsResult, coreResult] = await Promise.all([
    admin.from("kpi_cost_entries").select("*").order("year", { ascending: false }).order("month_number", { ascending: false }).order("incurred_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    admin.from("kpi_cost_monthly_budgets").select("*").order("year", { ascending: false }).order("month_number", { ascending: false }).order("family", { ascending: true }),
    admin.from("kpi_monthly_metrics").select("year,month_number,revenue,tdv,deposits_activated,active_renters").order("year", { ascending: false }).order("month_number", { ascending: false }),
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (budgetsResult.error) throw budgetsResult.error;
  if (coreResult.error) throw coreResult.error;
  return {
    entries: (entriesResult.data || []).map(row => entryToClient(row as Record<string, unknown>)),
    budgets: (budgetsResult.data || []).map(row => budgetToClient(row as Record<string, unknown>)),
    coreRows: (coreResult.data || []).map(row => coreToClient(row as Record<string, unknown>)),
  };
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    return NextResponse.json({ ...(await payload()), canEdit: access.role !== "commercial" });
  } catch (error) {
    console.error("Cost control listing failed", error);
    return NextResponse.json({ error: "Impossible de charger le contrôle des coûts." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (access.role === "commercial") return NextResponse.json({ error: "Accès en lecture seule." }, { status: 403 });

    const body = await request.json();
    const kind = text(body?.kind);
    const period = validPeriod(body?.year, body?.monthNumber);
    const family = text(body?.family);
    if (!period || !FAMILIES.has(family)) return NextResponse.json({ error: "Période ou famille invalide." }, { status: 400 });

    const admin = getSupabaseAdmin();
    const updatedBy = access.email || access.displayName || null;

    if (kind === "budget") {
      const budgetAmount = Number(body?.budgetAmount);
      if (!Number.isFinite(budgetAmount) || budgetAmount < 0) return NextResponse.json({ error: "Budget invalide." }, { status: 400 });
      const { error } = await admin.from("kpi_cost_monthly_budgets").upsert({
        year: period.year,
        month_number: period.monthNumber,
        family,
        budget_amount: budgetAmount,
        notes: nullableText(body?.notes),
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      }, { onConflict: "year,month_number,family" });
      if (error) throw error;
      return NextResponse.json(await payload());
    }

    if (kind === "entry") {
      const id = nullableText(body?.id);
      const category = text(body?.category);
      const label = text(body?.label);
      const amount = Number(body?.amount);
      if (!category || !label || !Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ error: "Catégorie, libellé ou montant invalide." }, { status: 400 });
      }
      const data = {
        year: period.year,
        month_number: period.monthNumber,
        incurred_on: nullableText(body?.incurredOn),
        family,
        category,
        label,
        amount,
        source: nullableText(body?.source),
        campaign: nullableText(body?.campaign),
        notes: nullableText(body?.notes),
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      };
      const query = id ? admin.from("kpi_cost_entries").update(data).eq("id", id) : admin.from("kpi_cost_entries").insert(data);
      const { error } = await query;
      if (error) throw error;
      return NextResponse.json(await payload());
    }

    return NextResponse.json({ error: "Type d’opération invalide." }, { status: 400 });
  } catch (error) {
    console.error("Cost control update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer les coûts." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (access.role === "commercial") return NextResponse.json({ error: "Accès en lecture seule." }, { status: 403 });
    const body = await request.json();
    const id = nullableText(body?.id);
    if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("kpi_cost_entries").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json(await payload());
  } catch (error) {
    console.error("Cost control delete failed", error);
    return NextResponse.json({ error: "Impossible de supprimer la dépense." }, { status: 500 });
  }
}
