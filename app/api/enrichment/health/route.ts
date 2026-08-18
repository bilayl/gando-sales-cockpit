import { NextResponse } from "next/server";
import { enrichmentAuthHeaders, enrichmentBackendUrl, hasEnrichmentAuth } from "@/lib/enrichment-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!hasEnrichmentAuth()) {
      return NextResponse.json({ ok: false, error: "ENRICHMENT_AUTH_MISSING" }, { status: 503 });
    }

    const response = await fetch(`${enrichmentBackendUrl()}/api/internal/health`, {
      headers: enrichmentAuthHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    return NextResponse.json({ ...payload, upstreamStatus: response.status }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Enrichment backend unavailable",
    }, { status: 502 });
  }
}
