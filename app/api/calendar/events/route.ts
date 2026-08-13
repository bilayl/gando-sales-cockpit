import { NextRequest, NextResponse } from "next/server";
import { getGoogleCalendarEvents, isGoogleConfigured } from "@/lib/google";

export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.json({ error: "GOOGLE_UNCONFIGURED" }, { status: 501 });
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
    const start = request.nextUrl.searchParams.get("start");
    const end = request.nextUrl.searchParams.get("end");
    const timeMin = start ? new Date(start) : new Date(Date.now() - 7 * 86400000);
    const timeMax = end ? new Date(end) : new Date(Date.now() + 90 * 86400000);
    const data = await getGoogleCalendarEvents({ calendarId, timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() });
    return NextResponse.json(data);
  } catch (error) {
    const e = error as Error;
    if (e.message === "GOOGLE_UNAUTHORIZED") return NextResponse.json({ error: "GOOGLE_UNAUTHORIZED" }, { status: 401 });
    return NextResponse.json({ error: e.message || "Erreur Google Calendar" }, { status: 500 });
  }
}
