import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type EventRow = {
  visitor_email: string | null;
  visitor_first_name: string | null;
  visitor_last_name: string | null;
  session_id: string | null;
  event_type: string;
  document_code: string | null;
  active_seconds: number | null;
  created_at: string;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const admin = getSupabaseAdmin();
    const { data: room, error: roomError } = await admin
      .from("deal_rooms")
      .select("id,room_mode")
      .eq("hubspot_deal_id", id)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (room.room_mode === "standard") throw Object.assign(new Error("Historique réservé aux Deals entreprise."), { status: 400 });

    const { data, error } = await admin
      .from("deal_room_events")
      .select("visitor_email,visitor_first_name,visitor_last_name,session_id,event_type,document_code,active_seconds,created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    const events = (data || []) as EventRow[];
    const visitorMap = new Map<string, {
      email: string;
      firstName: string;
      lastName: string;
      firstSeenAt: string;
      lastSeenAt: string;
      activeSeconds: number;
      sessionIds: Set<string>;
      stages: Set<string>;
    }>();
    const sessionMap = new Map<string, {
      sessionId: string;
      email: string;
      firstName: string;
      lastName: string;
      startedAt: string;
      lastSeenAt: string;
      activeSeconds: number;
      stages: Set<string>;
      events: Array<{ type: string; documentCode: string | null; createdAt: string; activeSeconds: number }>;
    }>();

    let opens = 0;
    let activeSeconds = 0;
    for (const event of events) {
      const email = clean(event.visitor_email).toLowerCase();
      const firstName = clean(event.visitor_first_name);
      const lastName = clean(event.visitor_last_name);
      const sessionId = clean(event.session_id) || `${email || "anonymous"}:${event.created_at}`;
      const visitorKey = email || `${firstName}|${lastName}`.toLowerCase() || "anonymous";
      const seconds = Math.max(0, Number(event.active_seconds) || 0);
      if (event.event_type === "room_opened") opens += 1;
      activeSeconds += seconds;

      const visitor = visitorMap.get(visitorKey);
      if (!visitor) {
        visitorMap.set(visitorKey, {
          email,
          firstName,
          lastName,
          firstSeenAt: event.created_at,
          lastSeenAt: event.created_at,
          activeSeconds: seconds,
          sessionIds: new Set([sessionId]),
          stages: new Set(event.document_code ? [event.document_code] : []),
        });
      } else {
        visitor.firstSeenAt = event.created_at;
        visitor.activeSeconds += seconds;
        visitor.sessionIds.add(sessionId);
        if (event.document_code) visitor.stages.add(event.document_code);
        if (!visitor.firstName && firstName) visitor.firstName = firstName;
        if (!visitor.lastName && lastName) visitor.lastName = lastName;
      }

      const session = sessionMap.get(sessionId);
      if (!session) {
        sessionMap.set(sessionId, {
          sessionId,
          email,
          firstName,
          lastName,
          startedAt: event.created_at,
          lastSeenAt: event.created_at,
          activeSeconds: seconds,
          stages: new Set(event.document_code ? [event.document_code] : []),
          events: [{ type: event.event_type, documentCode: event.document_code, createdAt: event.created_at, activeSeconds: seconds }],
        });
      } else {
        session.startedAt = event.created_at;
        session.activeSeconds += seconds;
        if (event.document_code) session.stages.add(event.document_code);
        if (!session.firstName && firstName) session.firstName = firstName;
        if (!session.lastName && lastName) session.lastName = lastName;
        if (session.events.length < 60) session.events.push({ type: event.event_type, documentCode: event.document_code, createdAt: event.created_at, activeSeconds: seconds });
      }
    }

    const visitors = [...visitorMap.values()]
      .map(visitor => ({
        email: visitor.email,
        firstName: visitor.firstName,
        lastName: visitor.lastName,
        firstSeenAt: visitor.firstSeenAt,
        lastSeenAt: visitor.lastSeenAt,
        activeSeconds: visitor.activeSeconds,
        sessions: visitor.sessionIds.size,
        stages: [...visitor.stages].sort(),
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

    const sessions = [...sessionMap.values()]
      .map(session => ({
        sessionId: session.sessionId,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName,
        startedAt: session.startedAt,
        lastSeenAt: session.lastSeenAt,
        activeSeconds: session.activeSeconds,
        stages: [...session.stages].sort(),
        events: session.events
          .filter(event => event.type !== "heartbeat")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, 100);

    return Response.json({
      summary: {
        opens,
        uniqueVisitors: visitors.length,
        activeSeconds,
        sessions: sessions.length,
        lastViewedAt: events[0]?.created_at || null,
      },
      visitors,
      sessions,
    });
  } catch (error) {
    return apiError(error);
  }
}
