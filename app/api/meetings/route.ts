import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getMeetingsCockpit, type MeetingView } from "@/lib/hubspot/meetings";

const VIEWS = new Set<MeetingView>([
  "all",
  "today",
  "upcoming",
  "completed",
  "no_show",
  "canceled",
  "rescheduled",
  "no_next_action",
  "presentation",
]);

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const requestedView = url.searchParams.get("view") as MeetingView | null;
    const view = requestedView && VIEWS.has(requestedView) ? requestedView : "all";
    const data = await getMeetingsCockpit({
      view,
      owner: url.searchParams.get("owner")?.trim() || undefined,
      query: url.searchParams.get("query")?.trim() || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error);
  }
}
