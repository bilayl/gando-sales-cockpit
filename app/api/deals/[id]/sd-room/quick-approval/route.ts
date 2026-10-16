import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getCockpitAccess, requireCockpitAdmin } from "@/lib/cockpit-access";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeStageContent, type SD04Content } from "@/lib/sd-stage-content";
import { approvalIsCurrent, proposalFingerprint, readQuickApproval, type QuickDealInternalApproval } from "@/lib/quick-deal-approval";

export const dynamic = "force-dynamic";

async function context(id: string) {
  const bundle = await getSDRoomBundle(id);
  if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
  if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("Réservé aux deals rapides."), { status: 409 });
  const document = bundle.documents.find(item => item.code === "SD04");
  if (!document) throw Object.assign(new Error("Proposition introuvable."), { status: 404 });
  return { bundle, document };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const [{ document }, access] = await Promise.all([context(id), getCockpitAccess()]);
    const approval = readQuickApproval(document.content);
    return Response.json({
      approval,
      approvedForCurrent: approvalIsCurrent(document.content, approval),
      canApprove: access?.role === "admin",
      documentStatus: document.status,
    });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const adminUser = await requireCockpitAdmin();
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "approve" && action !== "revoke" && action !== "set_required")
      throw Object.assign(new Error("Action inconnue."), { status: 400 });

    const { document } = await context(id);
    if (document.status === "validated")
      throw Object.assign(new Error("La proposition client est validée et figée."), { status: 409 });

    const content = normalizeStageContent("SD04", document.content) as SD04Content;
    const existing = readQuickApproval(content);
    const cleared: QuickDealInternalApproval = {
      required: existing.required, approvedAt: null, approvedByEmail: null, approvedHash: null,
    };
    let approval: QuickDealInternalApproval = cleared;
    if (action === "set_required") {
      if (typeof body.required !== "boolean")
        throw Object.assign(new Error("Choisissez si l’approbation est obligatoire."), { status: 400 });
      approval = { ...cleared, required: body.required };
    }
    if (action === "approve") {
      if (!content.deckTitle.trim() || !content.executiveMessage.trim() || !content.pricing.length)
        throw Object.assign(new Error("Enregistrez le titre, le message et les tarifs avant approbation."), { status: 409 });
      if (content.gandoEconomics.gandoRatePercent <= 0)
        throw Object.assign(new Error("Renseignez un tarif Gando positif avant approbation."), { status: 409 });
      approval = {
        required: existing.required,
        approvedAt: new Date().toISOString(),
        approvedByEmail: adminUser.email || "Administrateur",
        approvedHash: proposalFingerprint(content),
      };
    }
    const updatedContent = { ...content, internalApproval: approval };
    const admin = getSupabaseAdmin();
    const updates: Record<string, unknown> = { content: updatedContent, updated_by_email: adminUser.email };
    if (document.published_content && document.status === "published") {
      const published = normalizeStageContent("SD04", document.published_content) as SD04Content;
      if (proposalFingerprint(published) === proposalFingerprint(content)) {
        updates.published_content = { ...published, internalApproval: approval };
      }
    }
    const { data, error } = await admin.from("sd_documents").update(updates)
      .eq("id", document.id).eq("version", document.version).select("id,content,status").single();
    if (error) throw error;
    return Response.json({
      approval: readQuickApproval(data.content),
      approvedForCurrent: approvalIsCurrent(data.content, approval),
      documentStatus: data.status,
    });
  } catch (error) { return apiError(error); }
}
