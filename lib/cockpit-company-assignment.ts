import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function listCockpitCompanyAssignments(companyIds?: string[]) {
  let query = getSupabaseAdmin()
    .from("cockpit_company_assignments")
    .select("company_id,assignee_cockpit_email,assigned_by_email,assigned_at,updated_at");
  if (companyIds?.length) query = query.in("company_id", [...new Set(companyIds)]);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function claimCockpitCompanies(companyIds: string[], email: string) {
  const assigneeEmail = normalizeEmail(email);
  const distinctIds = [...new Set(companyIds.filter(Boolean))];
  if (!assigneeEmail || !distinctIds.length) return [];

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("cockpit_company_assignments")
    .upsert(distinctIds.map(companyId => ({
      company_id: companyId,
      assignee_cockpit_email: assigneeEmail,
      assigned_by_email: assigneeEmail,
      assigned_at: now,
      updated_at: now,
    })), { onConflict: "company_id", ignoreDuplicates: true });
  if (error) throw error;

  const assignments = await listCockpitCompanyAssignments(distinctIds);
  return assignments
    .filter(row => normalizeEmail(row.assignee_cockpit_email) === assigneeEmail)
    .map(row => String(row.company_id));
}

