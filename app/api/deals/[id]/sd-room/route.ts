import { NextRequest } from "next/server";
import type { DealRoomDetail } from "@/lib/deal-room-types";
import { getDealRoomDetail } from "@/lib/hubspot/deals";
import { apiError } from "@/lib/hubspot";
import { normalizeManualSD01 } from "@/lib/sd01-agent";
import {
  createSDRoom,
  getSDRoomBundle,
  listLinkedConversations,
  resolveSDRoomComment,
  saveSDDocument,
  updateSDRoomSettings,
} from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import type { SDRoomBrandTheme, SDRoomRecord } from "@/lib/sd-room-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function brandTheme(value: unknown): SDRoomBrandTheme {
  return value === "gradient" || value === "dark" || value === "light" ? value : "gando";
}

function standaloneDeal(room: SDRoomRecord): DealRoomDetail {
  return {
    id: room.hubspot_deal_id,
    name: room.title,
    amount: null,
    currency: null,
    closeDate: null,
    createdDate: room.created_at,
    stageId: null,
    stageLabel: "Dealroom autonome",
    stageProbability: null,
    pipelineId: null,
    pipelineLabel: null,
    ownerId: null,
    ownerName: null,
    hsNextStep: null,
    nextActivityDate: null,
    lastActivityAt: room.updated_at,
    daysSinceLastActivity: null,
    closed: false,
    closedWon: false,
    company: { id: room.company_hubspot_id || room.id, name: room.company_name, domain: null, industry: null, city: null },
    contacts: [],
    championId: null,
    decisionMakerId: null,
    championIdentified: false,
    championName: null,
    decisionMakerIdentified: false,
    decisionMakerName: null,
    strategic: true,
    strategicReason: "Dealroom créée sans association CRM.",
    potentialArr: null,
    potentialVolume: null,
    blockers: [],
    detectedBlockers: [],
    meetingPlanned: false,
    nextMeetingAt: null,
    nextTaskDueAt: null,
    nextTaskSubject: null,
    openTasksCount: 0,
    recentNoShowOrCancelled: false,
    score: 0,
    priorityScore: 0,
    priorityExplanation: "Dealroom autonome",
    health: "on_track",
    healthReason: "Suivi manuel dans la Room SD",
    breakdown: { economic: 0, strategic: 0, momentum: 0, health: 0 },
    scoreReasons: [],
    hubspotUrl: null,
    overviewMissing: [],
    stakeholders: [],
    nextSteps: [],
    meetings: { upcoming: [], completed: [], noShow: [], cancelled: [] },
    timeline: [],
    intelligence: { fields: [], mustKnow: [], recommendedAction: "Compléter le SD01", recommendedActionReason: "La room n’est pas reliée à un deal CRM." },
    closingPlan: { steps: [], doneCount: 0, inProgressCount: 0, total: 0, progressLabel: "0/0" },
    documents: [],
    stageOptions: [],
    contactsForAssociation: [],
  };
}

async function loadContext(id: string) {
  const userEmail = await requireSDInternalAccess();
  const bundle = await getSDRoomBundle(id);
  if (id.startsWith("standalone:")) {
    if (!bundle.room) throw Object.assign(new Error("Dealroom autonome introuvable."), { status: 404 });
    return { userEmail, deal: standaloneDeal(bundle.room), bundle, standalone: true };
  }
  const deal = await getDealRoomDetail(id);
  return { userEmail, deal, bundle, standalone: false };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { deal, bundle, standalone } = await loadContext(id);
    const linkedConversations = standalone ? [] : await listLinkedConversations(id, deal.company?.id || null, bundle.room?.id);
    return Response.json({ deal, ...bundle, linkedConversations, crmConnected: !standalone });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { userEmail, deal, bundle, standalone } = await loadContext(id);
    if (standalone) {
      return Response.json({ deal, ...bundle, linkedConversations: [], crmConnected: false }, { status: 200 });
    }

    let body: Record<string, unknown> = {};
    try { body = await request.json(); } catch { body = {}; }

    const created = await createSDRoom(deal, userEmail);
    const title = String(body.title || "").trim().slice(0, 240);
    const companyName = String(body.companyName || "").trim().slice(0, 240);
    const crmLink = String(body.crmLink || "").trim().slice(0, 2000) || null;
    const prospectLogoUrl = String(body.prospectLogoUrl || "").trim().slice(0, 2000) || null;
    const brandBannerImageUrl = String(body.brandBannerImageUrl || "").trim().slice(0, 2000) || null;
    const roomBrandTheme = brandTheme(body.brandTheme);
    const brandTitle = String(body.brandTitle || title || created.title).trim().slice(0, 240) || null;
    const brandSubtitle = String(body.brandSubtitle || "Espace de collaboration stratégique").trim().slice(0, 500) || null;

    const updates: Record<string, unknown> = {
      brand_theme: roomBrandTheme,
      brand_title: brandTitle,
      brand_subtitle: brandSubtitle,
    };
    if (title) updates.title = title;
    if (companyName) updates.company_name = companyName;
    if (crmLink) updates.crm_link = crmLink;
    if (prospectLogoUrl) updates.prospect_logo_url = prospectLogoUrl;
    if (brandBannerImageUrl) updates.brand_banner_image_url = brandBannerImageUrl;
    const { error: updateError } = await getSupabaseAdmin().from("deal_rooms").update(updates).eq("id", created.id);
    if (updateError) throw updateError;

    const nextBundle = await getSDRoomBundle(id);
    const linkedConversations = await listLinkedConversations(id, deal.company?.id || null, nextBundle.room?.id);
    return Response.json({ deal, ...nextBundle, linkedConversations, crmConnected: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { userEmail, deal, bundle } = await loadContext(id);
    if (!bundle.room) throw Object.assign(new Error("Créez d’abord la room SD."), { status: 404 });

    if (body?.action === "settings") {
      const accessMode = body.accessMode === "allowlist" ? "allowlist" : "email";
      const allowedEmails = Array.isArray(body.allowedEmails) ? body.allowedEmails.map(String) : [];
      const room = await updateSDRoomSettings({
        roomId: bundle.room.id,
        accessMode,
        allowedEmails,
        companyName: body.companyName === undefined ? undefined : String(body.companyName || ""),
        prospectLogoUrl: body.prospectLogoUrl === undefined ? undefined : String(body.prospectLogoUrl || ""),
        brandBannerImageUrl: body.brandBannerImageUrl === undefined ? undefined : String(body.brandBannerImageUrl || ""),
        brandTheme: body.brandTheme === undefined ? undefined : brandTheme(body.brandTheme),
        brandTitle: body.brandTitle === undefined ? undefined : String(body.brandTitle || ""),
        brandSubtitle: body.brandSubtitle === undefined ? undefined : String(body.brandSubtitle || ""),
      });
      return Response.json({ room });
    }

    if (body?.action === "resolve_comment") {
      const comment = await resolveSDRoomComment({ roomId: bundle.room.id, commentId: String(body.commentId || ""), resolvedByEmail: userEmail });
      return Response.json({ comment });
    }

    if (body?.action === "save_sd01" || body?.action === "publish_sd01") {
      const content = normalizeManualSD01(body.content, deal.company?.name || "Client");
      if (body.action === "publish_sd01" && !content.executiveSummary.trim()) {
        throw Object.assign(new Error("Ajoutez une synthèse avant de publier le SD01."), { status: 400 });
      }
      const current = bundle.documents.find(document => document.code === "SD01");
      const sourceMode = current?.source_mode === "agent" ? "mixed" : current?.source_mode || "manual";
      const document = await saveSDDocument({
        roomId: bundle.room.id,
        code: "SD01",
        content,
        sourceMode,
        updatedByEmail: userEmail,
        status: body.action === "publish_sd01" ? "published" : "draft",
        changeSummary: body.action === "publish_sd01" ? "SD01 relu et publié" : "Mise à jour manuelle du brouillon",
      });
      return Response.json({ document });
    }

    throw Object.assign(new Error("Action SD inconnue."), { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
