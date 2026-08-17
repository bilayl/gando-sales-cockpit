import "server-only";

import { hubspotJson } from "@/lib/hubspot";
import { BREVO_DOMAIN, getBrevoMeetingScope } from "@/lib/hubspot/brevo";
import { MEETING_PROPERTIES } from "@/lib/hubspot/meetings";

const DEBUG_MAX_ROWS = 2_000;

type MeetingRecord = {
  id: string;
  properties?: Record<string, string | null | undefined>;
  createdAt?: string;
  updatedAt?: string;
};

export type MeetingDebugReasons = {
  markerInBody: boolean;
  markerInLocation: boolean;
  brevoInTitle: boolean;
  brevoInSource: boolean;
  brevoInObjectSource: boolean;
  brevoMentionAnywhere: boolean;
};

export type MeetingDebugRow = {
  id: string;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  outcome: string | null;
  included: boolean;
  matchedBySearch: boolean;
  reasons: MeetingDebugReasons;
};

export type MeetingDebugResult = {
  ownerId: string;
  ownerEmail: string;
  marker: string;
  scanned: number;
  limitHit: boolean;
  included: number;
  excluded: number;
  excludedByMarker: number;
  excludedBySearch: number;
  byMonth: Record<string, { total: number; included: number; excluded: number }>;
  rows: MeetingDebugRow[];
};

function analyzeMeeting(meeting: MeetingRecord): MeetingDebugReasons {
  const p = meeting.properties || {};
  const lower = (value?: string | null) => (value || "").toLowerCase();
  const title = lower(p.hs_meeting_title);
  const body = lower(p.hs_meeting_body);
  const location = lower(p.hs_meeting_location);
  const source = lower(p.hs_meeting_source);
  const locationType = lower(p.hs_meeting_location_type);
  const objectSource = lower(p.hs_object_source_label);
  const activityType = lower(p.hs_activity_type);

  const reasons: MeetingDebugReasons = {
    markerInBody: body.includes(BREVO_DOMAIN),
    markerInLocation: location.includes(BREVO_DOMAIN),
    brevoInTitle: title.includes("brevo"),
    brevoInSource: source.includes("brevo") || locationType.includes("brevo"),
    brevoInObjectSource: objectSource.includes("brevo"),
    brevoMentionAnywhere: [title, body, location, source, locationType, objectSource, activityType]
      .some(value => value.includes("brevo")),
  };
  return reasons;
}

export async function analyzeBrevoMeetings(options: { start?: Date; end?: Date } = {}) {
  const scope = await getBrevoMeetingScope();
  const rows: MeetingDebugRow[] = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      limit: 200,
      properties: [...MEETING_PROPERTIES],
      sorts: [{ propertyName: "hs_meeting_start_time", direction: "DESCENDING" }],
      filterGroups: [{
        filters: [
          ...(options.start
            ? [{ propertyName: "hs_meeting_start_time", operator: "GTE", value: options.start.toISOString() }]
            : []),
          ...(options.end
            ? [{ propertyName: "hs_meeting_start_time", operator: "LT", value: options.end.toISOString() }]
            : []),
        ],
      }],
    };
    if (after) body.after = after;

    const data = await hubspotJson("/crm/objects/2026-03/meetings/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const page = (data.results || []) as MeetingRecord[];
    for (const meeting of page) {
      const p = meeting.properties || {};
      const reasons = analyzeMeeting(meeting);
      const startValue = p.hs_meeting_start_time || p.hs_timestamp || null;
      rows.push({
        id: String(meeting.id),
        title: p.hs_meeting_title || null,
        startAt: startValue,
        endAt: p.hs_meeting_end_time || null,
        outcome: p.hs_meeting_outcome || null,
        included: reasons.markerInBody || reasons.markerInLocation,
        matchedBySearch: reasons.brevoMentionAnywhere,
        reasons,
      });
    }
    after = data.paging?.next?.after ? String(data.paging.next.after) : undefined;
  } while (after && rows.length < DEBUG_MAX_ROWS);

  const limitHit = rows.length >= DEBUG_MAX_ROWS;

  let included = 0;
  let excludedByMarker = 0;
  let excludedBySearch = 0;
  const byMonth: Record<string, { total: number; included: number; excluded: number }> = {};

  for (const row of rows) {
    if (row.included) {
      included += 1;
    } else if (row.matchedBySearch) {
      excludedByMarker += 1;
    } else {
      excludedBySearch += 1;
    }

    let key = "sans-date";
    const date = row.startAt ? new Date(row.startAt) : null;
    if (date && !Number.isNaN(date.getTime())) {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    const bucket = byMonth[key] || { total: 0, included: 0, excluded: 0 };
    bucket.total += 1;
    if (row.included) bucket.included += 1;
    else bucket.excluded += 1;
    byMonth[key] = bucket;
  }

  return {
    ownerId: scope.ownerId || "",
    ownerEmail: scope.ownerEmail || "",
    marker: scope.marker,
    scanned: rows.length,
    limitHit,
    included,
    excluded: excludedByMarker + excludedBySearch,
    excludedByMarker,
    excludedBySearch,
    byMonth,
    rows,
  } satisfies MeetingDebugResult;
}