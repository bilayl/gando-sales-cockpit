"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeEuro,
  Banknote,
  BriefcaseBusiness,
  Calculator,
  CircleAlert,
  PiggyBank,
  Save,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type DecisionData = {
  forecast?: {
    currentMonthRunRateCautions?: number;
    trailing?: {
      measuredContributionPerCautionCents?: number;
      avgRevenuePerCautionCents?: number;
    };
  };
};

type CostControlData = {
  entries?: Array<{
    year: number;
    monthNumber: number;
    amount: number;
  }>;
};

type FinanceInputs = {
  treasury: number;
  monthlyFixedCosts: number;
  safetyMonths: number;
  monthlyGrowthRate: number;
  salesMonthlyCost: number;
  salesOnboardingCost: number;
  salesTargetCautions: number;
  salesRampMonths: number;
  forecastMonths: number;
};

type ForecastRow = {
  month: number;
  cautions: number;
  contribution: number;
  fixedCosts: number;
  salesCost: number;
  netCashFlow: number;
  treasury: number;
};

const STORAGE_KEY = "gando-finance-planning-v1";

const DEFAULT_INPUTS: FinanceInputs = {
  treasury: 0,
  monthlyFixedCosts: 0,
  safetyMonths: 12,
  monthlyGrowthRate: 0.12,
  salesMonthlyCost: 2500,
  salesOnboardingCost: 1000,
  salesTargetCautions: 250,
  salesRampMonths: 4,
  forecastMonths: 36,
};

function euro(value: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function integer(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function percent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
}

function rampFactor(month: number, rampMonths: number) {
  if (rampMonths <= 1) return 1;
  return Math.min(1, month / rampMonths);
}

function statusMeta(runway: number, safetyMonths: number) {
  if (!Number.isFinite(runway)) return { label: "Très confortable", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (runway >= safetyMonths) return { label: "Finançable", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (runway >= Math.max(6, safetyMonths - 3)) return { label: "À arbitrer", className: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Trop risqué", className: "text-red-700 bg-red-50 border-red-200" };
}

export function FinancePlanningDashboard() {
  const [inputs, setInputs] = useState<FinanceInputs>(DEFAULT_INPUTS);
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null);
  const [costData, setCostData] = useState<CostControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setInputs(current => ({ ...current, ...JSON.parse(raw) }));
    } catch {
      // Ignore malformed local preferences.
    }

    void (async () => {
      try {
        const [decisionResponse, costResponse] = await Promise.all([
          fetch("/api/kpi/decision-intelligence", { cache: "no-store" }),
          fetch("/api/kpi/cost-control", { cache: "no-store" }),
        ]);
        if (decisionResponse.ok) setDecisionData(await decisionResponse.json());
        if (costResponse.ok) setCostData(await costResponse.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const actuals = useMemo(() => {
    const contributionPerCaution =
      (decisionData?.forecast?.trailing?.measuredContributionPerCautionCents || 0) / 100;
    const revenuePerCaution =
      (decisionData?.forecast?.trailing?.avgRevenuePerCautionCents || 0) / 100;
    const cautionRunRate = decisionData?.forecast?.currentMonthRunRateCautions || 0;

    const now = new Date();
    const currentCosts = (costData?.entries || [])
      .filter(row => row.year === now.getFullYear() && row.monthNumber === now.getMonth() + 1)
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      contributionPerCaution,
      revenuePerCaution,
      cautionRunRate,
      currentCosts,
    };
  }, [costData, decisionData]);

  const monthlyFixedCosts = inputs.monthlyFixedCosts > 0 ? inputs.monthlyFixedCosts : actuals.currentCosts;
  const currentContribution = actuals.cautionRunRate * actuals.contributionPerCaution;
  const currentNetBurn = Math.max(0, monthlyFixedCosts - currentContribution);
  const runway = currentNetBurn > 0 ? inputs.treasury / currentNetBurn : Number.POSITIVE_INFINITY;
  const safeTreasuryFloor = monthlyFixedCosts * inputs.safetyMonths;
  const investableCash = Math.max(0, inputs.treasury - safeTreasuryFloor);

  const salesModel = useMemo(() => {
    const monthlyContributionAtTarget = inputs.salesTargetCautions * actuals.contributionPerCaution;
    const steadyMonthlyNet = monthlyContributionAtTarget - inputs.salesMonthlyCost;
    const breakEvenCautions = actuals.contributionPerCaution > 0
      ? Math.ceil(inputs.salesMonthlyCost / actuals.contributionPerCaution)
      : 0;

    let cumulative = -inputs.salesOnboardingCost;
    let paybackMonth: number | null = null;

    for (let month = 1; month <= 36; month += 1) {
      const factor = rampFactor(month, inputs.salesRampMonths);
      const contribution = monthlyContributionAtTarget * factor;
      cumulative += contribution - inputs.salesMonthlyCost;
      if (cumulative >= 0 && paybackMonth == null) paybackMonth = month;
    }

    const burnAfterHire = Math.max(0, currentNetBurn + inputs.salesMonthlyCost - monthlyContributionAtTarget);
    const runwayAfterHire = burnAfterHire > 0
      ? Math.max(0, inputs.treasury - inputs.salesOnboardingCost) / burnAfterHire
      : Number.POSITIVE_INFINITY;

    const annualCost = inputs.salesMonthlyCost * 12 + inputs.salesOnboardingCost;
    const annualContribution = Array.from({ length: 12 }, (_, index) => {
      const factor = rampFactor(index + 1, inputs.salesRampMonths);
      return monthlyContributionAtTarget * factor;
    }).reduce((sum, value) => sum + value, 0);
    const roi = annualCost > 0 ? (annualContribution - annualCost) / annualCost : 0;

    return {
      monthlyContributionAtTarget,
      steadyMonthlyNet,
      breakEvenCautions,
      paybackMonth,
      runwayAfterHire,
      annualCost,
      annualContribution,
      roi,
    };
  }, [actuals.contributionPerCaution, currentNetBurn, inputs]);

  const forecast = useMemo<ForecastRow[]>(() => {
    let treasury = inputs.treasury;
    return Array.from({ length: inputs.forecastMonths }, (_, index) => {
      const month = index + 1;
      const organicCautions = actuals.cautionRunRate * Math.pow(1 + inputs.monthlyGrowthRate, index);
      const salesCautions = inputs.salesTargetCautions * rampFactor(month, inputs.salesRampMonths);
      const cautions = organicCautions + salesCautions;
      const contribution = cautions * actuals.contributionPerCaution;
      const salesCost = inputs.salesMonthlyCost + (month === 1 ? inputs.salesOnboardingCost : 0);
      const netCashFlow = contribution - monthlyFixedCosts - salesCost;
      treasury += netCashFlow;

      return {
        month,
        cautions,
        contribution,
        fixedCosts: monthlyFixedCosts,
        salesCost,
        netCashFlow,
        treasury,
      };
    });
  }, [actuals.cautionRunRate, actuals.contributionPerCaution, inputs, monthlyFixedCosts]);

  const firstNegativeMonth = forecast.find(row => row.treasury < 0)?.month || null;
  const month12 = forecast[Math.min(11, forecast.length - 1)];
  const month36 = forecast[forecast.length - 1];

  function update<K extends keyof FinanceInputs>(key: K, value: FinanceInputs[K]) {
    setInputs(current => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  if (loading) return <Skeleton className="h-[760px] w-full rounded-xl" />;

  const runwayStatus = statusMeta(salesModel.runwayAfterHire, inputs.safetyMonths);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-primary/[0.025] px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <WalletCards className="size-3.5" /> Finance & Prévisionnel
            </div>
            <h2 className="mt-1 text-lg font-bold">Combien pouvons-nous investir sans fragiliser Gando ?</h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
              Le modèle combine les données KPI existantes avec tes hypothèses de trésorerie, de croissance et de recrutement.
            </p>
          </div>
          <Button size="sm" className="h-8 gap-1.5" onClick={save}>
            <Save className="size-3.5" /> {saved ? "Enregistré" : "Enregistrer mes hypothèses"}
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Trésorerie", euro(inputs.treasury), "Saisie de pilotage"],
            ["Contribution / caution", euro(actuals.contributionPerCaution, 2), "Donnée Gando récente"],
            ["Cautions / mois", integer(actuals.cautionRunRate), "Run-rate actuel"],
            ["Burn net actuel", euro(currentNetBurn), monthlyFixedCosts > 0 ? "Après contribution" : "Coûts à renseigner"],
            ["Runway", Number.isFinite(runway) ? `${runway.toFixed(1)} mois` : "∞", `Cible ≥ ${inputs.safetyMonths} mois`],
          ].map(([label, value, helper], index) => (
            <div key={label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{helper}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Calculator className="size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Hypothèses du BP</div>
              <div className="text-[10px] text-muted-foreground">Le réel Gando alimente la marge et le volume ; tu ajustes les décisions financières.</div>
            </div>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Trésorerie disponible" value={inputs.treasury} suffix="€" onChange={value => update("treasury", value)} />
            <Field label="Coûts fixes mensuels" value={monthlyFixedCosts} suffix="€" onChange={value => update("monthlyFixedCosts", value)} helper={inputs.monthlyFixedCosts === 0 && actuals.currentCosts > 0 ? "Prérempli avec les coûts du mois" : undefined} />
            <Field label="Runway de sécurité" value={inputs.safetyMonths} suffix="mois" onChange={value => update("safetyMonths", value)} />
            <Field label="Croissance mensuelle" value={inputs.monthlyGrowthRate * 100} suffix="%" onChange={value => update("monthlyGrowthRate", value / 100)} />
            <Field label="Horizon prévisionnel" value={inputs.forecastMonths} suffix="mois" onChange={value => update("forecastMonths", Math.max(12, Math.min(60, Math.round(value))))} />
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Cash investissable</div>
              <div className="mt-2 text-xl font-semibold">{euro(investableCash)}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">Après réserve de {inputs.safetyMonths} mois de coûts fixes.</div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <PiggyBank className="size-4 text-primary" />
            <div className="text-sm font-semibold">Lecture CEO</div>
          </div>
          <div className="divide-y divide-border">
            <Metric label="Réserve de sécurité" value={euro(safeTreasuryFloor)} detail={`${inputs.safetyMonths} mois de coûts fixes`} />
            <Metric label="Cash disponible à investir" value={euro(investableCash)} detail={investableCash > 0 ? "Sans toucher à la réserve définie" : "Pas de marge d’investissement avec cette règle"} />
            <Metric label="Projection de trésorerie à M12" value={month12 ? euro(month12.treasury) : "—"} detail={month12 ? `${integer(month12.cautions)} cautions/mois projetées` : "—"} />
            <Metric label="Projection fin de période" value={month36 ? euro(month36.treasury) : "—"} detail={firstNegativeMonth ? `Trésorerie négative à M${firstNegativeMonth}` : "Trésorerie positive sur tout l’horizon"} />
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-start gap-2">
            <BriefcaseBusiness className="mt-0.5 size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Décision : recruter un Sales</div>
              <div className="text-[10px] text-muted-foreground">Combien le recrutement coûte, combien de cautions il doit générer et son impact cash.</div>
            </div>
          </div>
          <Badge variant="outline" className={runwayStatus.className}>{runwayStatus.label}</Badge>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Coût mensuel Sales" value={inputs.salesMonthlyCost} suffix="€" onChange={value => update("salesMonthlyCost", value)} />
            <Field label="Coût onboarding" value={inputs.salesOnboardingCost} suffix="€" onChange={value => update("salesOnboardingCost", value)} />
            <Field label="Objectif cautions / mois" value={inputs.salesTargetCautions} suffix="cautions" onChange={value => update("salesTargetCautions", value)} />
            <Field label="Montée en puissance" value={inputs.salesRampMonths} suffix="mois" onChange={value => update("salesRampMonths", Math.max(1, Math.round(value)))} />
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3">
            <DecisionMetric icon={<BadgeEuro className="size-4" />} label="Cautions pour payer le Sales" value={integer(salesModel.breakEvenCautions)} detail="par mois, au niveau de contribution actuel" />
            <DecisionMetric icon={<TrendingUp className="size-4" />} label="Contribution à plein régime" value={euro(salesModel.monthlyContributionAtTarget)} detail={`Net direct : ${euro(salesModel.steadyMonthlyNet)}/mois`} />
            <DecisionMetric icon={<Banknote className="size-4" />} label="Runway après recrutement" value={Number.isFinite(salesModel.runwayAfterHire) ? `${salesModel.runwayAfterHire.toFixed(1)} mois` : "∞"} detail={`Cible interne : ${inputs.safetyMonths} mois`} />
            <DecisionMetric icon={<ArrowRight className="size-4" />} label="Payback estimé" value={salesModel.paybackMonth ? `${salesModel.paybackMonth} mois` : "> 36 mois"} detail="Avec montée en puissance" />
            <DecisionMetric icon={<Calculator className="size-4" />} label="Coût année 1" value={euro(salesModel.annualCost)} detail={`Contribution générée : ${euro(salesModel.annualContribution)}`} />
            <DecisionMetric icon={<WalletCards className="size-4" />} label="ROI année 1" value={percent(salesModel.roi)} detail="Sur contribution mesurée" />
          </div>
        </div>

        {actuals.contributionPerCaution <= 0 ? (
          <div className="mx-4 mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            La contribution par caution n’est pas encore disponible dans les données KPI. Les calculs de ROI resteront conservateurs tant que cette donnée n’est pas mesurée.
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Prévisionnel cash-flow</div>
          <div className="text-[10px] text-muted-foreground">BP dynamique : croissance organique + impact du Sales + coûts fixes.</div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Cautions</TableHead>
                <TableHead className="text-right">Contribution</TableHead>
                <TableHead className="text-right">Coûts fixes</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Cash-flow</TableHead>
                <TableHead className="text-right">Trésorerie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecast.map(row => (
                <TableRow key={row.month} className={row.treasury < 0 ? "bg-destructive/[0.04]" : ""}>
                  <TableCell className="font-medium">M{row.month}</TableCell>
                  <TableCell className="text-right">{integer(row.cautions)}</TableCell>
                  <TableCell className="text-right">{euro(row.contribution)}</TableCell>
                  <TableCell className="text-right">{euro(row.fixedCosts)}</TableCell>
                  <TableCell className="text-right">{euro(row.salesCost)}</TableCell>
                  <TableCell className={`text-right font-medium ${row.netCashFlow < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {row.netCashFlow > 0 ? "+" : ""}{euro(row.netCashFlow)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${row.treasury < 0 ? "text-destructive" : ""}`}>{euro(row.treasury)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  suffix,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  helper?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div className="relative mt-1.5">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={event => onChange(Number(event.target.value || 0))}
          className="h-9 pr-16 text-right text-sm font-medium tabular-nums"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>
      </div>
      {helper ? <span className="mt-1 block text-[9px] text-muted-foreground">{helper}</span> : null}
    </label>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function DecisionMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border p-3 sm:border-l">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</div>
    </div>
  );
}
