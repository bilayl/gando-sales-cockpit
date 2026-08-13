import { NextResponse } from "next/server";
import { clearHubSpotSession } from "@/lib/hubspot";

export async function POST(request: Request) {
  await clearHubSpotSession();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
