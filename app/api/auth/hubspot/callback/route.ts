import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCockpitSession, getCockpitSession } from "@/lib/auth";
import { consumeHubSpotState, exchangeHubSpotCode, getHubSpotIdentity } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

const RETURN_TO_COOKIE = "gando_hubspot_return_to";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const returnTo = jar.get(RETURN_TO_COOKIE)?.value === "/settings" ? "/settings" : "";
  jar.delete(RETURN_TO_COOKIE);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    const destination = returnTo
      ? `${returnTo}?hubspot=error`
      : `/login?error=${encodeURIComponent(oauthError)}`;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (!code || !(await consumeHubSpotState(state))) {
    const destination = returnTo
      ? `${returnTo}?hubspot=error`
      : "/login?error=%C3%89tat%20OAuth%20invalide";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  try {
    const existingCockpitSession = await getCockpitSession();
    const callbackUrl = new URL("/api/auth/hubspot/callback", request.url).toString();
    await exchangeHubSpotCode(code, callbackUrl);

    if (!existingCockpitSession) {
      const identity = await getHubSpotIdentity();
      const displayName = identity?.email
        || identity?.hubDomain
        || (identity?.hubId ? `HubSpot · ${identity.hubId}` : "Compte HubSpot");

      await createCockpitSession({
        email: identity?.email,
        displayName,
        provider: "hubspot",
      });
    }

    const destination = returnTo ? `${returnTo}?hubspot=reconnected` : "/prospection";
    return NextResponse.redirect(new URL(destination, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec de la connexion HubSpot";
    const destination = returnTo
      ? `${returnTo}?hubspot=error`
      : `/login?error=${encodeURIComponent(message)}`;
    return NextResponse.redirect(new URL(destination, request.url));
  }
}
