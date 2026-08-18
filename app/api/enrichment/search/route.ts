import { NextRequest, NextResponse } from "next/server";
import { enrichmentAuthHeaders, enrichmentBackendUrl } from "@/lib/enrichment-auth";
import { dedupeSourcingCandidates, listHubSpotCompaniesForSourcing, type SourcingProspect } from "@/lib/enrichment-dedup";
import { searchRentalCompaniesLocally } from "@/lib/enrichment-local-search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
    const minConfidence = Math.min(Math.max(Number(input.minConfidence) || 0.65, 0), 1);
    const body = {
      query: typeof input.query === "string" ? input.query.slice(0, 600) : "",
      territories: Array.isArray(input.territories) ? input.territories.map(String).slice(0, 12) : undefined,
      sources: Array.isArray(input.sources) ? input.sources.map(String).slice(0, 12) : undefined,
      limit,
      minConfidence,
    };

    const companiesPromise = listHubSpotCompaniesForSourcing();
    const authHeaders = await enrichmentAuthHeaders();
    let payload: any = null;
    let source = "backend";
    let backendError: string | null = null;

    if (Object.keys(authHeaders).length) {
      try {
        const response = await fetch(`${enrichmentBackendUrl()}/api/search/rental-companies`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
        const upstream = await response.json().catch(() => ({ error: `Backend sourcing: HTTP ${response.status}` }));
        if (response.ok) {
          payload = upstream;
        } else {
          backendError = upstream.error || upstream.message || `HTTP ${response.status}`;
        }
      } catch (error) {
        backendError = error instanceof Error ? error.message : "Backend sourcing indisponible";
      }
    } else {
      backendError = "Aucune identité inter-projets disponible";
    }

    if (!payload) {
      source = "cockpit-fallback";
      payload = await searchRentalCompaniesLocally(body);
    }

    const companies = await companiesPromise;
    const candidates = (Array.isArray(payload.prospects) ? payload.prospects : []) as SourcingProspect[];
    const deduped = dedupeSourcingCandidates(candidates, companies, limit, minConfidence);

    return NextResponse.json({
      searchId: payload.searchId || crypto.randomUUID(),
      searchedAt: payload.searchedAt || new Date().toISOString(),
      candidatesFound: Number(payload.candidatesFound ?? candidates.length),
      uniqueCandidates: deduped.unique.length,
      hubspotCompaniesChecked: companies.length,
      excludedFromHubspot: deduped.excluded.length,
      newProspects: deduped.prospects.length,
      prospects: deduped.prospects,
      excluded: deduped.excluded,
      source,
      backendError: source === "backend" ? null : backendError,
    }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.name === "TimeoutError" ? "La recherche a dépassé le délai maximum. Réduisez la limite ou les territoires." : error.message
      : "Erreur de sourcing";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
