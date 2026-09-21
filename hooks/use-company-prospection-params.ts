"use client";

import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import type { CompanyFilters, CompanyFilterKey } from "@/lib/company-multi-filters";
import type { SdrWorkFilter } from "@/components/sdr-work-queue";

const workFilters = ["ACTIONABLE", "OPPORTUNITY", "SNOOZED", "EXCLUDED", "ALL"] as const;
const views = ["table", "board"] as const;

const parsers = {
  q: parseAsString.withDefault(""),
  segment: parseAsString.withDefault(""),
  work: parseAsStringLiteral(workFilters).withDefault("ACTIONABLE"),
  view: parseAsStringLiteral(views).withDefault("table"),
  zip: parseAsArrayOf(parseAsString).withDefault([]),
  city: parseAsArrayOf(parseAsString).withDefault([]),
  state: parseAsArrayOf(parseAsString).withDefault([]),
  country: parseAsArrayOf(parseAsString).withDefault([]),
  industry: parseAsArrayOf(parseAsString).withDefault([]),
  owner: parseAsArrayOf(parseAsString).withDefault([]),
  stage: parseAsArrayOf(parseAsString).withDefault([]),
  prospectionStatus: parseAsArrayOf(parseAsString).withDefault([]),
  callStatus: parseAsArrayOf(parseAsString).withDefault([]),
  fleetSize: parseAsArrayOf(parseAsString).withDefault([]),
};

const FILTER_KEYS: CompanyFilterKey[] = [
  "zip",
  "city",
  "state",
  "country",
  "industry",
  "owner",
  "stage",
  "prospectionStatus",
  "callStatus",
  "fleetSize",
];

export function useCompanyProspectionParams() {
  const [params, setParams] = useQueryStates(parsers, {
    history: "replace",
    shallow: true,
    clearOnDefault: true,
  });

  const filters: CompanyFilters = {};
  for (const key of FILTER_KEYS) {
    const values = params[key];
    if (values?.length) filters[key] = values;
  }

  async function setFilters(filters: CompanyFilters) {
    await setParams({
      zip: filters.zip?.length ? filters.zip : null,
      city: filters.city?.length ? filters.city : null,
      state: filters.state?.length ? filters.state : null,
      country: filters.country?.length ? filters.country : null,
      industry: filters.industry?.length ? filters.industry : null,
      owner: filters.owner?.length ? filters.owner : null,
      stage: filters.stage?.length ? filters.stage : null,
      prospectionStatus: filters.prospectionStatus?.length ? filters.prospectionStatus : null,
      callStatus: filters.callStatus?.length ? filters.callStatus : null,
      fleetSize: filters.fleetSize?.length ? filters.fleetSize : null,
    });
  }

  return {
    query: params.q,
    setQuery: (q: string) => setParams({ q: q || null }),
    segmentId: params.segment,
    setSegmentId: (segment: string) => setParams({ segment: segment || null }),
    workFilter: params.work as SdrWorkFilter,
    setWorkFilter: (work: SdrWorkFilter) => setParams({ work }),
    view: params.view,
    setView: (view: "table" | "board") => setParams({ view }),
    filters,
    setFilters,
  };
}
