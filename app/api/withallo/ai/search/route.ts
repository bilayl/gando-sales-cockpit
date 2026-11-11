import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { withAlloRequest } from "@/lib/withallo";
import { getAuthorizedAlloCall } from "@/lib/withallo-recordings";
import { shapeWithAlloCallDetail } from "@/lib/withallo-call-detail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const search = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 140);
    if (search.length < 3) {
      return NextResponse.json({ results: [], total: 0, message: "Saisissez au moins trois caractères." });
    }
    // Official Allo conversation search searches AI summaries and transcripts.
    // Search is never forwarded to a separate LLM and no synthetic answers are invented.
    const payload = await withAlloRequest<{ data?: Array<{ id?: string; type?: string }> }>(
      "/v2/api/conversations/items/search",
      { method: "POST", body: JSON.stringify({
        search, type: "CALL", sort: "RELEVANCE", size: 12, page: 1,
      }) },
    );
    const matches = (Array.isArray(payload.data) ? payload.data : [])
      .filter(item => /^cll[-_][a-zA-Z0-9_-]{3,120}$/.test(String(item.id || "")) && (!item.type || item.type === "CALL"))
      .slice(0, 12);
    const detailed = await Promise.allSettled(matches.map(async result => {
      const raw = await getAuthorizedAlloCall(result.id!, access, true);
      const call = shapeWithAlloCallDetail(raw);
      return {
        id: call.id,
        title: call.title,
        contactName: call.contactName,
        contactNumber: call.contactNumber,
        startedAt: call.startedAt,
        summary: call.summary?.slice(0, 5500) || null,
        transcript: call.transcriptText?.slice(0, 7500) || null,
        actions: call.actions.slice(0, 8).map(action => action.text),
      };
    }));
    const results = detailed.flatMap(item => item.status === "fulfilled" ? [item.value] : []);
    return NextResponse.json({ results, total: results.length }, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 502);
    return NextResponse.json({ error: error instanceof Error ? error.message : "La recherche IA Allo est indisponible." }, {
      status: [400, 401, 403, 404, 429, 503].includes(status) ? status : 502,
      headers: { "cache-control": "private, no-store" },
    });
  }
}
