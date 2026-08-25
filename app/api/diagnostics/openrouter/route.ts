import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    openrouterApiKeyPresent: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    openrouterModelPresent: Boolean(process.env.OPENROUTER_MODEL?.trim()),
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelTargetEnv: process.env.VERCEL_TARGET_ENV || null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
  }, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
