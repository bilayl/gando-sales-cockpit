import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const allowed = ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hubspot_owner_id"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const properties = Object.fromEntries(Object.entries(body.properties ?? {}).filter(([key]) => allowed.includes(key)));
    const data = await hubspotJson(`/crm/objects/2026-03/meetings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ properties }) });
    return NextResponse.json(data);
  } catch (error) { return apiError(error); }
}
