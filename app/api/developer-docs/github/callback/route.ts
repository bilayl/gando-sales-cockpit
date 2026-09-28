import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAdmin } from "@/lib/cockpit-access";
import {
  getDeveloperDocsConnection,
  saveDeveloperDocsConnection,
} from "@/lib/developer-docs-github";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gando_developer_docs_github_oauth_state";

export async function GET(request: NextRequest) {
  const target = new URL("/developer", request.url);

  try {
    await requireCockpitAdmin();

    const clientId = process.env.GITHUB_DOCS_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_DOCS_CLIENT_SECRET?.trim();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(STATE_COOKIE)?.value;
    cookieStore.delete(STATE_COOKIE);

    if (!clientId || !clientSecret) {
      target.searchParams.set("github", "oauth_missing");
      return NextResponse.redirect(target);
    }
    if (!code || !state || !expectedState || state !== expectedState) {
      target.searchParams.set("github", "state_error");
      return NextResponse.redirect(target);
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "gando-sales-cockpit",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: new URL("/api/developer-docs/github/callback", request.url).toString(),
      }),
      cache: "no-store",
    });

    const tokenBody = await tokenResponse.json().catch(() => ({})) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || !tokenBody.access_token) {
      target.searchParams.set("github", tokenBody.error || "oauth_error");
      return NextResponse.redirect(target);
    }

    const current = await getDeveloperDocsConnection();
    await saveDeveloperDocsConnection({
      owner: current.owner,
      repo: current.repo,
      branch: current.branch,
      basePath: current.basePath,
      token: tokenBody.access_token,
    });

    target.searchParams.set("github", "connected");
    return NextResponse.redirect(target);
  } catch (error) {
    console.error("GitHub OAuth callback failed", error);
    target.searchParams.set("github", "oauth_error");
    return NextResponse.redirect(target);
  }
}
