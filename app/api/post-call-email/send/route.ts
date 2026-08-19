import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isPostCallEmailKind } from "@/lib/post-call-email-types";
import { sendSmtp2goEmail } from "@/lib/smtp2go";

export const dynamic = "force-dynamic";

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée" }, { status: 403 });
    }

    const input = await request.json().catch(() => ({}));
    const to = typeof input.to === "string" ? input.to.trim() : "";
    const subject = typeof input.subject === "string" ? input.subject.trim() : "";
    const body = typeof input.body === "string" ? input.body.trim() : "";
    const contactId = typeof input.contactId === "string" ? input.contactId.trim() : "";
    const callId = typeof input.callId === "string" ? input.callId.trim() : "";
    const emailKind = typeof input.kind === "string" && isPostCallEmailKind(input.kind) ? input.kind : "recap";

    if (!looksLikeEmail(to)) return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    if (!subject || !body) return NextResponse.json({ error: "Objet et contenu requis" }, { status: 400 });

    const sent = await sendSmtp2goEmail({ to, subject, body });
    const providerMessageId = sent.emailId;
    let historyLogged = false;

    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("sent_emails").insert({
        provider: "smtp2go",
        provider_message_id: providerMessageId,
        contact_id: contactId || null,
        call_id: callId || null,
        email_kind: emailKind,
        recipient: to,
        subject,
        body,
        sent_at: new Date().toISOString(),
      });
      historyLogged = !error;
    } catch {
      historyLogged = false;
    }

    return NextResponse.json({
      ok: true,
      provider: "smtp2go",
      messageId: providerMessageId,
      requestId: sent.requestId,
      historyLogged,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'envoyer l'email";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
