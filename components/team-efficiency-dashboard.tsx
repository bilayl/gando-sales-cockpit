"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeEuro, BriefcaseBusiness, Calculator, CircleAlert, Gauge, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DealEconomics = {
  id: string;
  companyName: string;
  enabled: boolean;
  annualContribution: number;
};

type DealPayload = {
  summary: {
    averageAnnualContribution: number;
  };
  deals: DealEconomics[];
};

type TeamInputs = {
  fixedMonthlyCost: number;
  variableMonthlyCost: number;
  toolsMonthlyCost: number;
  onboardingCost: number;
  targetMultiple: number;
  rampMonths: number;
  winRate: number;
  actualContributionThisMonth: number;
  benchmarkDealId: string;
};

const STORAGE_KEY = "gando-team-efficiency-v2";

const DEFAULT_INPUTS: TeamInputs = {
  fixedMonthlyCost: 2500,
  variableMonthlyCost: 500,
  toolsMonthlyCost: 250,
  onboardingCost: 500,
  targetMultiple: 5,
  rampMonths: 4,
  winRate: 0.2,
  actualContributionThisMonth: 0,
  benchmarkDealId: "average",
};

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(value);
}

function number(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
}

function percent(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value);
}

function rampFactor(month: number, rampMonths: number) {
  return Math.min(1, month / Math.max(1, rampMonths));
}

function performanceMeta(ratio: number) {
  if (ratio >= 1) return { label: "Objectif atteint", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (ratio >= 0.7) return { label: "Sous contrôle", className: "border-amber-200 bg-amber-50 text-amber-700" };
  return { label: "Sous objectif", className: "border-red-200 bg-red-50 text-red-700" };
}

export function TeamEfficiencyDashboard() {
  const [data, setData] = useState<DealPayload | null>(null);
  const [inputs, setInputs] = useState<TeamInputs>(DEFAULT_INPUTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setInputs(current => ({ ...current, ...JSON.parse(raw) }));
    } catch {
      // Keep defaults.
    }

    void (async () => {
      try {
        const response = await fetch("/api/kpi/deal-economics", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Impossible de charger les benchmarks deals.");
        setData(body);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger les benchmarks deals.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const benchmarkDeals = useMemo(
    () => (data?.deals || []).filter(deal => deal.enabled && deal.annualContribution > 0),
    [data],
  );

  const benchmark = useMemo(() => {
    if (inputs.benchmarkDealId === "average") {
      return {
        label: "Deal moyen du pipeline",
        annualContribution: data?.summary.averageAnnualContribution || 0,
      };
    }
    const deal = benchmarkDeals.find(item => item.id === inputs.benchmarkDealId);
    return {
      label: deal?.companyName || "Deal sélectionné",
      annualContribution: deal?.annualContribution || 0,
    };
  }, [benchmarkDeals, data, inputs.benchmarkDealId]);

  const model = useMemo(() => {
    const recurringMonthlyCost = inputs.fixedMonthlyCost + inputs.variableMonthlyCost + inputs.toolsMonthlyCost;
    const fullyLoadedMonthlyCost = recurringMonthlyCost + inputs.onboardingCost / 12;
    const annualCost = recurringMonthlyCost * 12 + inputs.onboardingCost;
    const requiredAnnualContribution = annualCost * inputs.targetMultiple;
    const fullMonthlyContributionTarget = requiredAnnualContribution / 12;
    const signedDealsPerYear = benchmark.annualContribution > 0
      ? requiredAnnualContribution / benchmark.annualContribution
      : null;
    const qualifiedOpportunitiesPerYear = signedDealsPerYear != null && inputs.winRate > 0
      ? signedDealsPerYear / inputs.winRate
      : null;
    const monthlyQualifiedOpportunities = qualifiedOpportunitiesPerYear != null
      ? qualifiedOpportunitiesPerYear / 12
      : null;
    const monthlySignedDeals = signedDealsPerYear != null ? signedDealsPerYear / 12 : null;

    const currentRampMonth = Math.min(6, Math.max(1, inputs.rampMonths));
    const currentExpectedContribution = fullMonthlyContributionTarget * rampFactor(currentRampMonth, inputs.rampMonths);
    const currentPerformanceRatio = currentExpectedContribution > 0
      ? inputs.actualContributionThisMonth / currentExpectedContribution
      : 0;

    const ramp = Array.from({ length: 6 }, (_, index) => {
      const month = index + 1;
      const factor = rampFactor(month, inputs.rampMonths);
      const contributionTarget = fullMonthlyContributionTarget * factor;
      const qualifiedTarget = monthlyQualifiedOpportunities == null ? null : monthlyQualifiedOpportunities * factor;
      const signedTarget = monthlySignedDeals == null ? null : monthlySignedDeals * factor;
      return { month, factor, contributionTarget, qualifiedTarget, signedTarget };
    });

    const first90DaysTarget = ramp.slice(0, 3).reduce((sum, row) => sum + row.contributionTarget, 0);

    return {
      recurringMonthlyCost,
      fullyLoadedMonthlyCost,
      annualCost,
      requiredAnnualContribution,
      fullMonthlyContributionTarget,
      signedDealsPerYear,
      qualifiedOpportunitiesPerYear,
      monthlyQualifiedOpportunities,
      monthlySignedDeals,
      currentExpectedContribution,
      currentPerformanceRatio,
      first90DaysTarget,
      ramp,
    };
  }, [benchmark.annualContribution, inputs]);

  const performance = performanceMeta(model.currentPerformanceRatio);

  function update<K extends keyof TeamInputs>(key: K, value: TeamInputs[K]) {
    setInputs(current => {
      const next = { ...current, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Keep the scenario usable without persistence.
      }
      return next;
    });
  }

  function loadFreelanceSdrPreset() {
    const next: TeamInputs = {
      ...inputs,
      fixedMonthlyCost: 2500,
      variableMonthlyCost: 500,
      toolsMonthlyCost: 250,
      onboardingCost: 500,
      targetMultiple: 5,
      rampMonths: 4,
      winRate: 0.2,
    };
    setInputs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors.
    }
  }

  if (loading) return <Skeleton className="h-[700px] w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div>
      ) : null}

      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-primary/[0.025] px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <Target className="size-3.5" /> Rendement équipe
            </div>
            <h2 className="mt-1 text-lg font-bold">Combien un SDR doit générer pour être un bon investissement</h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
              Le KPI central est le multiple de contribution créée par rapport au coût complet de la personne. Par défaut : objectif x5.
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-8" onClick={loadFreelanceSdrPreset}>
            Preset SDR freelance
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Coût complet / mois", euro(model.fullyLoadedMonthlyCost), "Fixe + variable + outils + onboarding amorti"],
            ["Objectif x" + number(inputs.targetMultiple, 1), euro(model.fullMonthlyContributionTarget), "Contribution à créer / mois à régime"],
            ["Deals signés / an", number(model.signedDealsPerYear, 2), "Avec le benchmark sélectionné"],
            ["Opps qualifiées / mois", number(model.monthlyQualifiedOpportunities, 1), "Selon le taux de closing"],
            ["Cible 90 jours", euro(model.first90DaysTarget), "Contribution cumulée pendant le ramp-up"],
          ].map(([label, value, helper]) => (
            <div key={label} className="border-border px-4 py-4 sm:border-l first:sm:border-l-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] tabular-nums">{value}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{helper}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Calculator className="size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Coût mensuel de la personne</div>
              <div className="text-[10px] text-muted-foreground">Tous les paramètres sont modifiables.</div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Coût fixe / mois" value={inputs.fixedMonthlyCost} suffix="€" onChange={value => update("fixedMonthlyCost", value)} />
            <Field label="Variable / mois" value={inputs.variableMonthlyCost} suffix="€" onChange={value => update("variableMonthlyCost", value)} />
            <Field label="Outils / data / mois" value={inputs.toolsMonthlyCost} suffix="€" onChange={value => update("toolsMonthlyCost", value)} />
            <Field label="Onboarding / recrutement" value={inputs.onboardingCost} suffix="€" onChange={value => update("onboardingCost", value)} />
            <Field label="Multiple de rendement" value={inputs.targetMultiple} suffix="x" onChange={value => update("targetMultiple", Math.max(1, value))} />
            <Field label="Ramp-up" value={inputs.rampMonths} suffix="mois" onChange={value => update("rampMonths", Math.max(1, Math.round(value)))} />
            <Field label="Taux de closing" value={inputs.winRate * 100} suffix="%" onChange={value => update("winRate", Math.max(0.01, Math.min(1, value / 100)))} />
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Benchmark de deal</span>
              <Select value={inputs.benchmarkDealId} onValueChange={value => update("benchmarkDealId", value)}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="average">Deal moyen du pipeline</SelectItem>
                  {benchmarkDeals.map(deal => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="grid border-t border-border bg-muted/10 sm:grid-cols-3">
            <TeamMetric label="Coût récurrent / mois" value={euro(model.recurringMonthlyCost)} detail="Hors onboarding" />
            <TeamMetric label="Coût année 1" value={euro(model.annualCost)} detail="Coût complet" />
            <TeamMetric label="Contribution cible / an" value={euro(model.requiredAnnualContribution)} detail={"Coût année 1 × " + number(inputs.targetMultiple, 1)} />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-primary" />
              <div>
                <div className="text-sm font-semibold">Score du SDR</div>
                <div className="text-[10px] text-muted-foreground">Comparer ce qu’il génère avec ce qu’il devrait générer à ce stade.</div>
              </div>
            </div>
            <Badge variant="outline" className={performance.className}>{performance.label}</Badge>
          </div>

          <div className="p-4">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Contribution générée ce mois
              </span>
              <div className="relative mt-1.5 max-w-[260px]">
                <Input
                  type="number"
                  min="0"
                  value={inputs.actualContributionThisMonth}
                  onChange={event => update("actualContributionThisMonth", Number(event.target.value || 0))}
                  className="h-9 pr-9 text-right font-semibold"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">€</span>
              </div>
            </label>
          </div>

          <div className="grid border-t border-border sm:grid-cols-2">
            <TeamMetric
              label="Cible mensuelle à régime"
              value={euro(model.fullMonthlyContributionTarget)}
              detail={"Benchmark : " + benchmark.label}
            />
            <TeamMetric
              label="Atteinte vs cible"
              value={percent(model.currentPerformanceRatio)}
              detail={model.currentPerformanceRatio >= 1 ? "Au niveau attendu ou au-dessus" : "Écart à combler"}
            />
          </div>

          <div className="border-t border-border bg-muted/10 px-4 py-3 text-[10px] leading-4 text-muted-foreground">
            Pour un SDR, la lecture doit être faite sur la contribution du pipeline qu’il crée, pas uniquement sur le nombre de rendez-vous. Un gros deal comme Doussy ne vaut pas un petit deal : le cockpit ramène tout à une unité économique comparable.
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <TrendingUp className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Ramp-up attendu · 6 premiers mois</div>
            <div className="text-[10px] text-muted-foreground">
              Permet de juger rapidement si le recrutement monte en puissance assez vite.
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Niveau attendu</TableHead>
                <TableHead className="text-right">Contribution cible</TableHead>
                <TableHead className="text-right">Opps qualifiées</TableHead>
                <TableHead className="text-right">Deals signés équiv.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.ramp.map(row => (
                <TableRow key={row.month}>
                  <TableCell className="font-semibold">M{row.month}</TableCell>
                  <TableCell className="text-right">{percent(row.factor)}</TableCell>
                  <TableCell className="text-right font-semibold">{euro(row.contributionTarget)}</TableCell>
                  <TableCell className="text-right">{number(row.qualifiedTarget, 1)}</TableCell>
                  <TableCell className="text-right">{number(row.signedTarget, 2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Le preset SDR est un scénario de travail, pas une donnée comptable. Remplace ses coûts par le contrat réel. La logique de rendement reste la même : coût complet → multiple cible → contribution à générer → nombre d’opportunités et de deals nécessaires.
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div className="relative mt-1.5">
        <Input
          type="number"
          min="0"
          value={Number.isFinite(value) ? value : 0}
          onChange={event => onChange(Number(event.target.value || 0))}
          className="h-9 pr-14 text-right text-sm font-medium tabular-nums"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>
      </div>
    </label>
  );
}

function TeamMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-border px-4 py-3 sm:border-l first:sm:border-l-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}
