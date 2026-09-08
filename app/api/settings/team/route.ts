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

function teamError(error: unknown, fallback: string) {
  const status = Number((error as { status?: number })?.status) || 500;
  const raw = error instanceof Error ? error.message : fallback;
  const message = raw.includes("administrateur actif")
    ? "Au moins un administrateur actif doit rester dans l’équipe."
    : status === 403 ? "Seuls les administrateurs peuvent gérer l’équipe." : raw;
  return { status, message };
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    return NextResponse.json({
      members: await listMembers(),
      canManage: access.canManageTeam,
      currentRole: access.role,
      currentEmail: access.email || null,
    });
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
    const { status, message } = teamError(error, "Mise à jour impossible.");
    console.error("Team update failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireCockpitAdmin();
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) return NextResponse.json({ error: "Membre manquant." }, { status: 400 });
    if (access.email?.toLowerCase() === email) {
      return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte administrateur." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetError } = await supabase
      .from("cockpit_users")
      .select("email,role,active")
      .eq("email", email)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });

    if (role(target.role) === "admin" && target.active) {
      const { count, error: countError } = await supabase
        .from("cockpit_users")
        .select("email", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("active", true);
      if (countError) throw countError;
      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "Au moins un administrateur actif doit rester dans l’équipe." }, { status: 409 });
      }
    }

    const { error: deleteError } = await supabase.from("cockpit_users").delete().eq("email", email);
    if (deleteError) throw deleteError;

    const [assignmentCleanup, taskCleanup] = await Promise.all([
      supabase.from("cockpit_company_assignments").delete().ilike("assignee_cockpit_email", email),
      supabase.from("tasks").update({ assignee_cockpit_email: null }).ilike("assignee_cockpit_email", email),
    ]);
    if (assignmentCleanup.error) console.error("Team assignment cleanup failed", assignmentCleanup.error);
    if (taskCleanup.error) console.error("Team task cleanup failed", taskCleanup.error);

    return NextResponse.json({ members: await listMembers() });
  } catch (error) {
    const { status, message } = teamError(error, "Suppression impossible.");
    console.error("Team delete failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
