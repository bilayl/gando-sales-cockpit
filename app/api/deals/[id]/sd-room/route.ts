import { NextRequest } from "next/server";
import { getDealRoomDetail } from "@/lib/hubspot/deals";
import { apiError } from "@/lib/hubspot";
import { normalizeManualSD01 } from "@/lib/sd01-agent";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  createSDRoom,
  getSDRoomBundle,
  listLinkedConversations,
  requireSDInternalAccess,
  resolveSDRoomComment,
  saveSDDocument,
  updateSDRoomSettings,
} from "@/lib/sd-room";

export const dynamic = "force-dynamic";

async function loadContext(id: string) {
  const userEmail = await requireSDInternalAccess();
  const deal = await getDealRoomDetail(id);
  const bundle = await getSDRoomBundle(id);
  return { userEmail, deal, bundle };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { deal, bundle } = await loadContext(id);
    const linkedConversations = await listLinkedConversations(id, deal.company?.id || null, bundle.room?.id);
    return Response.json({ deal, ...bundle, linkedConversations });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { userEmail, deal } = await loadContext(id);
    const body = await request.json().catch(() => ({}));
    const room = await createSDRoom(deal, userEmail);

    const defaultCompanyName = deal.company?.name || "Client";
    const companyName = String(body?.companyName || defaultCompanyName).trim().slice(0, 200) || defaultCompanyName;
    const title = String(body?.title || `${companyName} × Gando`).trim().slice(0, 240) || `${companyName} × Gando`;
    const crmLink = String(body?.crmLink || deal.hubspotUrl || "").trim().slice(0, 1000) || null;
    const prospectLogoUrl = String(body?.prospectLogoUrl || "").trim().slice(0, 2000) || null;

    const { error: updateError } = await getSupabaseAdmin()
      .from("deal_rooms")
      .update({ title, company_name: companyName, crm_link: crmLink, prospect_logo_url: prospectLogoUrl })
      .eq("id", room.id);
    if (updateError) throw updateError;

    const bundle = await getSDRoomBundle(id);
    const linkedConversations = await listLinkedConversations(id, deal.company?.id || null, bundle.room?.id);
    return Response.json({ deal, ...bundle, linkedConversations }, { status: 201 });
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
      const room = await updateSDRoomSettings({ roomId: bundle.room.id, accessMode, allowedEmails });
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
