import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const PAGE_SIZE = 100;

const CALL_PROPERTIES = [
  "hs_timestamp",
  "hs_call_title",
  "hs_call_status",
  "hs_call_disposition",
  "hs_call_direction",
  "hs_call_duration",
  "hs_call_from_number",
  "hs_call_to_number",
  "hs_call_body",
  "hs_call_summary",
  "hs_call_recording_url",
  "hs_call_has_transcript",
  "onoff_call_tags",
  "hubspot_owner_id",
];

function rangeFilters(property: string, start: string, end: string) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    throw Object.assign(new Error("Période d’historique d’appels invalide."), { status: 400 });
  }
  return [{
    filters: [
      { propertyName: property, operator: "GTE", value: String(startMs) },
      { propertyName: property, operator: "LTE", value: String(endMs) },
    ],
  }];
}

function stripHtml(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inferredSummary(body: string) {
  const marker = body.match(/(?:^|\n)Summary:\s*([\s\S]+)$/i);
  return marker?.[1]?.trim() || "";
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const after = url.searchParams.get("after")?.trim() || undefined;
    if (!start || !end) return NextResponse.json({ error: "Paramètres start/end requis" }, { status: 400 });

    const body = {
      limit: PAGE_SIZE,
      properties: CALL_PROPERTIES,
      filterGroups: rangeFilters("hs_timestamp", start, end),
      ...(after ? { after } : {}),
    };

    const data = await hubspotJson("/crm/objects/2026-03/calls/search", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const results = (data.results || []).map((row: any) => {
      const properties = row.properties || {};
      const bodyText = stripHtml(properties.hs_call_body);
      const summary = stripHtml(properties.hs_call_summary) || inferredSummary(bodyText);
      return {
        id: String(row.id),
        timestamp: properties.hs_timestamp || row.createdAt || null,
        title: properties.hs_call_title || "Appel",
        status: properties.hs_call_status || null,
        disposition: properties.hs_call_disposition || null,
        direction: properties.hs_call_direction || null,
        durationMs: Number(properties.hs_call_duration || 0) || 0,
        fromNumber: properties.hs_call_from_number || null,
        toNumber: properties.hs_call_to_number || null,
        body: bodyText,
        summary,
        recordingUrl: properties.hs_call_recording_url || null,
        hasTranscript: String(properties.hs_call_has_transcript || "").toLowerCase() === "true",
        tags: properties.onoff_call_tags || null,
        ownerId: properties.hubspot_owner_id || null,
      };
    });

    return NextResponse.json({
      results,
      total: Number(data.total || 0),
      paging: data.paging?.next?.after ? { next: { after: String(data.paging.next.after) } } : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
