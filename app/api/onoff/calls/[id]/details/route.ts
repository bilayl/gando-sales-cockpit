import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getOnoffCallMetadata } from "@/lib/onoff";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findValue(input: unknown, keys: string[]): unknown {
  if (!input || typeof input !== "object") return undefined;
  const wanted = new Set(keys.map(normalizeKey));
  const queue: unknown[] = [input];
  const seen = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    for (const [key, value] of Object.entries(current as JsonRecord)) {
      if (wanted.has(normalizeKey(key)) && value !== null && value !== undefined) return value;
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return undefined;
}

function textFromValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(textFromValue).filter((item): item is string => Boolean(item));
    return parts.length ? parts.join("\n") : null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as JsonRecord;
  for (const key of ["text", "content", "transcript", "transcription", "summary", "note", "notes", "label", "name", "value"]) {
    const direct = record[key];
    const text = textFromValue(direct);
    if (text) return text;
  }

  const parts = Object.values(record).map(textFromValue).filter((item): item is string => Boolean(item));
  return parts.length ? parts.join("\n") : null;
}

function stringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(item => {
      if (typeof item === "string") return item.trim() ? [item.trim()] : [];
      if (item && typeof item === "object") {
        const record = item as JsonRecord;
        const candidate = record.name ?? record.label ?? record.value ?? record.tag;
        return typeof candidate === "string" && candidate.trim() ? [candidate.trim()] : [];
      }
      return [];
    });
  }
  if (typeof value === "string") return value.split(",").map(item => item.trim()).filter(Boolean);
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCockpitAccess();
  const { id } = await params;
  const callId = decodeURIComponent(String(id || "")).trim();
  if (!callId) return NextResponse.json({ error: "Call ID manquant." }, { status: 400 });

  const { data: localRows } = await getSupabaseAdmin()
    .from("onoff_call_processing")
    .select("event_name,transcript_text,ai_analysis,tags,raw_webhook,processing_status,hubspot_call_id")
    .eq("call_id", callId)
    .order("created_at", { ascending: false });

  const local = localRows || [];
  const localTranscript = local.find(row => String(row.transcript_text || "").trim())?.transcript_text || null;
  const localAi = local.find(row => row.ai_analysis)?.ai_analysis as JsonRecord | null | undefined;
  const localTags = local.flatMap(row => stringList(row.tags));
  const rawNotes = local.map(row => (row.raw_webhook || {}) as JsonRecord).find(row => row.callNotes)?.callNotes;

  let metadata: JsonRecord | null = null;
  let apiError: string | null = null;
  try {
    metadata = await getOnoffCallMetadata(callId);
  } catch (error) {
    apiError = error instanceof Error ? error.message : "Métadonnées Onoff indisponibles.";
  }

  const transcript = String(localTranscript || "").trim()
    || textFromValue(findValue(metadata, ["transcription", "transcript", "transcriptText"]))
    || null;
  const notes = textFromValue(rawNotes)
    || textFromValue(findValue(metadata, ["notes", "callNotes", "note"]))
    || null;
  const evaluation = textFromValue(findValue(metadata, ["evaluation", "callEvaluation", "scorecard"])) || null;
  const directTags = stringList(findValue(metadata, ["tags", "callTags"]));
  const tags = [...new Set([...localTags, ...directTags])];

  const aiSummary = textFromValue(localAi?.summary) || null;
  const keyPoints = stringList(localAi?.key_points);
  const objections = stringList(localAi?.objections);
  const nextSteps = stringList(localAi?.next_steps);

  return NextResponse.json({
    callId,
    transcript,
    notes,
    evaluation,
    tags,
    aiSummary,
    keyPoints,
    objections,
    nextSteps,
    metadataAvailable: Boolean(metadata),
    apiError,
    processingStatus: local[0]?.processing_status || null,
    hubspotCallId: local.find(row => row.hubspot_call_id)?.hubspot_call_id || null,
  }, { headers: { "cache-control": "no-store" } });
}
