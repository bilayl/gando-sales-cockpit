import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeAircallPhone } from "@/lib/aircall";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 80, 1), 200);
    const phone = url.searchParams.get("phone");
    const international = phone ? normalizeAircallPhone(phone) : null;
    if (phone && !international) return NextResponse.json({ error: "Numéro international requis." }, { status: 400 });
    let query = getSupabaseAdmin()
      .from("aircall_calls")
      .select("call_id,direction,external_number,started_at,ended_at,duration_seconds,status,recording_url,agent_email,tags")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (international) query = query.eq("external_number", international);
    if (access.role !== "admin") {
      if (!access.email) return NextResponse.json({ error: "Votre compte doit être associé à un e-mail." }, { status: 403 });
      query = query.ilike("agent_email", access.email);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ items: data || [], total: data?.length || 0 }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les appels Aircall" }, { status });
  }
}
