import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { requireSDInternalAccess } from "@/lib/sd-room";
import { SD_CODES, SD_STAGE_META, createEmptySD01 } from "@/lib/sd-room-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSDInternalAccess();
    const admin = getSupabaseAdmin();
    const { data: rooms, error: roomsError } = await admin
      .from("deal_rooms")
      .select("id,hubspot_deal_id,title,company_name,crm_link,prospect_logo_url,share_token,status,current_stage,published_at,last_shared_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(250);

    if (roomsError) throw roomsError;
    if (!rooms?.length) return Response.json({ results: [], total: 0 });

    const roomIds = rooms.map(room => room.id);
    const [documentsResult, eventsResult, commentsResult] = await Promise.all([
      admin
        .from("sd_documents")
        .select("room_id,code,status,source_mode,version,published_version,updated_at")
        .in("room_id", roomIds)
        .order("code"),
      admin
        .from("deal_room_events")
        .select("room_id,visitor_email,event_type,created_at")
        .in("room_id", roomIds)
        .order("created_at", { ascending: false })
        .limit(10000),
      admin
        .from("deal_room_comments")
        .select("room_id,status")
        .in("room_id", roomIds),
    ]);

    if (documentsResult.error) throw documentsResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const documentsByRoom = new Map<string, typeof documentsResult.data>();
    for (const document of documentsResult.data || []) {
      const current = documentsByRoom.get(document.room_id) || [];
      current.push(document);
      documentsByRoom.set(document.room_id, current);
    }

    const analyticsByRoom = new Map<string, { opens: number; visitors: Set<string>; lastViewedAt: string | null }>();
    for (const event of eventsResult.data || []) {
      const current = analyticsByRoom.get(event.room_id) || { opens: 0, visitors: new Set<string>(), lastViewedAt: null };
      if (event.event_type === "room_opened") current.opens += 1;
      const email = String(event.visitor_email || "").trim().toLowerCase();
      if (email) current.visitors.add(email);
      if (!current.lastViewedAt) current.lastViewedAt = event.created_at;
      analyticsByRoom.set(event.room_id, current);
    }

    const openCommentsByRoom = new Map<string, number>();
    for (const comment of commentsResult.data || []) {
      if (comment.status !== "open") continue;
      openCommentsByRoom.set(comment.room_id, (openCommentsByRoom.get(comment.room_id) || 0) + 1);
    }

    const results = rooms.map(room => {
      const analytics = analyticsByRoom.get(room.id);
      return {
        ...room,
        crmConnected: !room.hubspot_deal_id.startsWith("standalone:"),
        documents: documentsByRoom.get(room.id) || [],
        opens: analytics?.opens || 0,
        uniqueVisitors: analytics?.visitors.size || 0,
        lastViewedAt: analytics?.lastViewedAt || null,
        openComments: openCommentsByRoom.get(room.id) || 0,
      };
    });

    return Response.json({ results, total: results.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const createdByEmail = await requireSDInternalAccess();
    const body = await request.json();
    const companyName = String(body?.companyName || "").trim().slice(0, 240);
    const title = String(body?.title || "").trim().slice(0, 240);
    const crmLink = String(body?.crmLink || "").trim().slice(0, 2000) || null;
    const prospectLogoUrl = String(body?.prospectLogoUrl || "").trim().slice(0, 2000) || null;

    if (!companyName) throw Object.assign(new Error("Le nom de l’organisation est obligatoire."), { status: 400 });
    if (!title) throw Object.assign(new Error("Le nom de la dealroom est obligatoire."), { status: 400 });

    const admin = getSupabaseAdmin();
    const editorKey = `standalone:${randomUUID()}`;
    const shareToken = randomBytes(32).toString("base64url");
    const { data: room, error } = await admin
      .from("deal_rooms")
      .insert({
        hubspot_deal_id: editorKey,
        company_hubspot_id: null,
        title,
        company_name: companyName,
        crm_link: crmLink,
        prospect_logo_url: prospectLogoUrl,
        share_token: shareToken,
        created_by_email: createdByEmail,
      })
      .select("*")
      .single();
    if (error) throw error;

    const { error: documentsError } = await admin.from("sd_documents").insert(
      SD_CODES.map(code => ({
        room_id: room.id,
        code,
        title: SD_STAGE_META[code].title,
        content: code === "SD01" ? createEmptySD01(companyName) : {},
        updated_by_email: createdByEmail,
      })),
    );
    if (documentsError) throw documentsError;

    return Response.json({ room, editorKey, crmConnected: false }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
