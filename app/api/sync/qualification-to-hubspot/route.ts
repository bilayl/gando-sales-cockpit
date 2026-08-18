import { NextRequest, NextResponse } from "next/server";
import { pushCompanyQualificationsToHubSpot, refreshCompanyQualifications } from "@/lib/company-qualification-sync";
import { syncCompanies } from "@/lib/sync";
import { apiError, isHubSpotAuthenticated } from "@/lib/hubspot";

export const maxDuration = 300;

// Dedicated server-side backfill endpoint. It refreshes Companies from HubSpot,
// recalculates the consolidated Company qualification in Supabase, then pushes
// only properties that differ back to HubSpot.
export async function POST(request: NextRequest) {
  try {
    const expectedCronSecret = process.env.CRON_SECRET?.trim();
    if (expectedCronSecret) {
      const authorization = request.headers.get("authorization") ?? "";
      if (authorization !== `Bearer ${expectedCronSecret}`) {
        return NextResponse.json({ error: "UNAUTHORIZED", message: "Secret cron invalide." }, { status: 401 });
      }
    } else if (!(await isHubSpotAuthenticated())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
    }

    const companies = await syncCompanies();
    const qualification = await refreshCompanyQualifications();
    const hubspot = await pushCompanyQualificationsToHubSpot();
    return NextResponse.json({ ok: true, companies, qualification, hubspot });
  } catch (error) {
    return apiError(error);
  }
}
