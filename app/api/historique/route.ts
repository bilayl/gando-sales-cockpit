import { NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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
];
const MEETING_PROPS = ["hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome", "hubspot_owner_id", "hs_timestamp"];

type Row = { id: string; properties?: Record<string, string | null | undefined> };
type OnoffTranscriptRow = {
  call_id?: string | null;
  hubspot_call_id?: string | null;
  started_at?: string | null;
  external_number?: string | null;
  transcript_text?: string | null;
};
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
  onoffTranscript?: string;
  hubspotTranscriptAvailable?: boolean;
  hubspotSummary?: string;
};

function normalizePhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  const normalized = digits.startsWith("00") ? digits.slice(2) : digits;
  return normalized.length > 9 ? normalized.slice(-9) : normalized;
}

function timeDistanceMs(left?: string | null, right?: string | null) {
  const a = Date.parse(left || "");
  const b = Date.parse(right || "");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b);
}

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

function findOnoffTranscript(row: Row, onoffRows: OnoffTranscriptRow[]) {
  const p = row.properties ?? {};
  const callTime = p.hs_timestamp;
  const callPhones = [p.hs_call_to_number, p.hs_call_from_number]
    .map(normalizePhone)
    .filter(Boolean);

  const exact = onoffRows
    .filter(candidate => candidate.hubspot_call_id === row.id && candidate.transcript_text?.trim())
    .sort((a, b) => timeDistanceMs(a.started_at, callTime) - timeDistanceMs(b.started_at, callTime));

  const exactBest = exact[0];
  if (exactBest && timeDistanceMs(exactBest.started_at, callTime) <= 10 * 60 * 1000) {
    return exactBest.transcript_text?.trim() || undefined;
  }

  const byTimeAndPhone = onoffRows
    .filter(candidate => {
      if (!candidate.transcript_text?.trim()) return false;
      if (timeDistanceMs(candidate.started_at, callTime) > 10 * 60 * 1000) return false;
      const external = normalizePhone(candidate.external_number);
      return Boolean(external && callPhones.some(phone => phone === external));
    })
    .sort((a, b) => timeDistanceMs(a.started_at, callTime) - timeDistanceMs(b.started_at, callTime));

  return byTimeAndPhone[0]?.transcript_text?.trim() || exactBest?.transcript_text?.trim() || undefined;
}

function callItem(row: Row, onoffRows: OnoffTranscriptRow[]): HistoryItem | null {
  const p = row.properties ?? {};
  if (!p.hs_timestamp) return null;
  const duration = Number(p.hs_call_duration);
  const hubspotSummary = htmlToText(p.hs_call_summary);
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
    onoffTranscript: findOnoffTranscript(row, onoffRows),
    hubspotTranscriptAvailable: p.hs_call_has_transcript === "true",
    hubspotSummary: hubspotSummary || undefined,
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

async function loadOnoffTranscripts(): Promise<OnoffTranscriptRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("onoff_call_processing")
      .select("call_id,hubspot_call_id,started_at,external_number,transcript_text")
      .not("transcript_text", "is", null)
      .order("started_at", { ascending: false })
      .limit(500);
    if (error) {
      console.warn("historique:onoff_transcripts", error.message);
      return [];
    }
    return (data || []) as OnoffTranscriptRow[];
  } catch (error) {
    console.warn("historique:onoff_transcripts", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function GET() {
  try {
    const [calls, meetings, onoffRows] = await Promise.all([
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
      loadOnoffTranscripts(),
    ]);

    const items = [
      ...(calls.results || []).map((row: Row) => callItem(row, onoffRows)),
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
