import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAdmin } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gando_developer_docs_github_oauth_state";

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAdmin();

    const clientId = process.env.GITHUB_DOCS_CLIENT_ID?.trim();
    if (!clientId) {
      return NextResponse.redirect(new URL("/developer?github=oauth_missing", request.url));
    }

    const state = randomBytes(24).toString("hex");
    (await cookies()).set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
      priority: "high",
    });

    const callback = new URL("/api/developer-docs/github/callback", request.url);
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", callback.toString());
    authorize.searchParams.set("scope", "repo read:user");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("allow_signup", "false");

    return NextResponse.redirect(authorize);
  } catch {
    return NextResponse.redirect(new URL("/developer?github=unauthorized", request.url));
  }
}
