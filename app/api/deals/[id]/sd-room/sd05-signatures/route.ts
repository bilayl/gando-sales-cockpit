import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, requireSDInternalAccess } from "@/lib/sd-room";
import { normalizeSD05NativeContent, SD05_SIGNATURE_CONSENT } from "@/lib/sd05-contract";
import {
  buildSD05SigningSnapshot,
  createSignatureToken,
  hashSD05SigningSnapshot,
  hashSignatureToken,
  recordSignatureEvent,
  signatureRequestSummary,
  type SignatureRequestRow,
} from "@/lib/sd05-signature";
import { sendSmtp2goEmail } from "@/lib/smtp2go";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function email(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function signatureExpiry(signatureDeadline: string) {
  if (signatureDeadline) {
    const deadline = new Date(`${signatureDeadline}T23:59:59.999`);
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() > Date.now()) return deadline.toISOString();
  }
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

async function listRequests(documentId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("sd_contract_signature_requests")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map(item => signatureRequestSummary(item as SignatureRequestRow));
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const document = bundle.documents.find(item => item.code === "SD05");
    if (!document) throw Object.assign(new Error("SD05 introuvable."), { status: 404 });
    return Response.json({ requests: await listRequests(document.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const input = await request.json().catch(() => ({}));
    const requestedSignerEmail = email(input?.signerEmail);
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });

    const missing = ["SD01", "SD02"].filter(code => bundle.documents.find(item => item.code === code)?.status !== "validated");
    if (missing.length) throw Object.assign(new Error(`${missing.join(" et ")} doivent être validés avant l'envoi du contrat en signature.`), { status: 409 });

    const document = bundle.documents.find(item => item.code === "SD05");
    if (!document) throw Object.assign(new Error("SD05 introuvable."), { status: 404 });
    const content = normalizeSD05NativeContent(document.content);
    if (!content.contractTitle.trim()) throw Object.assign(new Error("Ajoutez un titre au contrat."), { status: 400 });
    if (content.contractSummary.trim().length < 300) throw Object.assign(new Error("Le texte du contrat est incomplet."), { status: 400 });
    if (content.contractStatus === "signed") throw Object.assign(new Error("Cette version du contrat est déjà signée et figée."), { status: 409 });

    let signers = content.signatories.filter(item => looksLikeEmail(email(item.email)));
    if (requestedSignerEmail) signers = signers.filter(item => email(item.email) === requestedSignerEmail);
    const deduped = new Map(signers.map(item => [email(item.email), item]));
    signers = [...deduped.values()];
    if (!signers.length) throw Object.assign(new Error("Ajoutez au moins un signataire avec une adresse email valide."), { status: 400 });

    const snapshot = buildSD05SigningSnapshot(bundle.room, document, content);
    const contractHash = hashSD05SigningSnapshot(snapshot);
    const expiresAt = signatureExpiry(content.signatureDeadline);
    const admin = getSupabaseAdmin();
    const sent: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const signer of signers) {
      const signerEmail = email(signer.email);
      const { data: activeRows, error: activeError } = await admin
        .from("sd_contract_signature_requests")
        .select("id")
        .eq("document_id", document.id)
        .eq("signer_email", signerEmail)
        .in("status", ["pending", "sent", "viewed"]);
      if (activeError) throw activeError;
      for (const active of activeRows || []) {
        const { error: revokeError } = await admin.from("sd_contract_signature_requests").update({ status: "revoked" }).eq("id", active.id);
        if (revokeError) throw revokeError;
        await recordSignatureEvent({ requestId: active.id, eventType: "revoked", metadata: { reason: "new_invitation_created" } });
      }

      const rawToken = createSignatureToken();
      const { data: created, error: createError } = await admin
        .from("sd_contract_signature_requests")
        .insert({
          room_id: bundle.room.id,
          document_id: document.id,
          signer_name: signer.name || signerEmail,
          signer_email: signerEmail,
          signer_role: signer.role || null,
          signer_organization: signer.organization || bundle.room.company_name,
          token_hash: hashSignatureToken(rawToken),
          contract_reference: content.contractReference || null,
          contract_version: content.contractVersion || null,
          contract_snapshot: snapshot,
          contract_hash: contractHash,
          status: "pending",
          consent_text: SD05_SIGNATURE_CONSENT,
          expires_at: expiresAt,
          created_by_email: userEmail,
        })
        .select("*")
        .single();
      if (createError) throw createError;
      const createdRow = created as SignatureRequestRow;
      await recordSignatureEvent({ requestId: createdRow.id, eventType: "created", metadata: { contractHash } });

      const signingUrl = `${request.nextUrl.origin}/sign/${encodeURIComponent(rawToken)}`;
      const subject = `Signature électronique — ${content.contractTitle}`;
      const signerLabel = signer.name || signerEmail;
      const body = [
        `Bonjour ${signerLabel},`,
        "",
        `Gando vous invite à consulter et signer électroniquement le contrat « ${content.contractTitle} ».`,
        content.contractReference ? `Référence : ${content.contractReference}` : "",
        "",
        `Lien personnel de signature : ${signingUrl}`,
        "",
        `Ce lien est personnel et valable jusqu'au ${new Date(expiresAt).toLocaleDateString("fr-FR")}.`,
        `Empreinte du document : ${contractHash}`,
        "",
        "Une fois signé, Gando conserve le document figé, les horodatages et le journal d'audit comme éléments de preuve.",
      ].filter(Boolean).join("\n");
      const htmlBody = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;line-height:1.6">
          <div style="border-top:6px solid #735DF3;padding:28px 8px 8px">
            <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em">Gando</div>
            <p>Bonjour ${escapeHtml(signerLabel)},</p>
            <p>Vous êtes invité à consulter et signer électroniquement le contrat <strong>${escapeHtml(content.contractTitle)}</strong>.</p>
            ${content.contractReference ? `<p style="color:#64748b">Référence : ${escapeHtml(content.contractReference)}</p>` : ""}
            <p style="margin:28px 0"><a href="${escapeHtml(signingUrl)}" style="display:inline-block;background:#735DF3;color:white;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Consulter et signer</a></p>
            <p style="font-size:12px;color:#64748b">Ce lien est personnel. Il expire le ${new Date(expiresAt).toLocaleDateString("fr-FR")}.<br>Empreinte SHA-256 : <span style="word-break:break-all">${contractHash}</span></p>
            <p style="font-size:12px;color:#64748b">Après signature, Gando conserve le document figé, l'identité déclarée, l'email, les horodatages et le journal d'audit comme éléments de preuve.</p>
          </div>
        </div>`;

      try {
        const emailResult = await sendSmtp2goEmail({ to: signerEmail, subject, body, htmlBody, replyTo: "contact@gando.app" });
        const sentAt = new Date().toISOString();
        const { error: sentError } = await admin.from("sd_contract_signature_requests").update({
          status: "sent",
          sent_at: sentAt,
          smtp_provider_message_id: emailResult.emailId,
          smtp_request_id: emailResult.requestId,
        }).eq("id", createdRow.id);
        if (sentError) throw sentError;
        await recordSignatureEvent({ requestId: createdRow.id, eventType: "email_sent", metadata: { provider: "smtp2go", emailId: emailResult.emailId, requestId: emailResult.requestId } });
        sent.push(signerEmail);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Échec d'envoi";
        await admin.from("sd_contract_signature_requests").update({ status: "failed" }).eq("id", createdRow.id);
        await recordSignatureEvent({ requestId: createdRow.id, eventType: "email_failed", metadata: { error: message } });
        failed.push({ email: signerEmail, error: message });
      }
    }

    if (sent.length) {
      const nextSignatories = content.signatories.map(signer => sent.includes(email(signer.email)) ? { ...signer, signatureStatus: "sent" } : signer);
      const nextContent = { ...content, contractStatus: "ready_to_sign" as const, signatories: nextSignatories };
      const { error: documentError } = await admin.from("sd_documents").update({
        content: nextContent,
        published_content: nextContent,
        status: "published",
        published_at: document.published_at || new Date().toISOString(),
      }).eq("id", document.id);
      if (documentError) throw documentError;
    }

    return Response.json({ ok: failed.length === 0, sent, failed, contractHash, requests: await listRequests(document.id) });
  } catch (error) {
    return apiError(error);
  }
}
