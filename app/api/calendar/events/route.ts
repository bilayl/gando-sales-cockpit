import { NextRequest, NextResponse } from "next/server";
import { createGoogleCalendarEvent, getGoogleCalendarEvents, isGoogleConfigured } from "@/lib/google";

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


export async function POST(request: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.json({ error: "GOOGLE_UNCONFIGURED" }, { status: 501 });

  try {
    const body = await request.json();
    const summary = String(body.summary || "").trim();
    const description = String(body.description || "").trim();
    const start = new Date(String(body.start || ""));
    const durationMinutes = Math.min(240, Math.max(15, Number(body.durationMinutes || 30)));

    if (!summary) return NextResponse.json({ error: "Le titre est obligatoire" }, { status: 400 });
    if (Number.isNaN(start.getTime())) return NextResponse.json({ error: "Date de calendrier invalide" }, { status: 400 });

    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const calendarId = process.env.GOOGLE_SHARED_CALENDAR_ID
      || process.env.GOOGLE_CALENDAR_ID
      || "sales@gando.app";

    const event = await createGoogleCalendarEvent({
      calendarId,
      summary,
      description: description || undefined,
      start: start.toISOString(),
      end: end.toISOString(),
    });

    return NextResponse.json({ event, calendarId }, { status: 201 });
  } catch (error) {
    const e = error as Error & { status?: number };
    const status = e.message === "GOOGLE_UNAUTHORIZED" ? 401 : e.status || 500;
    return NextResponse.json({ error: e.message || "Impossible de créer l’événement Google Calendar" }, { status });
  }
}
