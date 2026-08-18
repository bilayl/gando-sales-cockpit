import { NextRequest, NextResponse } from "next/server";
import { sendGoogleEmail } from "@/lib/google";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isPostCallEmailKind } from "@/lib/post-call-email-types";

export const dynamic = "force-dynamic";

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const to = typeof input.to === "string" ? input.to.trim() : "";
    const subject = typeof input.subject === "string" ? input.subject.trim() : "";
    const body = typeof input.body === "string" ? input.body.trim() : "";
    const contactId = typeof input.contactId === "string" ? input.contactId.trim() : "";
    const callId = typeof input.callId === "string" ? input.callId.trim() : "";
    const emailKind = typeof input.kind === "string" && isPostCallEmailKind(input.kind) ? input.kind : "recap";

    if (!looksLikeEmail(to)) return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    if (!subject || !body) return NextResponse.json({ error: "Objet et contenu requis" }, { status: 400 });

    const sent = await sendGoogleEmail({ to, subject, body });
    const providerMessageId = typeof sent?.id === "string" ? sent.id : null;
    let historyLogged = false;

    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("sent_emails").insert({
        provider: "gmail",
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
      messageId: providerMessageId,
      historyLogged,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'envoyer l'email";
    const reauthRequired = message === "GOOGLE_UNAUTHORIZED" || /insufficient authentication scopes|permission|scope/i.test(message);
    return NextResponse.json({
      error: reauthRequired ? "Reconnectez Google pour autoriser l'envoi d'emails depuis le Sales Cockpit." : message,
      reauthRequired,
    }, { status: reauthRequired ? 401 : 502 });
  }
}
