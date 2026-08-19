import { NextRequest, NextResponse } from "next/server";
import { dedupeSourcingCandidates, listHubSpotCompaniesForSourcing, type SourcingProspect } from "@/lib/enrichment-dedup";
import { enrichmentAuthHeaders, enrichmentBackendUrl } from "@/lib/enrichment-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SOURCING_ENGINE = "enrichment-backend-inpi-v1";

type EnrichmentPayload = {
  searchId?: string;
  searchedAt?: string;
  candidatesFound?: number;
  uniqueCandidates?: number;
  prospects?: SourcingProspect[];
  inpi?: {
    configured?: boolean;
    verified?: number;
    notFound?: number;
    errors?: number;
    excludedCommercialOptOutOrNonDiffusible?: number;
  };
  error?: string;
};

async function searchThroughEnrichmentBackend(body: Record<string, unknown>) {
  const authHeaders = await enrichmentAuthHeaders();
  if (!Object.keys(authHeaders).length) {
    throw new Error("Authentification du backend d'enrichissement absente");
  }

  const response = await fetch(`${enrichmentBackendUrl()}/api/search/rental-companies`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(110_000),
  });

  const raw = await response.text();
  let payload: EnrichmentPayload;
  try {
    payload = raw ? JSON.parse(raw) as EnrichmentPayload : {};
  } catch {
    throw new Error(`Le backend d'enrichissement a renvoyé une réponse JSON invalide (HTTP ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(payload.error || `Backend d'enrichissement HTTP ${response.status}`);
  }

  return payload;
}

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
      searchThroughEnrichmentBackend(body),
      listHubSpotCompaniesForSourcing(),
    ]);

    const candidates = (Array.isArray(payload.prospects) ? payload.prospects : []) as SourcingProspect[];
    const deduped = dedupeSourcingCandidates(candidates, companies, limit, minConfidence);

    return NextResponse.json({
      searchId: payload.searchId || crypto.randomUUID(),
      searchedAt: payload.searchedAt || new Date().toISOString(),
      candidatesFound: Number(payload.candidatesFound ?? candidates.length),
      backendUniqueCandidates: Number(payload.uniqueCandidates ?? candidates.length),
      uniqueCandidates: deduped.unique.length,
      hubspotCompaniesChecked: companies.length,
      excludedFromHubspot: deduped.excluded.length,
      newProspects: deduped.prospects.length,
      prospects: deduped.prospects,
      excluded: deduped.excluded,
      inpi: payload.inpi || null,
      source: "gando-enrichment-backend",
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
      ? error.name === "TimeoutError"
        ? "La recherche a dépassé le délai maximum du backend d'enrichissement."
        : error.message
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
