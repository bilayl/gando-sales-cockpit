import { hubspotFetch } from "@/lib/hubspot";

const DAY_MS = 86_400_000;
const CACHE_TTL_MS = 60_000;
const MAX_PAGES = 25;

type HubSpotDeal = {
  id: string;
  properties?: Record<string, string | null | undefined>;
};

type HubSpotSearchResponse = {
  results?: HubSpotDeal[];
  paging?: { next?: { after?: string } };
};

export type MonthlyClosingVelocity = {
  avgClosingDays: number | null;
  medianClosingDays: number | null;
  closedWonCount: number;
};

export type OpenPipelineVelocity = {
  avgDealAgeDays: number | null;
  oldestOpenDealDays: number | null;
  openDealsCount: number;
  dealsOver40Days: number;
};

export type HubSpotDealVelocitySnapshot = {
  retrievedAt: string;
  monthlyClosing: Record<string, MonthlyClosingVelocity>;
  openPipeline: OpenPipelineVelocity;
};

let cachedSnapshot: { expiresAt: number; value: HubSpotDealVelocitySnapshot } | null = null;

function monthKeyFromDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function numeric(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return null;
  const days = (endDate.getTime() - startDate.getTime()) / DAY_MS;
  return Number.isFinite(days) && days >= 0 ? days : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function fetchAllDeals(filters: Array<Record<string, unknown>>, properties: string[]) {
  const rows: HubSpotDeal[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await hubspotFetch("/crm/v3/objects/deals/search", {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters }],
        properties,
        limit: 200,
        ...(after ? { after } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const body = (await response.json().catch(() => ({}))) as HubSpotSearchResponse & { message?: string };
    if (!response.ok) {
      throw new Error(body.message || `HubSpot deals search failed (${response.status})`);
    }

    const results = Array.isArray(body.results) ? body.results : [];
    rows.push(...results);
    after = body.paging?.next?.after;
    if (!after) break;
  }

  return rows;
}

function buildMonthlyClosing(deals: HubSpotDeal[]) {
  const grouped = new Map<string, number[]>();

  for (const deal of deals) {
    const props = deal.properties || {};
    const key = monthKeyFromDate(props.closedate);
    if (!key) continue;

    const hubspotDays = numeric(props.days_to_close);
    const duration = hubspotDays != null && hubspotDays >= 0
      ? hubspotDays
      : daysBetween(props.createdate, props.closedate);
    if (duration == null) continue;

    const values = grouped.get(key) || [];
    values.push(duration);
    grouped.set(key, values);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([key, values]) => [key, {
      avgClosingDays: average(values),
      medianClosingDays: median(values),
      closedWonCount: values.length,
    }]),
  ) as Record<string, MonthlyClosingVelocity>;
}

function buildOpenPipeline(deals: HubSpotDeal[]): OpenPipelineVelocity {
  const now = Date.now();
  const ages = deals
    .map(deal => deal.properties?.createdate)
    .filter((value): value is string => Boolean(value))
    .map(value => {
      const created = new Date(value).getTime();
      return Number.isFinite(created) ? Math.max(0, (now - created) / DAY_MS) : null;
    })
    .filter((value): value is number => value != null && Number.isFinite(value));

  return {
    avgDealAgeDays: average(ages),
    oldestOpenDealDays: ages.length ? Math.max(...ages) : null,
    openDealsCount: deals.length,
    dealsOver40Days: ages.filter(age => age > 40).length,
  };
}

export async function getHubSpotDealVelocitySnapshot(options?: { force?: boolean }) {
  const force = Boolean(options?.force);
  if (!force && cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) return cachedSnapshot.value;

  const properties = ["createdate", "closedate", "days_to_close", "hs_is_closed", "hs_is_closed_won"];
  const [closedWonDeals, openDeals] = await Promise.all([
    fetchAllDeals([{ propertyName: "hs_is_closed_won", operator: "EQ", value: "true" }], properties),
    fetchAllDeals([{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }], properties),
  ]);

  const value: HubSpotDealVelocitySnapshot = {
    retrievedAt: new Date().toISOString(),
    monthlyClosing: buildMonthlyClosing(closedWonDeals),
    openPipeline: buildOpenPipeline(openDeals),
  };

  cachedSnapshot = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
