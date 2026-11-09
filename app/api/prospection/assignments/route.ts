import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { listCockpitCompanyAssignments } from "@/lib/cockpit-company-assignment";
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

// Legacy company claiming has been retired: SDR ownership belongs to contacts.
export async function POST() {
  try {
    await requireCockpitAccess();
    return NextResponse.json({
      error: "Attribution automatique d'entreprises désactivée. Attribuez le contact manuellement dans CRM → Contacts.",
    }, { status: 410 });
  } catch (error) {
    return apiError(error);
  }
}
