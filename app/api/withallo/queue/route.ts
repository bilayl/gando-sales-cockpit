import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";
import { withAlloRequest } from "@/lib/withallo";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    if (!access.email) return NextResponse.json({ error: "Une adresse e-mail Gando est nécessaire pour retrouver votre file Allo." }, { status: 403 });
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const phone = normalizeWithAlloDialNumber(body?.phone);
    if (!phone) return NextResponse.json({ error: "Numéro de téléphone invalide. Vérifiez l’indicatif international." }, { status: 400 });
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
    const company = typeof body?.company === "string" ? body.company.trim().slice(0, 120) : "";
    await withAlloRequest("/v2/api/dialing-queues/current/numbers", {
      method: "POST",
      body: JSON.stringify({
        email: access.email,
        numbers: [{
          number: phone,
          name: name || phone,
          ...(company ? { company } : {}),
        }],
      }),
    });
    return NextResponse.json({
      ok: true,
      phone,
      message: "Numéro ajouté à votre file Power Dialer Allo. Lancez l’appel depuis Allo.",
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const raw = Number((error as { status?: number })?.status || 502);
    const status = [400, 401, 403, 404, 409, 429, 503].includes(raw) ? raw : 502;
    const message = error instanceof Error ? error.message : "Impossible de préparer l’appel Allo.";
    return NextResponse.json({ error: status === 403 ? "Allo refuse cette opération : vérifiez les permissions Power Dialer de la clé et les droits du compte." : message }, { status });
  }
}
