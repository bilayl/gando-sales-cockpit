import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { SD_CODES } from "@/lib/sd-room-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const { data, error } = await getSupabaseAdmin().from("deal_room_events")
      .select("document_code,visitor_email,visitor_first_name,visitor_last_name,session_id,event_type,created_at")
      .eq("room_id", bundle.room.id).not("document_code", "is", null).order("created_at", { ascending: false }).limit(5000);
    if (error) throw error;
    const documents = Object.fromEntries(SD_CODES.map(code => {
      const rows = (data || []).filter(row => row.document_code === code && row.event_type === "stage_viewed");
      const sessions = new Set(rows.map(row => String(row.session_id || row.visitor_email || "")).filter(Boolean));
      const seen = new Set<string>();
      const recentVisitors = rows.filter(row => { const key = String(row.session_id || row.visitor_email || `${row.visitor_first_name || ""}-${row.visitor_last_name || ""}`); if (!key || seen.has(key)) return false; seen.add(key); return true; }).slice(0, 5).map(row => ({ firstName: row.visitor_first_name || "", lastName: row.visitor_last_name || "", email: row.visitor_email || "", viewedAt: row.created_at }));
      const latest = rows[0];
      const lastVisitorName = [latest?.visitor_first_name, latest?.visitor_last_name].filter(Boolean).join(" ") || null;
      return [code, { visits: rows.length, opens: sessions.size, lastViewedAt: latest?.created_at || null, lastVisitorName, recentVisitors }];
    }));
    return Response.json({ documents });
  } catch (error) { return apiError(error); }
}
