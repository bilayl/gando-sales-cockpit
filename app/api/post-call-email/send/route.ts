import { NextRequest, NextResponse } from "next/server";
import { sendGoogleEmail } from "@/lib/google";

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

    if (!looksLikeEmail(to)) return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    if (!subject || !body) return NextResponse.json({ error: "Objet et contenu requis" }, { status: 400 });

    const sent = await sendGoogleEmail({ to, subject, body });
    return NextResponse.json({ ok: true, messageId: sent?.id || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'envoyer l'email";
    const reauthRequired = message === "GOOGLE_UNAUTHORIZED" || /insufficient authentication scopes|permission|scope/i.test(message);
    return NextResponse.json({
      error: reauthRequired ? "Reconnectez Google pour autoriser l'envoi d'emails depuis le Sales Cockpit." : message,
      reauthRequired,
    }, { status: reauthRequired ? 401 : 502 });
  }
}
