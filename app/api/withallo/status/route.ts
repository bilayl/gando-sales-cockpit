import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getWithAlloStatus, listWithAlloNumbers } from "@/lib/withallo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCockpitAccess();
    const status = await getWithAlloStatus();
    const numbers = status.connected ? await listWithAlloNumbers().catch(() => []) : [];
    return NextResponse.json({ ...status, numbers }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Allo indisponible" }, { status });
  }
}
