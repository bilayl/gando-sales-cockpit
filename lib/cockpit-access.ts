import "server-only";

import { getCockpitSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CockpitRole = "admin" | "member" | "commercial";

export type CockpitAccess = {
  email?: string;
  displayName?: string;
  role: CockpitRole;
  canAccessDealRoom: boolean;
  canManageTeam: boolean;
};

function normalizeRole(value: unknown): CockpitRole {
  return value === "admin" || value === "commercial" ? value : "member";
}

export function cockpitRoleLabel(role: CockpitRole) {
  return role === "admin" ? "Administrateur" : role === "commercial" ? "Commercial" : "Membre";
}

export async function getCockpitAccess(): Promise<CockpitAccess | null> {
  const session = await getCockpitSession();
  if (!session) return null;

  const email = session.email?.trim().toLowerCase() || undefined;
  let role: CockpitRole = "member";
  let displayName = session.displayName;

  if (email) {
    const { data, error } = await getSupabaseAdmin()
      .from("cockpit_users")
      .select("email,display_name,role,active")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      if (!data.active) return null;
      role = normalizeRole(data.role);
      displayName = data.display_name || displayName;
    }
  }

  return {
    email,
    displayName,
    role,
    canAccessDealRoom: role !== "commercial",
    canManageTeam: role === "admin",
  };
}

export async function requireCockpitAdmin() {
  const access = await getCockpitAccess();
  if (!access) {
    throw Object.assign(new Error("Reconnectez-vous au Sales Cockpit pour continuer."), { status: 401 });
  }
  if (!access.canManageTeam) {
    throw Object.assign(new Error("Seuls les administrateurs peuvent gérer l’équipe."), { status: 403 });
  }
  return access;
}
