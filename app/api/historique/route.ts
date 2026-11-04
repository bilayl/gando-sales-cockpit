import { NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const CALL_PROPS = [
  "hs_timestamp",
  "hs_call_title",
  "hs_call_duration",
  "hs_call_status",
  "hs_call_disposition",
  "hubspot_owner_id",
  "hs_call_to_number",
  "hs_call_from_number",
  "hs_call_has_transcript",
  "hs_call_summary",
  "hs_call_body",
];
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
  fromNumber?: string;
  hubspotTranscriptAvailable?: boolean;
  hubspotSummary?: string;
  hubspotNotes?: string;
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToText(value?: string | null) {
  if (!value) return "";
  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function callItem(row: Row): HistoryItem | null {
  const p = row.properties ?? {};
  if (!p.hs_timestamp) return null;
  const duration = Number(p.hs_call_duration);
  const hubspotSummary = htmlToText(p.hs_call_summary);
  const hubspotNotes = htmlToText(p.hs_call_body);
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
    fromNumber: p.hs_call_from_number || undefined,
    hubspotTranscriptAvailable: p.hs_call_has_transcript === "true",
    hubspotSummary: hubspotSummary || undefined,
    hubspotNotes: hubspotNotes || undefined,
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
      ...(calls.results || []).map((row: Row) => callItem(row)),
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
