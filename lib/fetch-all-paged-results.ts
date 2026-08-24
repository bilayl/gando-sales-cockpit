export type PagedApiPayload<T> = {
  results?: T[];
  total?: number;
  paging?: { next?: { after?: string | number | null } } | null;
  error?: string;
  message?: string;
};

type PagedResult<T> = {
  results: T[];
  total: number;
  truncated: boolean;
};

type LatestPagedRun = {
  token: symbol;
  promise: Promise<PagedResult<any>>;
};

const latestPagedRuns = new Map<string, LatestPagedRun>();

export function fetchAllPagedResults<T extends { id: string }>(url: string, maxPages = 100): Promise<PagedResult<T>> {
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const nextUrl = new URL(url, base);
  const requestKey = nextUrl.pathname;
  const token = Symbol(requestKey);

  let runPromise!: Promise<PagedResult<T>>;
  runPromise = (async () => {
    try {
      const byId = new Map<string, T>();
      let total = 0;
      let page = 0;
      let after: string | null = null;
      let previousAfter: string | null = null;

      do {
        if (after) nextUrl.searchParams.set("after", after);
        else nextUrl.searchParams.delete("after");

        const response = await fetch(`${nextUrl.pathname}${nextUrl.search}`, { cache: "no-store" });
        const payload = await response.json() as PagedApiPayload<T>;
        if (!response.ok) throw new Error(payload.error || payload.message || "Impossible de charger les données");

        for (const record of payload.results || []) byId.set(String(record.id), record);
        total = Math.max(total, Number(payload.total || 0), byId.size);

        const rawAfter = payload.paging?.next?.after;
        previousAfter = after;
        after = rawAfter === undefined || rawAfter === null || rawAfter === "" ? null : String(rawAfter);
        page += 1;
      } while (after && after !== previousAfter && page < maxPages);

      const result: PagedResult<T> = {
        results: Array.from(byId.values()),
        total: Math.max(total, byId.size),
        truncated: Boolean(after && page >= maxPages),
      };

      const latest = latestPagedRuns.get(requestKey);
      if (latest && latest.token !== token) {
        return await latest.promise as PagedResult<T>;
      }

      return result;
    } catch (error) {
      const latest = latestPagedRuns.get(requestKey);
      if (latest && latest.token !== token) {
        return await latest.promise as PagedResult<T>;
      }
      throw error;
    }
  })();

  latestPagedRuns.set(requestKey, { token, promise: runPromise as Promise<PagedResult<any>> });
  return runPromise;
}
