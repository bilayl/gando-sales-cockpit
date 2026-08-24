import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildHubSpotAuthUrl,
  createHubSpotState,
  isHubSpotOAuthConfigured,
} from "@/lib/hubspot";

export const dynamic = "force-dynamic";

const RETURN_TO_COOKIE = "gando_hubspot_return_to";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedReturnTo = url.searchParams.get("returnTo");
  const returnTo = requestedReturnTo === "/settings" ? "/settings" : "";

  if (!isHubSpotOAuthConfigured()) {
    const destination = returnTo
      ? `${returnTo}?hubspot=not-configured`
      : "/login?error=Configuration%20OAuth%20HubSpot%20incompl%C3%A8te";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  const jar = await cookies();
  if (returnTo) {
    jar.set(RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  } else {
    jar.delete(RETURN_TO_COOKIE);
  }

  const state = await createHubSpotState();
  return NextResponse.redirect(buildHubSpotAuthUrl(state));
}
