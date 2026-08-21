import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess, requireCockpitAdmin, type CockpitRole } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function role(value: unknown): CockpitRole {
  if (value === "admin" || value === "commercial") return value;
  return "member";
}

async function listMembers() {
  const { data, error } = await getSupabaseAdmin()
    .from("cockpit_users")
    .select("email,display_name,role,active,created_at,updated_at")
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true });
  if (error) throw error;
  return (data || []).map(member => ({ ...member, role: role(member.role) }));
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    return NextResponse.json({ members: await listMembers(), canManage: access.canManageTeam, currentRole: access.role });
  } catch (error) {
    console.error("Team listing failed", error);
    return NextResponse.json({ error: "Impossible de charger l’équipe." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAdmin();
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const displayName = String(body?.displayName || "").trim().slice(0, 160);
    const memberRole = role(body?.role);
    const password = String(body?.password || "");
    const active = body?.active !== false;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }
    if (password && password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin().rpc("upsert_cockpit_team_member", {
      p_email: email,
      p_display_name: displayName,
      p_role: memberRole,
      p_password: password || null,
      p_active: active,
    });
    if (error) throw error;

    return NextResponse.json({ members: await listMembers() });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 500;
    const raw = error instanceof Error ? error.message : "Mise à jour impossible.";
    const message = raw.includes("administrateur actif")
      ? "Au moins un administrateur actif doit rester dans l’équipe."
      : status === 403 ? "Seuls les administrateurs peuvent gérer l’équipe." : raw;
    console.error("Team update failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
