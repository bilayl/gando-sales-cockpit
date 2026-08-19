import { NextResponse } from "next/server";
import {
  buildHubSpotAuthUrl,
  createHubSpotState,
  isHubSpotAuthenticated,
  isHubSpotOAuthConfigured,
} from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Production can already be authenticated through the secure server-side
  // HubSpot token stored in Supabase Vault. In that case, never send the user
  // through the OAuth install screen again: go straight to the cockpit.
  if (await isHubSpotAuthenticated()) {
    return NextResponse.redirect(new URL("/prospection", request.url));
  }

  if (!isHubSpotOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=Configuration%20OAuth%20HubSpot%20incompl%C3%A8te", request.url));
  }

  const callbackUrl = new URL("/api/auth/hubspot/callback", request.url).toString();
  const state = await createHubSpotState();
  return NextResponse.redirect(buildHubSpotAuthUrl(state, callbackUrl));
}
