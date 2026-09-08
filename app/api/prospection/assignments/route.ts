import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { claimCockpitCompanies, listCockpitCompanyAssignments } from "@/lib/cockpit-company-assignment";
import { apiError } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCockpitAccess();
    return NextResponse.json({ results: await listCockpitCompanyAssignments() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    if (!access.email) return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const companyIds = (Array.isArray(body.companyIds) ? body.companyIds : []).map(String).slice(0, 500);
    const claimedCompanyIds = await claimCockpitCompanies(companyIds, access.email);
    return NextResponse.json({ claimedCompanyIds }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

