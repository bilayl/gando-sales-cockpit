import "server-only";

import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CockpitTaskAssignee = {
  email: string;
  displayName: string;
  role: string;
  hubspotOwnerId: string | null;
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function hubSpotOwnersByEmail() {
  const byEmail = new Map<string, string>();
  let after = "";

  for (let page = 0; page < 5; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (after) params.set("after", after);
    const data = await hubspotJson(`/crm/owners/2026-03?${params.toString()}`);
    for (const owner of data.results || []) {
      const email = normalizeEmail(owner.email);
      if (email && owner.id) byEmail.set(email, String(owner.id));
    }
    after = String(data.paging?.next?.after || "");
    if (!after) break;
  }

  return byEmail;
}

export async function listActiveCockpitTaskAssignees(): Promise<CockpitTaskAssignee[]> {
  const supabase = getSupabaseAdmin();
  const [{ data: members, error }, ownerMap] = await Promise.all([
    supabase
      .from("cockpit_users")
      .select("email,display_name,role,active")
      .eq("active", true)
      .order("display_name", { ascending: true, nullsFirst: false })
      .order("email", { ascending: true }),
    hubSpotOwnersByEmail().catch(error => {
      console.error("Unable to map HubSpot owners to Cockpit users", error);
      return new Map<string, string>();
    }),
  ]);

  if (error) throw error;

  return (members || []).map(member => {
    const email = normalizeEmail(member.email);
    return {
      email,
      displayName: String(member.display_name || email),
      role: String(member.role || "member"),
      hubspotOwnerId: ownerMap.get(email) || null,
    };
  });
}

export async function resolveCockpitTaskAssignee(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const assignees = await listActiveCockpitTaskAssignees();
  const assignee = assignees.find(item => item.email === normalized);
  if (!assignee) {
    throw Object.assign(new Error("Cet utilisateur Sales Cockpit est introuvable ou inactif."), { status: 400 });
  }
  return assignee;
}

export async function saveCockpitTaskAssignee(taskHubSpotId: string, email: string | null) {
  const normalized = normalizeEmail(email) || null;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("tasks").upsert({
    hubspot_id: String(taskHubSpotId),
    assignee_cockpit_email: normalized,
    updated_at: new Date().toISOString(),
  }, { onConflict: "hubspot_id" });
  if (error) throw error;
}

export async function enrichTasksWithCockpitAssignees(tasks: any[], assignees?: CockpitTaskAssignee[]) {
  if (!tasks.length) return tasks;
  const available = assignees || await listActiveCockpitTaskAssignees();
  const ids = tasks.map(task => String(task.id));
  const { data, error } = await getSupabaseAdmin()
    .from("tasks")
    .select("hubspot_id,assignee_cockpit_email")
    .in("hubspot_id", ids);
  if (error) throw error;

  const localByTask = new Map((data || []).map(row => [String(row.hubspot_id), normalizeEmail(row.assignee_cockpit_email)]));
  const byEmail = new Map(available.map(item => [item.email, item]));
  const byOwner = new Map(available.filter(item => item.hubspotOwnerId).map(item => [String(item.hubspotOwnerId), item]));

  return tasks.map(task => {
    const localEmail = localByTask.get(String(task.id)) || "";
    const ownerId = String(task.properties?.hubspot_owner_id || "");
    const cockpitAssignee = (localEmail && byEmail.get(localEmail)) || (ownerId && byOwner.get(ownerId)) || null;
    return { ...task, cockpitAssignee };
  });
}
