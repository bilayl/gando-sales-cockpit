import "server-only";

import { randomBytes } from "node:crypto";
import type { DealRoomDetail } from "@/lib/deal-room-types";
import { getHubSpotIdentity, isAuthBypassEnabled, isHubSpotAuthenticated } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  SD_CODES,
  SD_STAGE_META,
  createEmptySD01,
  type LinkedConversation,
  type SD01Content,
  type SDCode,
  type SDDocumentRecord,
  type SDRoomAccessMode,
  type SDRoomAnalytics,
  type SDRoomBrandTheme,
  type SDRoomComment,
  type SDRoomRecord,
  type SDSourceConversation,
} from "@/lib/sd-room-types";

type RoomBundle = {
  room: SDRoomRecord | null;
  documents: SDDocumentRecord[];
  sources: Array<Omit<SDSourceConversation, "transcript_text" | "transcript_data"> & { characterCount: number }>;
  analytics: SDRoomAnalytics;
  comments: SDRoomComment[];
};

type OnoffCall = {
  id: string;
  call_id: string;
  direction: string | null;
  call_status: string | null;
  call_duration: number | null;
  started_at: string | null;
  transcript_text: string | null;
  transcript: unknown;
  deal_ids: string[] | null;
  company_ids: string[] | null;
};

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanOptionalText(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max) || null;
}

function cleanBrandTheme(value: unknown): SDRoomBrandTheme {
  return value === "gradient" || value === "dark" || value === "light" ? value : "gando";
}

export async function requireSDInternalAccess() {
  if (!isAuthBypassEnabled() && !(await isHubSpotAuthenticated())) {
    throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });
  }
  const identity = await getHubSpotIdentity();
  return cleanEmail(identity?.email) || (isAuthBypassEnabled() ? "preview@gando.app" : "équipe Gando");
}

export async function createSDRoom(deal: DealRoomDetail, createdByEmail: string): Promise<SDRoomRecord> {
  const admin = getSupabaseAdmin();
  const companyName = deal.company?.name || "Client";
  const { data: existing, error: existingError } = await admin
    .from("deal_rooms")
    .select("*")
    .eq("hubspot_deal_id", deal.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as SDRoomRecord;

  const shareToken = randomBytes(32).toString("base64url");
  const { data: room, error } = await admin
    .from("deal_rooms")
    .insert({
      hubspot_deal_id: deal.id,
      company_hubspot_id: deal.company?.id || null,
      title: `${companyName} × Gando`,
      company_name: companyName,
      brand_theme: "gando",
      brand_title: `${companyName} × Gando`,
      brand_subtitle: "Espace de collaboration",
      share_token: shareToken,
      created_by_email: createdByEmail,
    })
    .select("*")
    .single();
  if (error) throw error;

  const roomRecord = room as SDRoomRecord;
  const { error: documentsError } = await admin.from("sd_documents").insert(
    SD_CODES.map(code => ({
      room_id: roomRecord.id,
      code,
      title: SD_STAGE_META[code].title,
      content: code === "SD01" ? createEmptySD01(companyName) : {},
      updated_by_email: createdByEmail,
    })),
  );
  if (documentsError) throw documentsError;
  return roomRecord;
}

function emptyAnalytics(): SDRoomAnalytics {
  return { opens: 0, uniqueVisitors: 0, activeSeconds: 0, lastViewedAt: null, recentVisitors: [] };
}

async function readAnalytics(roomId: string): Promise<SDRoomAnalytics> {
  const { data, error } = await getSupabaseAdmin()
    .from("deal_room_events")
    .select("visitor_email,event_type,active_seconds,created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  if (!data?.length) return emptyAnalytics();

  const visitors = new Map<string, { email: string; lastSeenAt: string; activeSeconds: number }>();
  let opens = 0;
  let activeSeconds = 0;
  for (const event of data) {
    const email = cleanEmail(event.visitor_email);
    if (event.event_type === "room_opened") opens += 1;
    activeSeconds += Number(event.active_seconds) || 0;
    const previous = visitors.get(email);
    if (!previous) visitors.set(email, { email, lastSeenAt: event.created_at, activeSeconds: Number(event.active_seconds) || 0 });
    else previous.activeSeconds += Number(event.active_seconds) || 0;
  }
  return {
    opens,
    uniqueVisitors: visitors.size,
    activeSeconds,
    lastViewedAt: data[0]?.created_at || null,
    recentVisitors: [...visitors.values()].slice(0, 8),
  };
}

export async function getSDRoomBundle(hubspotDealId: string): Promise<RoomBundle> {
  const admin = getSupabaseAdmin();
  const { data: room, error } = await admin
    .from("deal_rooms")
    .select("*")
    .eq("hubspot_deal_id", hubspotDealId)
    .maybeSingle();
  if (error) throw error;
  if (!room) return { room: null, documents: [], sources: [], analytics: emptyAnalytics(), comments: [] };

  const [documentsResult, sourcesResult, commentsResult, analytics] = await Promise.all([
    admin.from("sd_documents").select("*").eq("room_id", room.id).order("code"),
    admin
      .from("sd_source_conversations")
      .select("id,room_id,source_type,external_id,title,occurred_at,created_by_email,created_at,transcript_text")
      .eq("room_id", room.id)
      .order("occurred_at", { ascending: false }),
    admin.from("deal_room_comments").select("*").eq("room_id", room.id).order("created_at", { ascending: false }).limit(200),
    readAnalytics(room.id),
  ]);
  if (documentsResult.error) throw documentsResult.error;
  if (sourcesResult.error) throw sourcesResult.error;
  if (commentsResult.error) throw commentsResult.error;
  return {
    room: room as SDRoomRecord,
    documents: (documentsResult.data || []) as SDDocumentRecord[],
    sources: (sourcesResult.data || []).map(source => ({
      id: source.id,
      room_id: source.room_id,
      source_type: source.source_type,
      external_id: source.external_id,
      title: source.title,
      occurred_at: source.occurred_at,
      created_by_email: source.created_by_email,
      created_at: source.created_at,
      characterCount: String(source.transcript_text || "").length,
    })),
    analytics,
    comments: (commentsResult.data || []) as SDRoomComment[],
  };
}

async function queryLinkedCalls(column: "deal_ids" | "company_ids", id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("onoff_call_processing")
    .select("id,call_id,direction,call_status,call_duration,started_at,transcript_text,transcript,deal_ids,company_ids")
    .contains(column, [id])
    .not("transcript_text", "is", null)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as OnoffCall[];
}

export async function listLinkedConversations(
  dealId: string,
  companyId: string | null,
  roomId?: string,
): Promise<LinkedConversation[]> {
  const [dealCalls, companyCalls, importedResult] = await Promise.all([
    queryLinkedCalls("deal_ids", dealId),
    companyId ? queryLinkedCalls("company_ids", companyId) : Promise.resolve([]),
    roomId
      ? getSupabaseAdmin().from("sd_source_conversations").select("external_id").eq("room_id", roomId).eq("source_type", "onoff")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (importedResult.error) throw importedResult.error;
  const imported = new Set((importedResult.data || []).map(item => item.external_id));
  const deduped = new Map<string, OnoffCall>();
  for (const call of [...dealCalls, ...companyCalls]) deduped.set(call.call_id, call);
  return [...deduped.values()].map(call => ({
    id: call.call_id,
    title: `${call.direction === "inbound" ? "Appel entrant" : "Appel sortant"} · ${call.started_at ? new Date(call.started_at).toLocaleDateString("fr-FR") : "date inconnue"}`,
    occurredAt: call.started_at,
    duration: call.call_duration,
    status: call.call_status,
    transcriptText: String(call.transcript_text || "").slice(0, 420),
    imported: imported.has(call.call_id),
  }));
}

export async function loadAuthorizedOnoffCalls(input: {
  callIds: string[];
  dealId: string;
  companyId: string | null;
}) {
  if (!input.callIds.length) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("onoff_call_processing")
    .select("id,call_id,direction,call_status,call_duration,started_at,transcript_text,transcript,deal_ids,company_ids")
    .in("call_id", input.callIds.slice(0, 50));
  if (error) throw error;
  const calls = (data || []) as OnoffCall[];
  return calls.filter(call =>
    (call.deal_ids || []).includes(input.dealId) ||
    Boolean(input.companyId && (call.company_ids || []).includes(input.companyId)),
  );
}

export async function snapshotConversation(input: {
  roomId: string;
  sourceType: "manual" | "onoff" | "hubspot";
  externalId?: string | null;
  title: string;
  transcriptText: string;
  transcriptData?: unknown;
  occurredAt?: string | null;
  createdByEmail: string;
}) {
  const admin = getSupabaseAdmin();
  if (input.externalId) {
    const { data: existing, error } = await admin
      .from("sd_source_conversations")
      .select("id")
      .eq("room_id", input.roomId)
      .eq("source_type", input.sourceType)
      .eq("external_id", input.externalId)
      .maybeSingle();
    if (error) throw error;
    if (existing) {
      const { data, error: updateError } = await admin
        .from("sd_source_conversations")
        .update({
          title: input.title,
          transcript_text: input.transcriptText,
          transcript_data: input.transcriptData ?? null,
          occurred_at: input.occurredAt || null,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return data as SDSourceConversation;
    }
  }
  const { data, error } = await admin
    .from("sd_source_conversations")
    .insert({
      room_id: input.roomId,
      source_type: input.sourceType,
      external_id: input.externalId || null,
      title: input.title,
      transcript_text: input.transcriptText,
      transcript_data: input.transcriptData ?? null,
      occurred_at: input.occurredAt || null,
      created_by_email: input.createdByEmail,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SDSourceConversation;
}

export async function saveSDDocument(input: {
  roomId: string;
  code: SDCode;
  content: SD01Content | Record<string, unknown>;
  sourceMode: "manual" | "agent" | "mixed";
  updatedByEmail: string;
  status?: "draft" | "review" | "published" | "validated";
  modelName?: string | null;
  promptVersion?: string | null;
  sourceRefs?: unknown[];
  changeSummary?: string;
}) {
  const admin = getSupabaseAdmin();
  const { data: current, error: currentError } = await admin
    .from("sd_documents")
    .select("*")
    .eq("room_id", input.roomId)
    .eq("code", input.code)
    .single();
  if (currentError) throw currentError;
  const version = Number(current.version || 0) + 1;
  const status = input.status || current.status;
  const publishedAt = status === "published" || status === "validated" ? new Date().toISOString() : current.published_at;
  const isPublishing = status === "published" || status === "validated";

  const { data: updated, error: updateError } = await admin
    .from("sd_documents")
    .update({
      content: input.content,
      source_mode: input.sourceMode,
      version,
      status,
      model_name: input.modelName ?? current.model_name,
      prompt_version: input.promptVersion ?? current.prompt_version,
      updated_by_email: input.updatedByEmail,
      published_at: publishedAt,
      ...(isPublishing ? { published_content: input.content, published_version: version } : {}),
    })
    .eq("id", current.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  const { error: versionError } = await admin.from("sd_document_versions").insert({
    document_id: current.id,
    version,
    content: input.content,
    source_refs: input.sourceRefs || [],
    model_name: input.modelName || null,
    prompt_version: input.promptVersion || null,
    created_by_email: input.updatedByEmail,
    change_summary: input.changeSummary || null,
  });
  if (versionError) throw versionError;
  if (status === "published" || status === "validated") {
    const { error: roomError } = await admin
      .from("deal_rooms")
      .update({ status: "published", current_stage: input.code, published_at: new Date().toISOString() })
      .eq("id", input.roomId);
    if (roomError) throw roomError;
  }
  return updated as SDDocumentRecord;
}

export async function updateSDRoomSettings(input: {
  roomId: string;
  accessMode: SDRoomAccessMode;
  allowedEmails: string[];
  companyName?: string;
  prospectLogoUrl?: string | null;
  brandBannerImageUrl?: string | null;
  brandTheme?: SDRoomBrandTheme;
  brandTitle?: string | null;
  brandSubtitle?: string | null;
}) {
  const allowedEmails = [...new Set(input.allowedEmails.map(cleanEmail).filter(Boolean))].slice(0, 100);
  const updates: Record<string, unknown> = {
    access_mode: input.accessMode,
    allowed_emails: allowedEmails,
  };
  if (input.companyName !== undefined) {
    const companyName = String(input.companyName || "").trim().slice(0, 240);
    if (!companyName) throw Object.assign(new Error("Le nom de l’entreprise ne peut pas être vide."), { status: 400 });
    updates.company_name = companyName;
  }
  if (input.prospectLogoUrl !== undefined) updates.prospect_logo_url = cleanOptionalText(input.prospectLogoUrl, 2000);
  if (input.brandBannerImageUrl !== undefined) updates.brand_banner_image_url = cleanOptionalText(input.brandBannerImageUrl, 2000);
  if (input.brandTheme !== undefined) updates.brand_theme = cleanBrandTheme(input.brandTheme);
  if (input.brandTitle !== undefined) updates.brand_title = cleanOptionalText(input.brandTitle, 240);
  if (input.brandSubtitle !== undefined) updates.brand_subtitle = cleanOptionalText(input.brandSubtitle, 500);

  const { data, error } = await getSupabaseAdmin()
    .from("deal_rooms")
    .update(updates)
    .eq("id", input.roomId)
    .select("*")
    .single();
  if (error) throw error;
  return data as SDRoomRecord;
}

export async function resolveSDRoomComment(input: { roomId: string; commentId: string; resolvedByEmail: string }) {
  const { data, error } = await getSupabaseAdmin()
    .from("deal_room_comments")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by_email: input.resolvedByEmail })
    .eq("room_id", input.roomId)
    .eq("id", input.commentId)
    .select("*")
    .single();
  if (error) throw error;
  return data as SDRoomComment;
}

async function authorizePublicSDRoom(token: string, email: string) {
  const admin = getSupabaseAdmin();
  const normalizedEmail = cleanEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw Object.assign(new Error("Saisissez une adresse email valide."), { status: 400 });
  }
  const { data: room, error } = await admin
    .from("deal_rooms")
    .select("*")
    .eq("share_token", token)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!room) throw Object.assign(new Error("Cette room n’est pas disponible."), { status: 404 });
  if (room.access_mode === "allowlist" && !(room.allowed_emails || []).map(cleanEmail).includes(normalizedEmail)) {
    throw Object.assign(new Error("Cette adresse n’est pas autorisée à consulter la room."), { status: 403 });
  }
  return { room: room as SDRoomRecord, visitorEmail: normalizedEmail };
}

export async function getPublicSDRoom(token: string, email: string) {
  const admin = getSupabaseAdmin();
  const { room, visitorEmail } = await authorizePublicSDRoom(token, email);
  const { data: documents, error: documentsError } = await admin
    .from("sd_documents")
    .select("*")
    .eq("room_id", room.id)
    .not("published_at", "is", null)
    .order("code");
  if (documentsError) throw documentsError;
  return {
    room: {
      id: room.id,
      title: room.title,
      companyName: room.company_name,
      companyLogoUrl: room.prospect_logo_url,
      bannerImageUrl: room.brand_banner_image_url,
      theme: cleanBrandTheme(room.brand_theme),
      displayTitle: room.brand_title || room.title,
      displaySubtitle: room.brand_subtitle || "Espace de collaboration avec Gando",
      currentStage: room.current_stage,
      updatedAt: room.updated_at,
    },
    documents: (documents || []).map(document => ({
      ...document,
      content: document.code === "SD01"
        ? { ...(document.published_content || document.content || {}), evidence: [] }
        : document.published_content || document.content,
    })) as SDDocumentRecord[],
    visitorEmail,
  };
}

export async function recordSDRoomEvent(input: {
  token: string;
  email: string;
  sessionId: string;
  eventType: "room_opened" | "stage_viewed" | "section_viewed" | "heartbeat";
  documentCode?: SDCode | null;
  activeSeconds?: number;
  metadata?: Record<string, unknown>;
}) {
  const { room, visitorEmail } = await authorizePublicSDRoom(input.token, input.email);
  const { error } = await getSupabaseAdmin().from("deal_room_events").insert({
    room_id: room.id,
    document_code: input.documentCode || null,
    visitor_email: visitorEmail,
    session_id: String(input.sessionId || "").slice(0, 120),
    event_type: input.eventType,
    active_seconds: Math.max(0, Math.min(120, Number(input.activeSeconds) || 0)),
    metadata: input.metadata || {},
  });
  if (error) throw error;
}

export async function addPublicSDRoomComment(input: {
  token: string;
  email: string;
  documentCode: SDCode;
  sectionKey?: string | null;
  body: string;
}) {
  const { room, visitorEmail } = await authorizePublicSDRoom(input.token, input.email);
  const body = String(input.body || "").trim().slice(0, 4000);
  if (body.length < 3) throw Object.assign(new Error("Votre remarque est trop courte."), { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("deal_room_comments").insert({
    room_id: room.id,
    document_code: input.documentCode,
    section_key: String(input.sectionKey || "").trim().slice(0, 120) || null,
    author_email: visitorEmail,
    body,
  }).select("id,status,created_at").single();
  if (error) throw error;
  return data;
}
