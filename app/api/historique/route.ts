import { NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const CALL_PROPS = ["hs_timestamp", "hs_call_title", "hs_call_duration", "hs_call_status", "hs_call_disposition", "hubspot_owner_id", "hs_call_to_number"];
const MEETING_PROPS = ["hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome", "hubspot_owner_id", "hs_timestamp"];

type Row = { id: string; properties?: Record<string, string | null | undefined> };
type HistoryItem = {
  type: "call" | "meeting";
  id: string;
  title: string;
  at: string;
  duration?: string;
  status?: string;
  disposition?: string;
  outcome?: string;
  ownerId?: string;
  toNumber?: string;
};

function callItem(row: Row): HistoryItem | null {
  const p = row.properties ?? {};
  if (!p.hs_timestamp) return null;
  const duration = Number(p.hs_call_duration);
  return {
    type: "call",
    id: row.id,
    title: p.hs_call_title || p.hs_call_disposition || "Appel",
    at: p.hs_timestamp,
    duration: Number.isFinite(duration) && duration > 0 ? String(Math.round(duration)) : undefined,
    status: p.hs_call_status || undefined,
    disposition: p.hs_call_disposition || undefined,
    ownerId: p.hubspot_owner_id || undefined,
    toNumber: p.hs_call_to_number || undefined,
  };
}

function meetingItem(row: Row): HistoryItem | null {
  const p = row.properties ?? {};
  if (!p.hs_meeting_start_time && !p.hs_timestamp) return null;
  return {
    type: "meeting",
    id: row.id,
    title: p.hs_meeting_title || "Rendez-vous",
    at: p.hs_meeting_start_time || p.hs_timestamp!,
    outcome: p.hs_meeting_outcome || undefined,
    ownerId: p.hubspot_owner_id || undefined,
  };
}

export async function GET() {
  try {
    const [calls, meetings] = await Promise.all([
      hubspotJson("/crm/objects/2026-03/calls/search", {
        method: "POST",
        body: JSON.stringify({
          limit: 100,
          properties: CALL_PROPS,
          sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
        }),
      }),
      hubspotJson("/crm/objects/2026-03/meetings/search", {
        method: "POST",
        body: JSON.stringify({
          limit: 100,
          properties: MEETING_PROPS,
          sorts: [{ propertyName: "hs_meeting_start_time", direction: "DESCENDING" }],
        }),
      }),
    ]);

    const items = [
      ...(calls.results || []).map(callItem),
      ...(meetings.results || []).map(meetingItem),
    ]
      .filter((x): x is HistoryItem => x !== null)
      .sort((a, b) => b.at.localeCompare(a.at));

    return NextResponse.json({
      total: items.length,
      calls: (calls.results || []).length,
      meetings: (meetings.results || []).length,
      items,
    });
  } catch (error) {
    return apiError(error);
  }
}
