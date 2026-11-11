import { NextRequest, NextResponse } from "next/server";
import { getAlloAiForCrm } from "@/lib/withallo-ai-crm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get("kind");
    const id = request.nextUrl.searchParams.get("id") || "";
    if ((kind !== "contact" && kind !== "company") || !/^\d{1,25}$/.test(id)) {
      return NextResponse.json({ error: "Fiche CRM invalide." }, { status: 400 });
    }
    const data = await getAlloAiForCrm(kind, id);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const raw = Number((error as { status?: number })?.status || 502);
    const code = [400, 401, 403, 404, 429, 503].includes(raw) ? raw : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de lire l’IA Allo." },
      { status: code, headers: { "Cache-Control": "private, no-store" } });
  }
}
