import { NextResponse } from "next/server";
import { buildHubSpotAuthUrl, createHubSpotState, isHubSpotOAuthConfigured } from "@/lib/hubspot";

export async function GET(request: Request) {
  if (!isHubSpotOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=Configuration%20OAuth%20HubSpot%20incompl%C3%A8te", request.url));
  }
  const state = await createHubSpotState();
  return NextResponse.redirect(buildHubSpotAuthUrl(state));
}
