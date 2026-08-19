import { NextRequest, NextResponse } from "next/server";
import { syncActivities, syncCompanies, syncContacts, syncDeals, syncTasks } from "@/lib/sync";
import { refreshCompanyQualifications, syncCompanyContactLinks } from "@/lib/company-qualification-sync";
import { refreshCallRecommendations } from "@/lib/call-recommendations";
import { apiError, isHubSpotAuthenticated } from "@/lib/hubspot";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "all";
    let results: Record<string, unknown>;

    switch (resource) {
      case "companies":
        results = { companies: await syncCompanies(), qualification: await refreshCompanyQualifications() };
        break;
      case "contacts":
        results = {
          contacts: await syncContacts(),
          associations: await syncCompanyContactLinks(),
          qualification: await refreshCompanyQualifications(),
        };
        break;
      case "deals":
        results = { deals: await syncDeals(), qualification: await refreshCompanyQualifications() };
        break;
      case "tasks":
        results = { tasks: await syncTasks(), qualification: await refreshCompanyQualifications() };
        break;
      case "activities":
        results = { activities: await syncActivities(), qualification: await refreshCompanyQualifications() };
        break;
      case "qualification":
        results = { associations: await syncCompanyContactLinks(), qualification: await refreshCompanyQualifications() };
        break;
      case "all": {
        const companies = await syncCompanies();
        const contacts = await syncContacts();
        const associations = await syncCompanyContactLinks();
        const deals = await syncDeals();
        const tasks = await syncTasks();
        const activities = await syncActivities();
        const qualification = await refreshCompanyQualifications();
        results = { companies, contacts, associations, deals, tasks, activities, qualification };
        break;
      }
      default:
        return NextResponse.json({ error: `Ressource inconnue: ${resource}` }, { status: 400 });
    }

    const recommendations = await refreshCallRecommendations();
    return NextResponse.json({ ok: true, results: { ...results, recommendations } });
  } catch (error) { return apiError(error); }
}
