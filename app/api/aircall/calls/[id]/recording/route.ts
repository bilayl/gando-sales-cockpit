import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { aircallRequest } from "@/lib/aircall";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCockpitAccess();
    const { id } = await params;
    if (!/^\d+$/.test(id) || id.length > 20) return NextResponse.json({ error: "ID d’appel invalide" }, { status: 400 });
    const { data: stored, error: storedError } = await getSupabaseAdmin().from("aircall_calls").select("agent_email").eq("call_id", id).maybeSingle();
    if (storedError) throw storedError;
    if (!stored) return NextResponse.json({ error: "Appel inconnu." }, { status: 404 });
    if (access.role !== "admin" && (!access.email || stored.agent_email?.toLowerCase() !== access.email.toLowerCase())) {
      return NextResponse.json({ error: "Enregistrement réservé au propriétaire de l’appel." }, { status: 403 });
    }
    const payload = await aircallRequest<{ call?: { recording?: string | null; recording_short_url?: string | null } }>(`/calls/${id}`);
    const target = payload.call?.recording || payload.call?.recording_short_url;
    if (!target || !target.startsWith("https://")) return NextResponse.json({ error: "Cet appel n’a pas d’enregistrement accessible." }, { status: 404 });
    return NextResponse.redirect(target, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Enregistrement inaccessible" }, { status });
  }
}
