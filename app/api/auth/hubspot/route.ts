import { NextResponse } from "next/server";
import { buildHubSpotAuthUrl, createHubSpotState, isHubSpotOAuthConfigured } from "@/lib/hubspot";

export async function GET(request: Request) {
  if (!isHubSpotOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=Configuration%20OAuth%20HubSpot%20incompl%C3%A8te", request.url));
  }

  const configured = process.env.HUBSPOT_REDIRECT_URI?.trim();
  let configuredHost = "";
  try {
    configuredHost = configured ? new URL(configured).host : "";
  } catch {
    configuredHost = "";
  }
  const requestHost = new URL(request.url).host;
  if (configuredHost && configuredHost !== requestHost) {
    const message = `La Redirect URI configurée (${configuredHost}) ne correspond pas au domaine actuel (${requestHost}). Mettez à jour HUBSPOT_REDIRECT_URI (Vercel) et la Redirect URL de l’app HubSpot : ${requestHost}/api/auth/hubspot/callback`;
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
  }

  const state = await createHubSpotState();
  return NextResponse.redirect(buildHubSpotAuthUrl(state));
}
