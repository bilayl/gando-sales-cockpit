import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAdmin } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { apiError } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

// Only administrators can inspect available SDRs or manually allocate companies.
export async function GET() {
  try {
    await requireCockpitAdmin();
    const { data, error } = await getSupabaseAdmin()
      .from("cockpit_users")
      .select("email,display_name,role")
      .eq("active", true)
      .order("display_name", { ascending: true });
    if (error) throw error;
    const members = (data || [])
      .filter(member => member.role === "commercial" || member.role === "admin")
      .map(member => ({
        email: normalizeEmail(member.email),
        name: String(member.display_name || member.email || "").trim(),
        role: member.role,
      }));
    return NextResponse.json({ members }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireCockpitAdmin();
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.assigneeEmail);
    const input = Array.isArray(body.companyIds) ? body.companyIds : [];
    const companyIds: string[] = [...new Set<string>(input.map((value: unknown) => String(value || "").trim()).filter((id: string) => id.length > 0))];

    if (!email || !companyIds.length || companyIds.length > 100 || input.length > 100) {
      return NextResponse.json({ error: "Choisissez un SDR et entre 1 et 100 entreprises." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: member, error: memberError } = await supabase
      .from("cockpit_users")
      .select("email,role,active")
      .eq("email", email)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member?.active || !["admin", "commercial"].includes(member.role)) {
      return NextResponse.json({ error: "Ce commercial est introuvable ou inactif." }, { status: 400 });
    }

    // Never create phantom assignments for records that do not exist in the CRM.
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("hubspot_id,qualification_status")
      .in("hubspot_id", companyIds);
    if (companiesError) throw companiesError;
    const excluded = new Set(["Gagné", "Perdu", "Pas intéressé", "Démo prévue", "Opportunité"]);
    const validIds = new Set((companies || [])
      .filter(company => !excluded.has(String(company.qualification_status || "")))
      .map(company => String(company.hubspot_id)));

    const now = new Date().toISOString();
    const rows = companyIds
      .filter(companyId => validIds.has(companyId))
      .map(companyId => ({
        company_id: companyId,
        assignee_cockpit_email: email,
        assigned_by_email: admin.email,
        assigned_at: now,
        updated_at: now,
      }));
    if (!rows.length) {
      return NextResponse.json({ error: "Aucune entreprise éligible parmi la sélection." }, { status: 400 });
    }

    // Atomic insert-if-unassigned: this deliberately NEVER steals another SDR's accounts.
    const { data: inserted, error: insertError } = await supabase
      .from("cockpit_company_assignments")
      .upsert(rows, { onConflict: "company_id", ignoreDuplicates: true })
      .select("company_id");
    if (insertError) throw insertError;

    const assignedCount = (inserted || []).length;
    return NextResponse.json({
      assignedCount,
      skippedAssignedCount: rows.length - assignedCount,
      skippedIneligibleCount: companyIds.length - rows.length,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
