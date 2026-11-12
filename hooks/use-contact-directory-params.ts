"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

const directoryFilters = ["CALLABLE", "FOLLOW_UP", "LINKED", "UNLINKED", "ALL"] as const;
export type ContactDirectoryFilter = (typeof directoryFilters)[number];

export function useContactDirectoryParams() {
  const [params, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      segment: parseAsString.withDefault(""),
      owner: parseAsString.withDefault(""),
      prospection: parseAsString.withDefault(""),
      filter: parseAsStringLiteral(directoryFilters).withDefault("ALL"),
    },
    {
      history: "replace",
      shallow: true,
      clearOnDefault: true,
    },
  );

  return {
    query: params.q,
    setQuery: (q: string) => setParams({ q: q || null }),
    segmentId: params.segment,
    setSegmentId: (segment: string) => setParams({ segment: segment || null }),
    ownerFilter: params.owner,
    setOwnerFilter: (owner: string) => setParams({ owner: owner || null }),
    prospectionFilter: params.prospection,
    setProspectionFilter: (prospection: string) => setParams({ prospection: prospection || null }),
    directoryFilter: params.filter as ContactDirectoryFilter,
    setDirectoryFilter: (filter: ContactDirectoryFilter) => setParams({ filter }),
  };
}
