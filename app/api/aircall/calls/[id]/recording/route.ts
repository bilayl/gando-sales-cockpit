import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { aircallRequest } from "@/lib/aircall";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCockpitAccess();
    const { id } = await params;
    if (!/^\d+$/.test(id) || id.length > 20) return NextResponse.json({ error: "ID d’appel invalide" }, { status: 400 });
    const payload = await aircallRequest<{ call?: { recording?: string | null; recording_short_url?: string | null } }>(`/calls/${id}`);
    const target = payload.call?.recording || payload.call?.recording_short_url;
    if (!target || !target.startsWith("https://")) return NextResponse.json({ error: "Cet appel n’a pas d’enregistrement accessible." }, { status: 404 });
    return NextResponse.redirect(target, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Enregistrement inaccessible" }, { status });
  }
}
