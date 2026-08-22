import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { isFortuneoTestResignRoom } from "@/lib/sd05-test-deal";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { POST as sendSignatureInvitation } from "../sd05-signatures/route";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const input = await request.json().catch(() => ({}));
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    if (!isFortuneoTestResignRoom(bundle.room.id)) {
      throw Object.assign(new Error("La re-signature d'un contrat validé est réservée au deal Fortuneo de test."), { status: 403 });
    }

    const document = bundle.documents.find(item => item.code === "SD05");
    if (!document) throw Object.assign(new Error("SD05 introuvable."), { status: 404 });
    const content = normalizeSD05NativeContent(document.content);
    if (content.contractStatus !== "signed" && document.status !== "validated") {
      throw Object.assign(new Error("Le mode de re-signature de test s'utilise sur un contrat déjà signé ou validé."), { status: 409 });
    }

    const admin = getSupabaseAdmin();
    const originalContent = document.content;
    const originalPublishedContent = document.published_content;
    const originalStatus = document.status;
    const originalPublishedAt = document.published_at;

    const reopenedContent = {
      ...content,
      contractStatus: "ready_to_sign" as const,
      signatories: content.signatories.map(signer => ({
        ...signer,
        signatureStatus: signer.signatureStatus === "signed" ? "pending" as const : signer.signatureStatus,
      })),
    };

    const { error: reopenError } = await admin.from("sd_documents").update({
      content: reopenedContent,
      published_content: reopenedContent,
      status: "published",
      published_at: document.published_at || new Date().toISOString(),
    }).eq("id", document.id);
    if (reopenError) throw reopenError;

    const forwardedUrl = request.nextUrl.clone();
    forwardedUrl.pathname = `/api/deals/${encodeURIComponent(id)}/sd-room/sd05-signatures`;
    const forwarded = new NextRequest(forwardedUrl, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(input),
    });

    const response = await sendSignatureInvitation(forwarded, { params: Promise.resolve({ id }) });
    const payload = await response.clone().json().catch(() => ({}));
    const sent = Array.isArray(payload?.sent) ? payload.sent : [];

    if (!response.ok || !sent.length) {
      await admin.from("sd_documents").update({
        content: originalContent,
        published_content: originalPublishedContent,
        status: originalStatus,
        published_at: originalPublishedAt,
      }).eq("id", document.id);
    }

    return response;
  } catch (error) {
    return apiError(error);
  }
}
