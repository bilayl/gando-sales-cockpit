import { NextResponse } from "next/server";
import { getOpenRouterSalesStatus } from "@/lib/openrouter-key";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const openRouter = await getOpenRouterSalesStatus();
  return NextResponse.json({
    configured: openRouter.configured,
    keySource: openRouter.source,
    model: openRouter.model,
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelTargetEnv: process.env.VERCEL_TARGET_ENV || null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
  }, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
