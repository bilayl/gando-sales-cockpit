import { NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getOnoffDirectApiStatus } from "@/lib/onoff";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getCockpitAccess();
  if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const status = await getOnoffDirectApiStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Onoff direct API status failed", error);
    return NextResponse.json(
      {
        configured: false,
        connected: false,
        source: "onoff_api",
        error: error instanceof Error ? error.message : "Impossible de vérifier l’API Onoff.",
      },
      { status: 502 },
    );
  }
}
