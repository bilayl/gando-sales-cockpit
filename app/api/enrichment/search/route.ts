import { NextRequest, NextResponse } from "next/server";
import { dedupeSourcingCandidates, listHubSpotCompaniesForSourcing, type SourcingProspect } from "@/lib/enrichment-dedup";
import { searchRentalCompaniesLocally } from "@/lib/enrichment-local-search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCING_ENGINE = "openrouter-direct-v3";

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

    const [payload, companies] = await Promise.all([
      searchRentalCompaniesLocally(body),
      listHubSpotCompaniesForSourcing(),
    ]);

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
      source: "openrouter-direct",
      sourcingEngine: SOURCING_ENGINE,
      backendError: null,
    }, {
      headers: {
        "cache-control": "no-store",
        "x-gando-sourcing-engine": SOURCING_ENGINE,
      },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.name === "TimeoutError" ? "La recherche a dépassé le délai maximum. Réduisez la limite ou les territoires." : error.message
      : "Erreur de sourcing";
    return NextResponse.json({ error: message, sourcingEngine: SOURCING_ENGINE }, {
      status: 502,
      headers: {
        "cache-control": "no-store",
        "x-gando-sourcing-engine": SOURCING_ENGINE,
      },
    });
  }
}
