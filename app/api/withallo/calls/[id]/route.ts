import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getAuthorizedAlloCall } from "@/lib/withallo-recordings";
import { shapeWithAlloCallDetail } from "@/lib/withallo-call-detail";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCockpitAccess();
    const { id } = await params;
    // Authorize access before exposing the transcript, summary, contact or agents.
    const call = await getAuthorizedAlloCall(id, access, true);
    return NextResponse.json({ call: shapeWithAlloCallDetail(call) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const code = Number((error as { status?: number }).status || 502);
    const status = [400, 401, 403, 404, 429, 503].includes(code) ? code : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de récupérer cette conversation Allo." },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
