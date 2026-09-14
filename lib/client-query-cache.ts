"use client";

type CacheEntry = {
  data?: unknown;
  updatedAt: number;
  inFlight?: Promise<unknown>;
};

type FetchJsonOptions = {
  ttlMs?: number;
  force?: boolean;
  signal?: AbortSignal;
};

const DEFAULT_TTL_MS = 15_000;
const cache = new Map<string, CacheEntry>();

function cachedEntry(key: string) {
  return cache.get(key);
}

export function readJsonCache<T>(key: string): T | undefined {
  return cachedEntry(key)?.data as T | undefined;
}

export function invalidateJsonCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export async function fetchJsonCached<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const existing = cachedEntry(url);
  const now = Date.now();

  if (!options.force && existing?.data !== undefined && now - existing.updatedAt < ttlMs) {
    return existing.data as T;
  }
  if (existing?.inFlight) return existing.inFlight as Promise<T>;

  const request = fetch(url, { cache: "no-store", signal: options.signal })
    .then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof payload?.error === "string"
          ? payload.error
          : typeof payload?.message === "string"
            ? payload.message
            : `Requête impossible (${response.status})`;
        throw new Error(message);
      }
      cache.set(url, { data: payload, updatedAt: Date.now() });
      return payload as T;
    })
    .finally(() => {
      const current = cachedEntry(url);
      if (current?.inFlight === request) {
        cache.set(url, { data: current.data, updatedAt: current.updatedAt });
      }
    });

  cache.set(url, {
    data: existing?.data,
    updatedAt: existing?.updatedAt || 0,
    inFlight: request,
  });
  return request;
}
