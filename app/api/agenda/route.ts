import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
import { getBrevoMeetingScope } from "@/lib/hubspot/brevo";
import { readGoogleMeetingsForPeriod } from "@/lib/hubspot/meetings";
import { GCAL_SYNC_SOURCE } from "@/lib/gcal-status";
import { CONTACT_PROPERTIES } from "@/lib/hubspot/contacts";
import { TASK_PROPERTIES } from "@/lib/hubspot/tasks";

const MAX_RANGE_DAYS = 31;

type SearchBody = Record<string, unknown>;
type SearchRecord = { id: string; properties?: Record<string, string | null | undefined> };

async function searchAll(path: string, body: SearchBody) {
  const results: SearchRecord[] = [];
  let after: string | undefined;

  do {
    const page = await hubspotJson(path, {
      method: "POST",
      body: JSON.stringify({ ...body, limit: 200, ...(after ? { after } : {}) }),
    });
    results.push(...((page.results || []) as SearchRecord[]));
    after = page.paging?.next?.after;
  } while (after && results.length < 1_000);

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 1);
    const defaultEnd = new Date(now);
    defaultEnd.setDate(defaultEnd.getDate() + 14);
    const requestedStart = new Date(request.nextUrl.searchParams.get("start") || defaultStart.toISOString());
    const requestedEnd = new Date(request.nextUrl.searchParams.get("end") || defaultEnd.toISOString());

    if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime()) || requestedStart >= requestedEnd) {
      return NextResponse.json({ error: "Période d’agenda invalide" }, { status: 400 });
    }

    if (requestedEnd.getTime() - requestedStart.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60_000) {
      return NextResponse.json({ error: `La période est limitée à ${MAX_RANGE_DAYS} jours` }, { status: 400 });
    }

const [meetingsResult, tasksResult, remindersResult] = await Promise.allSettled([
      searchAll("/crm/objects/2026-03/meetings/search", {
        properties: [
          "hs_meeting_title",
          "hs_meeting_start_time",
          "hs_meeting_end_time",
          "hs_meeting_outcome",
          "hs_meeting_location",
          "hs_meeting_body",
          "hs_meeting_source",
          "hubspot_owner_id",
          "hs_timestamp",
        ],
        sorts: [{ propertyName: "hs_meeting_start_time", direction: "ASCENDING" }],
        filterGroups: [{ filters: [
          { propertyName: "hs_meeting_start_time", operator: "GTE", value: requestedStart.toISOString() },
          { propertyName: "hs_meeting_start_time", operator: "LT", value: requestedEnd.toISOString() },
        ] }],
      }),
      searchAll("/crm/objects/2026-03/tasks/search", {
        properties: TASK_PROPERTIES,
        sorts: [{ propertyName: "hs_timestamp", direction: "ASCENDING" }],
        filterGroups: [{ filters: [
          { propertyName: "hs_timestamp", operator: "GTE", value: requestedStart.toISOString() },
          { propertyName: "hs_timestamp", operator: "LT", value: requestedEnd.toISOString() },
        ] }],
      }),
      searchAll("/crm/objects/2026-03/contacts/search", {
        properties: CONTACT_PROPERTIES,
        sorts: [{ propertyName: "date_prochaine_relance", direction: "ASCENDING" }],
        filterGroups: [{ filters: [
          { propertyName: "date_prochaine_relance", operator: "GTE", value: requestedStart.toISOString() },
          { propertyName: "date_prochaine_relance", operator: "LT", value: requestedEnd.toISOString() },
        ] }],
      }),
    ]);

    const meetings = (meetingsResult.status === "fulfilled" ? meetingsResult.value : []).filter(row => row.properties?.hs_meeting_source !== GCAL_SYNC_SOURCE);
    const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
    const sourceScope = await getBrevoMeetingScope();
    const reminders = remindersResult.status === "fulfilled" ? remindersResult.value : [];
    const googleMeetings = await readGoogleMeetingsForPeriod(requestedStart, requestedEnd);
    const results = [...meetings, ...googleMeetings];
    const completedTasks = tasks.filter(task => task.properties?.hs_task_status === "COMPLETED").length;
    const warnings = [
      meetingsResult.status === "rejected" ? "meetings" : null,
      tasksResult.status === "rejected" ? "tasks" : null,
      remindersResult.status === "rejected" ? "reminders" : null,
    ].filter(Boolean);

    return NextResponse.json({
      results,
      tasks,
      reminders,
      total: results.length,
      source: "brevo",
      sourceMarker: sourceScope.marker,
      sourceScope,
      stats: {
        meetings: results.length,
        tasks: tasks.length,
        completedTasks,
        reminders: reminders.length,
        total: results.length + (tasks.length - completedTasks) + reminders.length,
      },
      warnings,
    });
  } catch (error) {
    return apiError(error);
  }
}
