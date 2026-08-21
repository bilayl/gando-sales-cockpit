import { NextResponse } from "next/server";
import { clearCockpitSession } from "@/lib/auth";
import { clearHubSpotSession } from "@/lib/hubspot";

export async function POST(request: Request) {
  await Promise.all([
    clearCockpitSession(),
    clearHubSpotSession(),
  ]);
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
