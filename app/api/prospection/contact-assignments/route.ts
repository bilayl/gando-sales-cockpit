import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess, requireCockpitAdmin } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { apiError } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function GET() {
  try {
    const access = await requireCockpitAccess();
    const db = getSupabaseAdmin();
    const { data: assignments, error } = await db
      .from("cockpit_contact_assignments")
      .select("contact_id,assignee_cockpit_email,assigned_at");
    if (error) throw error;

    if (!access.canManageTeam) {
      return NextResponse.json({
        assignments: (assignments || []).filter(row => cleanEmail(row.assignee_cockpit_email) === cleanEmail(access.email)),
        members: [],
        canManageTeam: false,
        currentUserEmail: cleanEmail(access.email),
      }, { headers: { "cache-control": "no-store" } });
    }

    const { data: users, error: usersError } = await db
      .from("cockpit_users")
      .select("email,display_name,role")
      .eq("active", true)
      .order("display_name", { ascending: true });
    if (usersError) throw usersError;
    return NextResponse.json({
      assignments: assignments || [],
      members: (users || [])
        .filter(user => user.role === "commercial" || user.role === "admin")
        .map(user => ({ email: cleanEmail(user.email), name: String(user.display_name || user.email), role: user.role })),
      canManageTeam: true,
      currentUserEmail: cleanEmail(access.email),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAdmin();
    const body = await request.json().catch(() => ({}));
    const contactId = String(body.contactId || "").trim();
    const assigneeEmail = cleanEmail(body.assigneeEmail);
    if (!/^\d{1,25}$/.test(contactId)) {
      return NextResponse.json({ error: "Identifiant de contact invalide." }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data: contact, error: contactError } = await db.from("contacts")
      .select("hubspot_id").eq("hubspot_id", contactId).maybeSingle();
    if (contactError) throw contactError;
    if (!contact) return NextResponse.json({ error: "Contact introuvable. Synchronisez HubSpot." }, { status: 404 });

    if (!assigneeEmail) {
      const { error } = await db.from("cockpit_contact_assignments").delete().eq("contact_id", contactId);
      if (error) throw error;
      return NextResponse.json({ contactId, assigneeEmail: null }, { headers: { "cache-control": "no-store" } });
    }

    const { data: user, error: userError } = await db.from("cockpit_users")
      .select("email,role,active").eq("email", assigneeEmail).maybeSingle();
    if (userError) throw userError;
    if (!user?.active || !["admin", "commercial"].includes(user.role)) {
      return NextResponse.json({ error: "Commercial inexistant ou inactif." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await db.from("cockpit_contact_assignments").upsert({
      contact_id: contactId,
      assignee_cockpit_email: assigneeEmail,
      assigned_by_email: access.email || null,
      assigned_at: now,
      updated_at: now,
    }, { onConflict: "contact_id" });
    if (error) throw error;

    return NextResponse.json({ contactId, assigneeEmail }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
