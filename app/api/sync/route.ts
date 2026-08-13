import { NextRequest, NextResponse } from "next/server";
import { syncAll, syncActivities, syncCompanies, syncContacts, syncDeals, syncTasks } from "@/lib/sync";
import { apiError, isHubSpotAuthenticated } from "@/lib/hubspot";

export async function GET(request: NextRequest) {
  try {
    if (!(await isHubSpotAuthenticated())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
    }
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "all";
    let results: Record<string, unknown>;
    switch (resource) {
      case "companies": results = { companies: await syncCompanies() }; break;
      case "contacts": results = { contacts: await syncContacts() }; break;
      case "deals": results = { deals: await syncDeals() }; break;
      case "tasks": results = { tasks: await syncTasks() }; break;
      case "activities": results = { activities: await syncActivities() }; break;
      case "all": results = await syncAll(); break;
      default:
        return NextResponse.json({ error: `Ressource inconnue: ${resource}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) { return apiError(error); }
}
