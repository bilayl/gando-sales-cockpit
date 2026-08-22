import { NextRequest, NextResponse } from "next/server";
import {
  dedupeSourcingCandidates,
  listHubSpotCompaniesForSourcing,
  mergeSourcingCandidates,
  type SourcingProspect,
} from "@/lib/enrichment-dedup";
import { searchRentalCompaniesLocally } from "@/lib/enrichment-local-search";
import { searchRentalCompaniesWithApifyDirect, type DirectApifyRunRef } from "@/lib/apify-direct";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ENGINE = "openrouter-apify-direct-v4";

function readableError(value: unknown, fallback = "Erreur inconnue"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Error && value.message) return value.message;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error_description", "detail", "details", "code", "error"]) {
      const nested = record[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
      if (nested && typeof nested === "object") {
        const message = readableError(nested, "");
        if (message) return message;
      }
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}") return serialized;
    } catch {}
  }
  return fallback;
}

function normalizeRunRefs(value: unknown): DirectApifyRunRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((run: any) => run?.runId)
    .slice(0, 12)
    .map((run: any) => ({
      runId: String(run.runId),
      datasetId: run.datasetId ? String(run.datasetId) : undefined,
      territory: run.territory ? String(run.territory) : undefined,
      status: run.status ? String(run.status) : undefined,
      pending: Boolean(run.pending),
    }));
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
    const minConfidence = Math.min(Math.max(Number(input.minConfidence) || 0.65, 0), 1);
    const apifyRunRefs = normalizeRunRefs(input.apifyRunRefs);
    const territories = Array.isArray(input.territories) ? input.territories.map(String).slice(0, 12) : undefined;
    const query = typeof input.query === "string" ? input.query.slice(0, 600) : "";
    const apifyLimit = Math.min(Math.max(Number(input.apifyLimit) || Math.max(limit * 4, 100), 50), 1200);
    const apifyContactsPerCompany = Math.min(Math.max(Number(input.apifyContactsPerCompany) || 3, 1), 5);

    const companiesPromise = listHubSpotCompaniesForSourcing();
    const sourceErrors: Array<{ source: string; error: string }> = [];
    let candidates: SourcingProspect[] = [];
    let openrouterCandidates = 0;
    let openrouterStatus = apifyRunRefs.length ? "skipped_poll" : "pending";

    const apifyInput = {
      query,
      territories,
      limit,
      apifyLimit,
      apifyContactsPerCompany,
      apifyRunRefs: apifyRunRefs.length ? apifyRunRefs : undefined,
      apifyPollWaitSeconds: Math.min(Math.max(Number(input.apifyPollWaitSeconds) || 0, 0), 20),
    };

    let apify = await searchRentalCompaniesWithApifyDirect(
      apifyRunRefs.length
        ? apifyInput
        : { ...apifyInput, apifyPollWaitSeconds: 0 },
    );

    if (apifyRunRefs.length) {
      candidates = apify.prospects as SourcingProspect[];
    } else {
      const directResult = await searchRentalCompaniesLocally({
        query,
        territories,
        sources: Array.isArray(input.sources) ? input.sources.map(String).slice(0, 12) : undefined,
        limit: Math.min(Math.max(limit * 2, 20), 50),
      }).catch(error => {
        sourceErrors.push({ source: "openrouter", error: readableError(error, "OpenRouter indisponible") });
        return null;
      });

      if (directResult) {
        const directProspects = Array.isArray(directResult.prospects) ? directResult.prospects as SourcingProspect[] : [];
        openrouterCandidates = directProspects.length;
        openrouterStatus = directResult.source || "ok";
        candidates = mergeSourcingCandidates([...directProspects, ...(apify.prospects as SourcingProspect[])]);
      } else {
        openrouterStatus = "error";
        candidates = apify.prospects as SourcingProspect[];
      }
    }

    if (apify.errors.length) {
      sourceErrors.push(...apify.errors.map(error => ({ source: "apify", error })));
    }

    const companies = await companiesPromise;
    const deduped = dedupeSourcingCandidates(candidates, companies, limit, minConfidence);

    return NextResponse.json({
      searchId: crypto.randomUUID(),
      searchedAt: new Date().toISOString(),
      candidatesFound: candidates.length,
      backendUniqueCandidates: deduped.unique.length,
      uniqueCandidates: deduped.unique.length,
      hubspotCompaniesChecked: companies.length,
      excludedFromHubspot: deduped.excluded.length,
      newProspects: deduped.prospects.length,
      prospects: deduped.prospects,
      excluded: deduped.excluded,
      sources: {
        openrouter: { candidates: openrouterCandidates, status: openrouterStatus },
        apify: {
          configured: apify.configured,
          actorId: apify.actorId,
          rawItems: apify.rawItems,
          candidates: apify.prospects.length,
          runs: apify.runs,
        },
      },
      sourceErrors,
      inpi: null,
      source: "room.gando.pro-server",
      sourcingEngine: ENGINE,
      backendError: null,
    }, {
      headers: {
        "cache-control": "no-store",
        "x-gando-sourcing-engine": ENGINE,
      },
    });
  } catch (error) {
    const message = readableError(error, "Erreur de sourcing");
    return NextResponse.json({ error: message, sourcingEngine: ENGINE }, {
      status: 502,
      headers: { "cache-control": "no-store", "x-gando-sourcing-engine": ENGINE },
    });
  }
}
