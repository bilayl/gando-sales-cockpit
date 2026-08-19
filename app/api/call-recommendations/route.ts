import { NextRequest, NextResponse } from "next/server";
import { getCallRecommendations } from "@/lib/call-recommendations";
import { apiError, isHubSpotAuthenticated } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (!(await isHubSpotAuthenticated())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
    }
    const url = new URL(request.url);
    const rawBucket = url.searchParams.get("bucket") || "ACTIONABLE";
    const bucket = ["ACTIONABLE", "OPPORTUNITY", "SNOOZED", "EXCLUDED", "ALL"].includes(rawBucket)
      ? rawBucket as "ACTIONABLE" | "OPPORTUNITY" | "SNOOZED" | "EXCLUDED" | "ALL"
      : "ACTIONABLE";
    const owner = url.searchParams.get("owner") || undefined;
    const query = url.searchParams.get("q") || undefined;
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const limit = Number(url.searchParams.get("limit") || 1000);

    const data = await getCallRecommendations({ bucket, owner, query, limit, forceRefresh });
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
