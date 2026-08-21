import { NextResponse } from "next/server";
import { getCockpitSession } from "@/lib/auth";

export async function GET() {
  const session = await getCockpitSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, ...session });
}
