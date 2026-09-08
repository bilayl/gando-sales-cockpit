import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getCallRecommendations } from "@/lib/call-recommendations";
import { getBestCallTimeForProperties } from "@/lib/call-timing";
import { listCockpitCompanyAssignments } from "@/lib/cockpit-company-assignment";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await requireCockpitAccess();
    const email = String(access.email || "").trim().toLowerCase();
    const recommendations = await getCallRecommendations({ bucket: "ACTIONABLE", limit: 2000 });
    const now = new Date();

    const timed = recommendations.results.map(contact => {
      const timing = getBestCallTimeForProperties(contact.properties, now);
      return {
        ...contact,
        properties: {
          ...contact.properties,
          db_call_local_time: timing.localTime,
          db_call_timezone: timing.timezone,
          db_call_timing_reason: timing.reason,
          db_call_now: timing.callNow ? "true" : "false",
        },
        timing,
      };
    });

    const companyIds = [...new Set(timed
      .map(contact => String(contact.properties.db_company_id || ""))
      .filter(Boolean))];
    const assignments = await listCockpitCompanyAssignments(companyIds);
    const assignmentByCompany = new Map(assignments.map(row => [
      String(row.company_id),
      String(row.assignee_cockpit_email || "").trim().toLowerCase(),
    ]));

    const callable = timed
      .filter(contact => contact.timing.callNow)
      .map(contact => {
        const companyId = String(contact.properties.db_company_id || "");
        const assignee = companyId ? assignmentByCompany.get(companyId) || null : null;
        const ownership = assignee === email ? "MINE" : assignee ? "OTHER" : "UNASSIGNED";
        return { ...contact, ownership, assignee };
      });

    const mine = callable
      .filter(contact => contact.ownership === "MINE")
      .sort((a, b) => Number(b.properties.db_call_score || 0) - Number(a.properties.db_call_score || 0));
    const available = callable
      .filter(contact => contact.ownership === "UNASSIGNED")
      .sort((a, b) => Number(b.properties.db_call_score || 0) - Number(a.properties.db_call_score || 0));

    return NextResponse.json({
      member: { email, role: access.role, displayName: access.displayName || null },
      results: [...mine, ...available].slice(0, 250),
      mineCount: mine.length,
      availableCount: available.length,
      callableCount: callable.length,
      totalActionable: recommendations.summary.ACTIONABLE,
      callWindow: "08:00–19:00",
      generatedAt: now.toISOString(),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les appels du jour." }, { status });
  }
}
