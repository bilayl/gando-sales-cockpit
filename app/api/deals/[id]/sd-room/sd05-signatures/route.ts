import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { contractPageCount, normalizeSD05NativeContent, SD05_SIGNATURE_CONSENT } from "@/lib/sd05-contract";
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

function emailHtml(input: {
  logoUrl: string;
  signingUrl: string;
  signerLabel: string;
  companyName: string;
  title: string;
  reference: string;
  intro: string;
  expiresAt: string;
  contractHash: string;
  pageCount: number;
  legalTemplate: boolean;
}) {
  const header = input.legalTemplate ? "#323232" : "#735DF3";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f5f8;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden">
<tr><td style="height:68px;background:${header};text-align:center;vertical-align:bottom"><img src="${escapeHtml(input.logoUrl)}" width="76" height="76" alt="Gando" style="display:block;margin:0 auto -38px auto;width:76px;height:76px;border:0" /></td></tr>
<tr><td style="padding:58px 42px 18px 42px;text-align:center"><div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#735DF3;text-transform:uppercase">Signature électronique Gando</div><h1 style="margin:12px 0 0;font-size:27px;line-height:1.2;letter-spacing:-.03em;color:#111827">Document à signer</h1></td></tr>
<tr><td style="padding:4px 42px 0 42px;font-size:15px;line-height:1.7;color:#4b5563"><p style="margin:0 0 16px">Bonjour <strong style="color:#111827">${escapeHtml(input.signerLabel)}</strong>,</p><p style="margin:0 0 16px">${escapeHtml(input.intro)}</p></td></tr>
<tr><td style="padding:4px 42px 8px 42px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.7;color:#475569"><div style="font-size:16px;font-weight:800;color:#111827">${escapeHtml(input.title)}</div>${input.reference ? `<div style="margin-top:5px;color:#735DF3;font-weight:700">${escapeHtml(input.reference)}</div>` : ""}<div style="margin-top:12px"><strong>Organisation :</strong> ${escapeHtml(input.companyName)}</div><div><strong>Pages :</strong> ${input.pageCount}</div><div><strong>Expiration du lien :</strong> ${new Date(input.expiresAt).toLocaleDateString("fr-FR")}</div></td></tr></table></td></tr>
<tr><td align="center" style="padding:24px 42px"><a href="${escapeHtml(input.signingUrl)}" style="display:inline-block;background:#735DF3;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">Consulter et signer le contrat</a><div style="margin-top:12px;font-size:11px;line-height:1.5;color:#94a3b8">Ce lien est personnel et ne doit pas être transféré.</div></td></tr>
<tr><td style="padding:0 42px 28px 42px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#111827;border-radius:12px"><tr><td style="padding:18px 20px;color:#ffffff"><div style="font-size:12px;font-weight:800">Intégrité & preuve</div><div style="margin-top:7px;font-size:11px;line-height:1.6;color:#cbd5e1">Le contrat est figé par empreinte SHA-256. Les consultations, paraphes, choix de signature et horodatages sont conservés dans le journal d'audit.</div><div style="margin-top:10px;word-break:break-all;font-family:monospace;font-size:9px;line-height:1.5;color:#94a3b8">${input.contractHash}</div></td></tr></table></td></tr>
<tr><td style="padding:20px 42px 28px 42px;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;line-height:1.6;color:#94a3b8">GANDO SOLUTIONS · RCS Meaux 943 391 201 · 3 chemin de la porte verte, 77144 Montévrain<br />Besoin d'aide ? Répondez à cet email ou contactez contact@gando.app.</td></tr>
</table>
</td></tr></table></body></html>`;
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
    if (!content.allowTypedSignature && !content.allowDrawnSignature) throw Object.assign(new Error("Activez au moins un mode de signature."), { status: 400 });
    if (content.contractStatus === "signed") throw Object.assign(new Error("Cette version du contrat est déjà signée et figée."), { status: 409 });

    let signers = content.signatories.filter(item => looksLikeEmail(email(item.email)));
    if (requestedSignerEmail) signers = signers.filter(item => email(item.email) === requestedSignerEmail);
    const deduped = new Map(signers.map(item => [email(item.email), item]));
    signers = [...deduped.values()];
    if (!signers.length) throw Object.assign(new Error("Ajoutez au moins un signataire avec une adresse email valide."), { status: 400 });

    const snapshot = buildSD05SigningSnapshot(bundle.room, document, content);
    const contractHash = hashSD05SigningSnapshot(snapshot);
    const expiresAt = signatureExpiry(content.signatureDeadline);
    const pageCount = contractPageCount(content);
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
          document_page_count: pageCount,
          expires_at: expiresAt,
          created_by_email: userEmail,
        })
        .select("*")
        .single();
      if (createError) throw createError;
      const createdRow = created as SignatureRequestRow;
      await recordSignatureEvent({ requestId: createdRow.id, eventType: "created", metadata: { contractHash, pageCount, template: content.contractTemplate } });

      const signingUrl = `${request.nextUrl.origin}/sign/${encodeURIComponent(rawToken)}`;
      const logoUrl = `${request.nextUrl.origin}/api/brand/gando-logo`;
      const subject = `Signature requise — ${content.contractTitle}`;
      const signerLabel = signer.name || signerEmail;
      const intro = content.emailIntroText || `Vous êtes invité à consulter puis signer électroniquement le document préparé entre Gando et ${bundle.room.company_name}.`;
      const body = [
        `Bonjour ${signerLabel},`,
        "",
        intro,
        "",
        content.contractTitle,
        content.contractReference ? `Référence : ${content.contractReference}` : "",
        `Nombre de pages : ${pageCount}`,
        "",
        `Consulter et signer : ${signingUrl}`,
        "",
        `Ce lien est personnel et valable jusqu'au ${new Date(expiresAt).toLocaleDateString("fr-FR")}.`,
        `Empreinte SHA-256 : ${contractHash}`,
        "",
        "Après signature, Gando conserve le document figé, les paraphes, le mode de signature, les horodatages et le journal d'audit comme éléments de preuve.",
      ].filter(Boolean).join("\n");
      const htmlBody = emailHtml({
        logoUrl,
        signingUrl,
        signerLabel,
        companyName: bundle.room.company_name,
        title: content.contractTitle,
        reference: content.contractReference,
        intro,
        expiresAt,
        contractHash,
        pageCount,
        legalTemplate: content.contractTemplate === "legal_convention",
      });

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
