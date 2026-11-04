import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getAircallAgentForEmail, getAircallStatus } from "@/lib/aircall";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await requireCockpitAccess();
    const status = await getAircallStatus();
    if (!status.connected) return NextResponse.json({ ...status, user: null, numbers: [] });
    const user = await getAircallAgentForEmail(access.email || "");
    return NextResponse.json({
      ...status,
      user: { id: user.id, email: user.email, name: user.name },
      numbers: (user.numbers || []).map(number => ({ id: number.id, name: number.name || number.digits || number.number || String(number.id), digits: number.digits || number.number || null })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de trouver votre profil Aircall" }, { status });
  }
}
