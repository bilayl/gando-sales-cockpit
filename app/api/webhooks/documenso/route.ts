import crypto from "crypto";
import { downloadSignedDocumensoPdf, documensoWebhookSecret } from "@/lib/documenso";
import { normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { saveSDDocument } from "@/lib/sd-room";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeEqual(received: string, expected: string) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseExternalId(value: unknown) {
  const raw = String(value || "");
  const match = /^gando-sd05:([^:]+):([^:]+)$/.exec(raw);
  return match ? { roomId: match[1], documentId: match[2] } : null;
}

function signedEmail(payload: Record<string, unknown>) {
  const recipients = Array.isArray(payload.recipients)
    ? payload.recipients
    : Array.isArray(payload.Recipient)
      ? payload.Recipient
      : [];
  const signed = recipients.find(item => item && typeof item === "object" && String((item as Record<string, unknown>).signingStatus || "") === "SIGNED") as Record<string, unknown> | undefined;
  return String(signed?.email || "").trim().toLowerCase() || null;
}

export async function POST(request: Request) {
  const expectedSecret = documensoWebhookSecret();
  if (!expectedSecret) return Response.json({ error: "Webhook Documenso non configuré." }, { status: 503 });
  const receivedSecret = String(request.headers.get("x-documenso-secret") || "");
  if (!safeEqual(receivedSecret, expectedSecret)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { event?: string; payload?: Record<string, unknown> } | null;
  const event = String(body?.event || "");
  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
  const link = parseExternalId(payload.externalId);
  if (!link) return Response.json({ received: true, ignored: true });

  const admin = getSupabaseAdmin();
  const { data: document, error } = await admin
    .from("sd_documents")
    .select("*")
    .eq("id", link.documentId)
    .eq("room_id", link.roomId)
    .eq("code", "SD05")
    .maybeSingle();
  if (error) throw error;
  if (!document) return Response.json({ received: true, ignored: true });

  const content = normalizeSD05NativeContent(document.content);
  const envelopeId = String(payload.envelopeId || content.signatureEnvelopeId || "").trim();
  if (content.signatureEnvelopeId && envelopeId && content.signatureEnvelopeId !== envelopeId) {
    return Response.json({ received: true, ignored: true });
  }

  if (event === "DOCUMENT_COMPLETED") {
    if (!envelopeId) throw new Error("Envelope Documenso manquant.");
    const pdf = await downloadSignedDocumensoPdf(envelopeId);
    const path = `sd05-signed/${link.roomId}/${envelopeId}.pdf`;
    const uploaded = await admin.storage.from("sd-room-files").upload(path, pdf, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: true,
    });
    if (uploaded.error) throw uploaded.error;
    const { data: publicUrl } = admin.storage.from("sd-room-files").getPublicUrl(uploaded.data.path);
    const email = signedEmail(payload);

    const signatories = content.signatories.map(signer => {
      if (!email || signer.email.toLowerCase() !== email) return signer;
      return { ...signer, signatureStatus: "signed" };
    });
    const nextContent = {
      ...content,
      signatureProvider: "documenso" as const,
      signatureEnvelopeId: envelopeId,
      signatureState: "signed" as const,
      signedDocumentUrl: publicUrl.publicUrl,
      contractStatus: "signed" as const,
      signatories,
    };
    await saveSDDocument({
      roomId: link.roomId,
      code: "SD05",
      content: nextContent,
      sourceMode: "manual",
      updatedByEmail: "documenso-webhook@gando.app",
      status: "validated",
      changeSummary: "Contrat signé via Documenso",
    });
    const completedAt = String(payload.completedAt || new Date().toISOString());
    const { error: roomError } = await admin
      .from("deal_rooms")
      .update({ contract_signed_at: completedAt, contract_signed_by_email: email })
      .eq("id", link.roomId);
    if (roomError) throw roomError;
    return Response.json({ received: true, status: "signed" });
  }

  if (event === "DOCUMENT_REJECTED" || event === "DOCUMENT_CANCELLED") {
    const signatureState = event === "DOCUMENT_REJECTED" ? "rejected" : "cancelled";
    const nextContent = {
      ...content,
      signatureProvider: "documenso" as const,
      signatureState,
      contractStatus: "client_review" as const,
      signatureUrl: "",
    };
    await saveSDDocument({
      roomId: link.roomId,
      code: "SD05",
      content: nextContent,
      sourceMode: "manual",
      updatedByEmail: "documenso-webhook@gando.app",
      status: "published",
      changeSummary: event === "DOCUMENT_REJECTED" ? "Signature Documenso refusée" : "Signature Documenso annulée",
    });
  }

  return Response.json({ received: true });
}
