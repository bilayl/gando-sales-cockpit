import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
import { CONTACT_PROPERTIES } from "@/lib/hubspot/contacts";
import { TASK_PROPERTIES } from "@/lib/hubspot/tasks";

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
    const start = requestedStart.toISOString();
    const end = requestedEnd.toISOString();

    const [meetingsResult, tasksResult, remindersResult] = await Promise.allSettled([
      hubspotJson("/crm/objects/2026-03/meetings/search", {
        method: "POST",
        body: JSON.stringify({
          limit: 200,
          properties: ["hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome", "hubspot_owner_id", "hs_timestamp"],
          sorts: [{ propertyName: "hs_meeting_start_time", direction: "ASCENDING" }],
          filterGroups: [{ filters: [
            { propertyName: "hs_meeting_start_time", operator: "GTE", value: start },
            { propertyName: "hs_meeting_start_time", operator: "LT", value: end },
          ] }],
        }),
      }),
      hubspotJson("/crm/objects/2026-03/tasks/search", {
        method: "POST",
        body: JSON.stringify({
          limit: 200,
          properties: TASK_PROPERTIES,
          sorts: [{ propertyName: "hs_timestamp", direction: "ASCENDING" }],
          filterGroups: [{ filters: [
            { propertyName: "hs_timestamp", operator: "GTE", value: start },
            { propertyName: "hs_timestamp", operator: "LT", value: end },
            { propertyName: "hs_task_status", operator: "NOT_IN", values: ["COMPLETED"] },
          ] }],
        }),
      }),
      hubspotJson("/crm/objects/2026-03/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          limit: 200,
          properties: CONTACT_PROPERTIES,
          sorts: [{ propertyName: "date_prochaine_relance", direction: "ASCENDING" }],
          filterGroups: [{ filters: [
            { propertyName: "date_prochaine_relance", operator: "GTE", value: start },
            { propertyName: "date_prochaine_relance", operator: "LT", value: end },
          ] }],
        }),
      }),
    ]);

    const meetings = meetingsResult.status === "fulfilled" ? meetingsResult.value : { results: [] };
    const tasks = tasksResult.status === "fulfilled" ? tasksResult.value.results || [] : [];
    const reminders = remindersResult.status === "fulfilled" ? remindersResult.value.results || [] : [];
    const warnings = [
      meetingsResult.status === "rejected" ? "meetings" : null,
      tasksResult.status === "rejected" ? "tasks" : null,
      remindersResult.status === "rejected" ? "reminders" : null,
    ].filter(Boolean);

    return NextResponse.json({ ...meetings, tasks, reminders, warnings });
  } catch (error) {
    return apiError(error);
  }
}
