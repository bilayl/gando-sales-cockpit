import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { analyzeBrevoMeetings } from "@/lib/hubspot/debug";

const MAX_RANGE_DAYS = 370;

export async function GET(request: NextRequest) {
  try {
    const startParam = request.nextUrl.searchParams.get("start");
    const endParam = request.nextUrl.searchParams.get("end");
    const start = startParam ? new Date(startParam) : null;
    const end = endParam ? new Date(endParam) : null;

    if ((startParam && (!start || Number.isNaN(start.getTime()))) || (endParam && (!end || Number.isNaN(end.getTime())))) {
      return NextResponse.json({ error: "Période de diagnostic invalide" }, { status: 400 });
    }
    if (start && end && start >= end) {
      return NextResponse.json({ error: "Période de diagnostic invalide" }, { status: 400 });
    }
    if (start && end && end.getTime() - start.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60_000) {
      return NextResponse.json({ error: `La période de diagnostic est limitée à ${MAX_RANGE_DAYS} jours` }, { status: 400 });
    }

    const data = await analyzeBrevoMeetings({ start: start || undefined, end: end || undefined });
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error);
  }
}