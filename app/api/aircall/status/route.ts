import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getAircallStatus } from "@/lib/aircall";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCockpitAccess();
    return NextResponse.json(await getAircallStatus(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur Aircall" }, { status });
  }
}
