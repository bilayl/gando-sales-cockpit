import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { aircallRequest, getAircallAgentForEmail, normalizeAircallPhone } from "@/lib/aircall";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const body = await request.json().catch(() => ({}));
    const to = normalizeAircallPhone(body.to);
    if (!to) return NextResponse.json({ error: "Utilisez un numéro international, par exemple +33612345678 ou +590690123456." }, { status: 400 });

    // Do not trust the browser with a user ID: only the logged-in agent can trigger a call.
    const agent = await getAircallAgentForEmail(access.email || "");
    const assignedNumbers = (agent.numbers || []).filter(number => Number.isSafeInteger(Number(number.id)));
    const requestedNumberId = Number(body.numberId || process.env.AIRCALL_NUMBER_ID || 0);
    const line = requestedNumberId
      ? assignedNumbers.find(number => Number(number.id) === requestedNumberId)
      : assignedNumbers.length === 1 ? assignedNumbers[0] : null;
    if (!line) {
      return NextResponse.json({
        error: assignedNumbers.length > 1
          ? "Sélectionnez le numéro sortant Aircall dans le composeur."
          : "Aucune ligne Aircall sortante n’est attribuée à votre utilisateur.",
      }, { status: 409 });
    }

    await aircallRequest(`/users/${agent.id}/calls`, {
      method: "POST",
      body: JSON.stringify({ number_id: Number(line.id), to }),
    });
    return NextResponse.json({ ok: true, message: "Appel demandé à Aircall", to, line: line.name || line.digits || null }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de démarrer l’appel Aircall" }, { status });
  }
}
