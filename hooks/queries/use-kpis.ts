"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";

export type KpiScorecard = {
  period: {
    currentMonth: string;
    previousMonth: string;
    comparisonMode?: string;
    comparisonThroughDay?: number;
  };
  cautions: {
    current: number;
    previous: number;
    total: number;
    mom: number | null;
    tdvCents: number;
    totalTdvCents: number;
  };
  mau: {
    current: number;
    cautionsPerMau: number | null;
    activatedEver: number;
    cautionsPerActivatedEver: number | null;
  };
  guarantee: {
    providedCents: number;
    totalProvidedCents: number;
    averagePerCautionCents: number | null;
    totalAveragePerCautionCents: number | null;
    insuranceRateBps: number;
    insuranceCostCents: number;
    totalInsuranceCostCents: number;
    grossRevenueYield: number | null;
    totalGrossRevenueYield: number | null;
    measuredContributionYield: number | null;
    totalMeasuredContributionYield: number | null;
  };
  contribution: {
    perCautionCents: number | null;
    measuredContributionCents: number;
    grossRevenueCents: number;
    grossRevenuePerCautionCents: number | null;
    partnerCostCents: number;
    partnerCostPerCautionCents: number | null;
    insuranceCostCents: number;
    insuranceCostPerCautionCents: number | null;
    totalPerCautionCents: number | null;
    totalMeasuredContributionCents: number;
    totalGrossRevenueCents: number;
    totalGrossRevenuePerCautionCents: number | null;
    totalPartnerCostCents: number;
    totalPartnerCostPerCautionCents: number | null;
    totalInsuranceCostCents: number;
    totalInsuranceCostPerCautionCents: number | null;
    complete: boolean;
    missing: string[];
  };
  loss: {
    currentRate: number | null;
    currentAmountCents: number;
    rate: number | null;
    amountCents: number;
    basis: string;
    isProxy: boolean;
  };
  source?: { lastSyncedAt: string | null };
};

export type KpiLiveBusiness = {
  core: {
    successfulDeposits: number;
    activeAccounts: number;
    guaranteeProvidedCents: number;
    averageGuaranteeCents: number;
  };
  metadata: { accounts: number };
};

export type KpiDecisionIntelligence = {
  actual: Array<{
    month: string;
    partial: boolean;
    cautions: number;
    tdvCents: number;
    revenueCents: number;
    contributionCents: number;
    lossProxyCents: number;
    mau: number;
    cautionsPerMau: number | null;
    revenuePerCautionCents: number | null;
    contributionPerCautionCents: number | null;
    retentionRate: number | null;
  }>;
  drivers: { usageReference: number };
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Impossible de charger les données KPI.");
  return body as T;
}

export function useKpiScorecard() {
  return useQuery({
    queryKey: queryKeys.kpi.scorecard,
    queryFn: () => fetchJson<KpiScorecard>("/api/kpi/ceo-scorecard"),
    staleTime: 60_000,
  });
}

export function useKpiLiveBusiness() {
  return useQuery({
    queryKey: queryKeys.kpi.liveBusiness,
    queryFn: () => fetchJson<KpiLiveBusiness>("/api/kpi/live-business"),
    staleTime: 60_000,
  });
}

export function useKpiDecisionIntelligence() {
  return useQuery({
    queryKey: queryKeys.kpi.decisionIntelligence,
    queryFn: () => fetchJson<KpiDecisionIntelligence>("/api/kpi/decision-intelligence"),
    staleTime: 60_000,
  });
}
