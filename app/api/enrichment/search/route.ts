import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function config() {
  const baseUrl = (process.env.ENRICHMENT_BACKEND_URL || process.env.GANDO_ENRICHMENT_BACKEND_URL || "").replace(/\/$/, "");
  const apiKey = process.env.ENRICHMENT_INTERNAL_API_KEY || process.env.GANDO_ENRICHMENT_API_KEY || "";
  return { baseUrl, apiKey };
}

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey } = config();
    if (!baseUrl || !apiKey) {
      return NextResponse.json({
        error: "Le backend de sourcing n'est pas configuré sur le Sales Cockpit.",
        code: "ENRICHMENT_NOT_CONFIGURED",
      }, { status: 503 });
    }

    const input = await request.json().catch(() => ({}));
    const body = {
      query: typeof input.query === "string" ? input.query.slice(0, 600) : "",
      territories: Array.isArray(input.territories) ? input.territories.map(String).slice(0, 12) : undefined,
      sources: Array.isArray(input.sources) ? input.sources.map(String).slice(0, 12) : undefined,
      limit: Math.min(Math.max(Number(input.limit) || 20, 1), 50),
      minConfidence: Math.min(Math.max(Number(input.minConfidence) || 0.65, 0), 1),
    };

    const response = await fetch(`${baseUrl}/api/search/rental-companies`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gando-api-key": apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(58_000),
    });

    const payload = await response.json().catch(() => ({ error: `Backend sourcing: HTTP ${response.status}` }));
    if (!response.ok) {
      return NextResponse.json({
        error: payload.error || payload.message || "Le backend de sourcing a rejeté la recherche.",
        upstreamStatus: response.status,
      }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
    }

    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.name === "TimeoutError" ? "La recherche a dépassé le délai maximum. Réduisez la limite ou les territoires." : error.message
      : "Erreur de sourcing";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
