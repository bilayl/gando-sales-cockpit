import { NextRequest, NextResponse } from "next/server";
import { dedupeSourcingCandidates, listHubSpotCompaniesForSourcing, type SourcingProspect } from "@/lib/enrichment-dedup";
import { enrichmentAuthHeaders, enrichmentBackendUrl } from "@/lib/enrichment-auth";
import { searchRentalCompaniesLocally } from "@/lib/enrichment-local-search";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BACKEND_ENGINE = "enrichment-backend-inpi-v2-errors";
const FALLBACK_ENGINE = "openrouter-direct-fallback-v1";

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
  error?: unknown;
  message?: unknown;
  details?: unknown;
  code?: unknown;
};

function readableError(value: unknown, fallback = "Erreur inconnue"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Error && value.message) return value.message;

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error_description", "detail", "details", "code"]) {
      const nested = record[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
      if (nested && typeof nested === "object") {
        const nestedMessage = readableError(nested, "");
        if (nestedMessage) return nestedMessage;
      }
    }

    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Ignore circular/unsupported objects and use the fallback below.
    }
  }

  return fallback;
}

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
    const preview = raw.trim().slice(0, 300);
    throw new Error(
      `Le backend d'enrichissement a renvoyé une réponse JSON invalide (HTTP ${response.status})${preview ? ` : ${preview}` : ""}`,
    );
  }

  if (!response.ok) {
    const backendMessage = readableError(
      payload.error ?? payload.message ?? payload.details,
      `Backend d'enrichissement HTTP ${response.status}`,
    );
    throw new Error(`Backend d'enrichissement HTTP ${response.status} : ${backendMessage}`);
  }

  return payload;
}

function shouldUseDirectFallback(error: unknown) {
  const message = readableError(error, "").toLowerCase();
  return [
    "vercel ai gateway identity missing",
    "protected deployment",
    "backend d'enrichissement http 502",
    "backend d'enrichissement http 503",
  ].some(fragment => message.includes(fragment));
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

    const companiesPromise = listHubSpotCompaniesForSourcing();
    let payload: EnrichmentPayload;
    let backendError: string | null = null;
    let source = "gando-enrichment-backend";
    let sourcingEngine = BACKEND_ENGINE;

    try {
      payload = await searchThroughEnrichmentBackend(body);
    } catch (error) {
      if (!shouldUseDirectFallback(error)) throw error;
      backendError = readableError(error, "Backend d'enrichissement indisponible");
      const direct = await searchRentalCompaniesLocally(body);
      payload = direct as EnrichmentPayload;
      source = "openrouter-direct-fallback";
      sourcingEngine = FALLBACK_ENGINE;
    }

    const companies = await companiesPromise;
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
      source,
      sourcingEngine,
      backendError,
    }, {
      headers: {
        "cache-control": "no-store",
        "x-gando-sourcing-engine": sourcingEngine,
      },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "La recherche a dépassé le délai maximum du moteur de sourcing."
      : readableError(error, "Erreur de sourcing");

    return NextResponse.json({ error: message, sourcingEngine: BACKEND_ENGINE }, {
      status: 502,
      headers: {
        "cache-control": "no-store",
        "x-gando-sourcing-engine": BACKEND_ENGINE,
      },
    });
  }
}
