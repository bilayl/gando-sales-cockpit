import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
type OnoffRow = {
  call_id: string;
  event_name?: string | null;
  external_number?: string | null;
  direction?: string | null;
  call_status?: string | null;
  call_duration?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  recording_url?: string | null;
  onoff_user?: JsonRecord | null;
  tags?: unknown;
  raw_webhook?: JsonRecord | null;
  processing_status?: string | null;
  transcript_text?: string | null;
  ai_analysis?: JsonRecord | null;
  hubspot_call_id?: string | null;
  created_at?: string | null;
};

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tagsFrom(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(item => {
      if (typeof item === "string") return item.trim() ? [item.trim()] : [];
      if (item && typeof item === "object") {
        const record = item as JsonRecord;
        const label = record.name ?? record.label ?? record.value ?? record.tag;
        return typeof label === "string" && label.trim() ? [label.trim()] : [];
      }
      return [];
    });
  }
  if (typeof value === "string") return value.split(",").map(item => item.trim()).filter(Boolean);
  return [];
}

function latestValue<T>(rows: OnoffRow[], getter: (row: OnoffRow) => T | null | undefined): T | null {
  for (const row of rows) {
    const value = getter(row);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function sortRows(rows: OnoffRow[]) {
  return [...rows].sort((a, b) => {
    const aRecording = a.event_name === "RECORDING" ? 1 : 0;
    const bRecording = b.event_name === "RECORDING" ? 1 : 0;
    if (aRecording !== bRecording) return bRecording - aRecording;
    return String(b.created_at || b.started_at || "").localeCompare(String(a.created_at || a.started_at || ""));
  });
}

function callItem(callId: string, sourceRows: OnoffRow[]) {
  const rows = sortRows(sourceRows);
  const rawRows = rows.map(row => row.raw_webhook || {});
  const raw = rawRows.find(record => Object.keys(record).length) || {};
  const user = (latestValue(rows, row => row.onoff_user) || {}) as JsonRecord;
  const transcript = stringValue(latestValue(rows, row => row.transcript_text));
  const analysis = (latestValue(rows, row => row.ai_analysis) || {}) as JsonRecord;
  const recordingRow = rows.find(row => Boolean(row.recording_url) || Boolean(row.raw_webhook?.callRecordingUrl));
  const startedAt = stringValue(latestValue(rows, row => row.started_at)) || stringValue(raw.callStarted) || stringValue(latestValue(rows, row => row.created_at));
  const endedAt = stringValue(latestValue(rows, row => row.ended_at)) || stringValue(raw.callEnded);
  const externalNumber = stringValue(latestValue(rows, row => row.external_number)) || stringValue(raw.externalNumber);
  const externalName = stringValue(raw.externalName);
  const externalCompanyName = stringValue(raw.externalCompanyName);
  const direction = stringValue(latestValue(rows, row => row.direction)) || stringValue(raw.callDirection);
  const status = stringValue(latestValue(rows, row => row.call_status)) || stringValue(raw.callStatus);
  const duration = numberValue(latestValue(rows, row => row.call_duration)) || numberValue(raw.callDuration);
  const allTags = [...new Set(rows.flatMap(row => tagsFrom(row.tags)).concat(tagsFrom(raw.tags)))];

  return {
    type: "call" as const,
    id: callId,
    callId,
    at: startedAt,
    endedAt: endedAt || null,
    title: externalName || externalCompanyName || externalNumber || "Appel Onoff",
    externalName: externalName || null,
    externalCompanyName: externalCompanyName || null,
    externalNumber: externalNumber || null,
    direction: direction || null,
    status: status || null,
    duration,
    userName: stringValue(user.name) || stringValue(raw.onoffUserName) || null,
    userEmail: stringValue(user.email) || stringValue(raw.onoffUserEmail) || null,
    onoffNumber: stringValue(user.number) || stringValue(raw.onoffUserNumber) || null,
    tags: allTags,
    hasRecording: Boolean(recordingRow),
    hasTranscript: Boolean(transcript),
    transcript: transcript || null,
    aiSummary: stringValue(analysis.summary) || null,
    processingStatus: stringValue(latestValue(rows, row => row.processing_status)) || null,
    hubspotCallId: stringValue(latestValue(rows, row => row.hubspot_call_id)) || null,
  };
}

function voicemailItem(row: OnoffRow) {
  const raw = row.raw_webhook || {};
  const user = row.onoff_user || {};
  const externalNumber = stringValue(row.external_number) || stringValue(raw.externalNumber);
  const externalName = stringValue(raw.externalName);
  return {
    type: "voicemail" as const,
    id: row.call_id,
    callId: row.call_id,
    at: stringValue(row.started_at) || stringValue(raw.callStarted) || stringValue(row.created_at),
    title: externalName || externalNumber || "Message vocal",
    externalName: externalName || null,
    externalCompanyName: stringValue(raw.externalCompanyName) || null,
    externalNumber: externalNumber || null,
    direction: stringValue(row.direction) || stringValue(raw.callDirection) || "INBOUND",
    status: stringValue(row.call_status) || stringValue(raw.callStatus) || null,
    duration: numberValue(raw.voicemailDuration) || numberValue(row.call_duration),
    userName: stringValue(user.name) || stringValue(raw.onoffUserName) || null,
    userEmail: stringValue(user.email) || stringValue(raw.onoffUserEmail) || null,
    onoffNumber: stringValue(user.number) || stringValue(raw.onoffUserNumber) || null,
    tags: [...new Set(tagsFrom(row.tags).concat(tagsFrom(raw.tags)))],
    hasRecording: false,
    hasTranscript: Boolean(stringValue(row.transcript_text)),
    transcript: stringValue(row.transcript_text) || null,
    aiSummary: stringValue(row.ai_analysis?.summary) || null,
    processingStatus: stringValue(row.processing_status) || null,
    hubspotCallId: stringValue(row.hubspot_call_id) || null,
    hasVoicemail: Boolean(raw.voicemailUrl),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") || 500);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 500, 1), 1000);

    const { data, error } = await getSupabaseAdmin()
      .from("onoff_call_processing")
      .select("call_id,event_name,external_number,direction,call_status,call_duration,started_at,ended_at,recording_url,onoff_user,tags,raw_webhook,processing_status,transcript_text,ai_analysis,hubspot_call_id,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;

    const rows = (data || []) as OnoffRow[];
    const callGroups = new Map<string, OnoffRow[]>();
    const voicemails: ReturnType<typeof voicemailItem>[] = [];

    for (const row of rows) {
      if (!row.call_id) continue;
      if (row.event_name === "VOICEMAIL") {
        voicemails.push(voicemailItem(row));
        continue;
      }
      const existing = callGroups.get(row.call_id) || [];
      existing.push(row);
      callGroups.set(row.call_id, existing);
    }

    const calls = [...callGroups.entries()].map(([callId, grouped]) => callItem(callId, grouped));
    const items = [...calls, ...voicemails]
      .filter(item => Boolean(item.at))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, limit);

    return NextResponse.json({
      source: "onoff_webhooks+onoff_api",
      total: items.length,
      summary: {
        calls: items.filter(item => item.type === "call").length,
        recordings: items.filter(item => item.type === "call" && item.hasRecording).length,
        transcriptions: items.filter(item => item.hasTranscript).length,
        voicemails: items.filter(item => item.type === "voicemail").length,
      },
      items,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Impossible de charger l’historique Onoff.",
    }, { status });
  }
}
