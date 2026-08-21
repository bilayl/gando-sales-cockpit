import { NextResponse } from "next/server";
import { createCockpitSession } from "@/lib/auth";
import { consumeHubSpotState, exchangeHubSpotCode, getHubSpotIdentity } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthError)}`, request.url));
  if (!code || !(await consumeHubSpotState(state))) {
    return NextResponse.redirect(new URL("/login?error=%C3%89tat%20OAuth%20invalide", request.url));
  }

  try {
    const callbackUrl = new URL("/api/auth/hubspot/callback", request.url).toString();
    await exchangeHubSpotCode(code, callbackUrl);

    const identity = await getHubSpotIdentity();
    const displayName = identity?.email
      || identity?.hubDomain
      || (identity?.hubId ? `HubSpot · ${identity.hubId}` : "Compte HubSpot");

    await createCockpitSession({
      email: identity?.email,
      displayName,
      provider: "hubspot",
    });

    return NextResponse.redirect(new URL("/prospection", request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec de la connexion HubSpot";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
  }
}
