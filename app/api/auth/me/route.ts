import { NextResponse } from "next/server";
import { getHubSpotIdentity } from "@/lib/hubspot";

export async function GET() {
  const identity = await getHubSpotIdentity();
  if (!identity) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, ...identity });
}
