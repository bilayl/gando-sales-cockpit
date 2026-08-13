import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, createGoogleState } from "@/lib/google";

export async function GET() {
  try {
    const state = await createGoogleState();
    return NextResponse.redirect(buildGoogleAuthUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuration Google invalide";
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(new URL(`/agenda?error=${encodeURIComponent(message)}`, base));
  }
}
