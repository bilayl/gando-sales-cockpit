import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const MAX_PAGES = 5;
const PAGE_SIZE = 100;

type SearchBody = { limit: number; properties: string[]; filterGroups: { filters: { propertyName: string; operator: string; value: string }[] }[]; after?: string };

function rangeFilters(property: string, start: string, end: string) {
  return [
    { filters: [{ propertyName: property, operator: "GTE", value: start }] },
    { filters: [{ propertyName: property, operator: "LTE", value: end }] },
  ];
}

async function searchTotal(body: SearchBody, path: string) {
  const data = await hubspotJson(path, { method: "POST", body: JSON.stringify(body) });
  return data as { total: number };
}

const throttleSearch = () => new Promise(resolve => setTimeout(resolve, 225));

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!start || !end) return NextResponse.json({ error: "Paramètres start/end requis" }, { status: 400 });

    const calls = await searchTotal({ limit: 1, properties: ["hs_timestamp"], filterGroups: rangeFilters("hs_timestamp", start, end) }, "/crm/objects/2026-03/calls/search");
    await throttleSearch();
    const meetings = await searchTotal({ limit: 1, properties: ["hs_meeting_start_time", "hs_meeting_title"], filterGroups: rangeFilters("hs_meeting_start_time", start, end) }, "/crm/objects/2026-03/meetings/search");
    await throttleSearch();

    const distribution = new Map<string, number>();
    let workedTotal = 0;
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body: SearchBody = {
        limit: PAGE_SIZE,
        properties: ["statut_prospection"],
        filterGroups: rangeFilters("hs_last_sales_activity_timestamp", start, end),
        ...(after ? { after } : {}),
      };
      const data = await hubspotJson("/crm/objects/2026-03/contacts/search", { method: "POST", body: JSON.stringify(body) });
      if (page === 0) workedTotal = Number(data.total || 0);
      for (const row of (data.results || []) as Array<{ properties?: Record<string, string | null | undefined> }>) {
        const statut = row.properties?.statut_prospection;
        if (statut) distribution.set(statut, (distribution.get(statut) || 0) + 1);
      }
      after = data.paging?.next?.after;
      if (!after) break;
      await throttleSearch();
    }

    const conversion = calls.total > 0 ? Math.round((meetings.total / calls.total) * 100) : 0;

    return NextResponse.json({
      start,
      end,
      kpis: { calls: calls.total, meetings: meetings.total, worked: workedTotal, conversion },
      distribution: Array.from(distribution.entries()).map(([statut, count]) => ({ statut, count })).sort((a, b) => b.count - a.count),
    });
  } catch (error) {
    return apiError(error);
  }
}
