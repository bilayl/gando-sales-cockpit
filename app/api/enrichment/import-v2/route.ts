import { NextRequest, NextResponse } from "next/server";
import { enrichmentAuthHeaders, enrichmentBackendUrl } from "@/lib/enrichment-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const prospects = Array.isArray(input.prospects) ? input.prospects.slice(0, 50) : [];
    if (!prospects.length) {
      return NextResponse.json({ error: "Sélectionnez au moins une entreprise." }, { status: 400 });
    }

    const authHeaders = await enrichmentAuthHeaders();
    if (!Object.keys(authHeaders).length) {
      throw new Error("Authentification du backend d'enrichissement absente");
    }

    const response = await fetch(`${enrichmentBackendUrl()}/api/hubspot/companies/import`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        prospects,
        maxContactsPerCompany: Math.min(Math.max(Number(input.maxContactsPerCompany) || 5, 1), 5),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(110_000),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Backend d'enrichissement HTTP ${response.status}`);
    }

    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur d'import sourcing" }, { status: 502 });
  }
}
