import { NextRequest, NextResponse } from "next/server";
import { consumeGoogleState, exchangeGoogleCode } from "@/lib/google";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  if (oauthError) return NextResponse.redirect(new URL("/agenda?error=Acc%C3%A8s%20Google%20refus%C3%A9", base));
  if (!code || !(await consumeGoogleState(state))) return NextResponse.redirect(new URL("/agenda?error=%C3%89tat%20invalide", base));
  try {
    await exchangeGoogleCode(code);
    return NextResponse.redirect(new URL("/agenda", base));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec de connexion Google";
    return NextResponse.redirect(new URL(`/agenda?error=${encodeURIComponent(message)}`, base));
  }
}
