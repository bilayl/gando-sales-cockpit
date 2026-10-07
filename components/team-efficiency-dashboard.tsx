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
  monthlyDeposits: number;
  monthlyContribution: number;
  annualContribution: number;
};

type DealPayload = {
  summary: {
    averageAnnualContribution: number;
  };
  deals: DealEconomics[];
};

type CostEntry = {
  id: string;
  year: number;
  monthNumber: number;
  family: string;
  category: string;
  label: string;
  amount: number;
};

type CostPayload = {
  entries?: CostEntry[];
};

type TeamInputs = {
  fixedMonthlyCost: number;
  variableMonthlyCost: number;
  toolsMonthlyCost: number;
  onboardingCost: number;
  targetMultiple: number;
  rampMonths: number;
  currentRampMonth: number;
  winRate: number;
  actualContributionThisMonth: number;
  benchmarkDealId: string;
  targetFleetSize: number;
  rentalsPerVehicleMonth: number;
  gandoAdoptionRate: number;
  qualificationRate: number;
};

const STORAGE_KEY = "gando-team-efficiency-v2";

const DEFAULT_INPUTS: TeamInputs = {
  fixedMonthlyCost: 2500,
  variableMonthlyCost: 500,
  toolsMonthlyCost: 250,
  onboardingCost: 500,
  targetMultiple: 5,
  rampMonths: 4,
  currentRampMonth: 1,
  winRate: 0.2,
  actualContributionThisMonth: 0,
  benchmarkDealId: "average",
  targetFleetSize: 50,
  rentalsPerVehicleMonth: 3,
  gandoAdoptionRate: 0.2,
  qualificationRate: 0.35,
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
  const [costData, setCostData] = useState<CostPayload | null>(null);
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
        const [dealResponse, costResponse] = await Promise.all([
          fetch("/api/kpi/deal-economics", { cache: "no-store" }),
          fetch("/api/kpi/cost-control", { cache: "no-store" }),
        ]);
        const [dealBody, costBody] = await Promise.all([dealResponse.json(), costResponse.json()]);
        if (!dealResponse.ok) throw new Error(dealBody.error || "Impossible de charger les benchmarks deals.");
        if (!costResponse.ok) throw new Error(costBody.error || "Impossible de charger les coûts d’équipe.");
        setData(dealBody);
        setCostData(costBody);
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
      const totalMonthlyDeposits = benchmarkDeals.reduce((sum, deal) => sum + Number(deal.monthlyDeposits || 0), 0);
      const totalMonthlyContribution = benchmarkDeals.reduce((sum, deal) => sum + Number(deal.monthlyContribution || 0), 0);
      return {
        label: "Deal moyen du pipeline",
        annualContribution: data?.summary.averageAnnualContribution || 0,
        monthlyDeposits: benchmarkDeals.length ? totalMonthlyDeposits / benchmarkDeals.length : 0,
        monthlyContribution: benchmarkDeals.length ? totalMonthlyContribution / benchmarkDeals.length : 0,
      };
    }
    const deal = benchmarkDeals.find(item => item.id === inputs.benchmarkDealId);
    return {
      label: deal?.companyName || "Deal sélectionné",
      annualContribution: deal?.annualContribution || 0,
      monthlyDeposits: deal?.monthlyDeposits || 0,
      monthlyContribution: deal?.monthlyContribution || 0,
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

    const contributionPerCaution = benchmark.monthlyDeposits > 0
      ? benchmark.monthlyContribution / benchmark.monthlyDeposits
      : 0;
    const monthlyCautionTarget = contributionPerCaution > 0
      ? fullMonthlyContributionTarget / contributionPerCaution
      : null;

    const cautionsPerTargetCompany = Math.max(
      0,
      inputs.targetFleetSize * inputs.rentalsPerVehicleMonth * inputs.gandoAdoptionRate
    );
    const liveCompaniesNeeded = monthlyCautionTarget != null && cautionsPerTargetCompany > 0
      ? monthlyCautionTarget / cautionsPerTargetCompany
      : null;
    const qualifiedCompaniesNeeded = liveCompaniesNeeded != null && inputs.winRate > 0
      ? liveCompaniesNeeded / inputs.winRate
      : null;
    const companiesToProspect = qualifiedCompaniesNeeded != null && inputs.qualificationRate > 0
      ? qualifiedCompaniesNeeded / inputs.qualificationRate
      : null;
    const weeklyProspecting = companiesToProspect != null ? companiesToProspect / 4.33 : null;

    const fleetScenarios = [20, 50, 100].map(fleetSize => {
      const cautionsPerCompany = fleetSize * inputs.rentalsPerVehicleMonth * inputs.gandoAdoptionRate;
      const liveCompanies = monthlyCautionTarget != null && cautionsPerCompany > 0
        ? Math.ceil(monthlyCautionTarget / cautionsPerCompany)
        : null;
      const qualifiedCompanies = liveCompanies != null && inputs.winRate > 0
        ? Math.ceil(liveCompanies / inputs.winRate)
        : null;
      const prospects = qualifiedCompanies != null && inputs.qualificationRate > 0
        ? Math.ceil(qualifiedCompanies / inputs.qualificationRate)
        : null;
      return { fleetSize, cautionsPerCompany, liveCompanies, qualifiedCompanies, prospects };
    });

    const currentRampMonth = Math.min(12, Math.max(1, Math.round(inputs.currentRampMonth)));
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
      contributionPerCaution,
      monthlyCautionTarget,
      cautionsPerTargetCompany,
      liveCompaniesNeeded,
      qualifiedCompaniesNeeded,
      companiesToProspect,
      weeklyProspecting,
      fleetScenarios,
      ramp,
    };
  }, [benchmark, inputs]);

  const currentTeamCosts = useMemo(() => {
    const now = new Date();
    return (costData?.entries || [])
      .filter(row =>
        row.year === now.getFullYear() &&
        row.monthNumber === now.getMonth() + 1 &&
        row.family === "structure" &&
        row.category === "team"
      )
      .sort((a, b) => b.amount - a.amount);
  }, [costData]);

  const currentTeamCostTotal = currentTeamCosts.reduce((sum, row) => sum + Number(row.amount || 0), 0);
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
      currentRampMonth: 1,
      winRate: 0.2,
      targetFleetSize: 50,
      rentalsPerVehicleMonth: 3,
      gandoAdoptionRate: 0.2,
      qualificationRate: 0.35,
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

        <div className="grid sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Coût complet / mois", euro(model.fullyLoadedMonthlyCost), "Fixe + variable + outils + onboarding amorti"],
            ["Coût équipe réel", euro(currentTeamCostTotal), currentTeamCosts.length ? currentTeamCosts.length + " ligne(s) équipe ce mois" : "À saisir dans Cash & coûts"],
            ["Objectif x" + number(inputs.targetMultiple, 1), euro(model.fullMonthlyContributionTarget), "Contribution à créer / mois à régime"],
            ["Cautions cible / mois", number(model.monthlyCautionTarget, 0), model.contributionPerCaution > 0 ? euro(model.contributionPerCaution, 2) + " de contribution / caution" : "Benchmark insuffisant"],
            ["Entreprises live à construire", number(model.liveCompaniesNeeded, 0), inputs.targetFleetSize + " véhicules de moyenne"],
            ["Prospects à viser / mois", number(model.companiesToProspect, 0), model.weeklyProspecting != null ? number(model.weeklyProspecting, 0) + " entreprises / semaine" : "Selon qualification + closing"],
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
            <Field label="Mois dans le poste" value={inputs.currentRampMonth} suffix="M" onChange={value => update("currentRampMonth", Math.max(1, Math.round(value)))} />
            <Field label="Taux de closing" value={inputs.winRate * 100} suffix="%" onChange={value => update("winRate", Math.max(0.01, Math.min(1, value / 100)))} />
            <Field label="Taux de qualification" value={inputs.qualificationRate * 100} suffix="%" onChange={value => update("qualificationRate", Math.max(0.01, Math.min(1, value / 100)))} />
            <Field label="Flotte cible moyenne" value={inputs.targetFleetSize} suffix="véh." onChange={value => update("targetFleetSize", Math.max(1, Math.round(value)))} />
            <Field label="Locations / véhicule / mois" value={inputs.rentalsPerVehicleMonth} suffix="loc." onChange={value => update("rentalsPerVehicleMonth", Math.max(0.1, value))} />
            <Field label="Part passant par Gando" value={inputs.gandoAdoptionRate * 100} suffix="%" onChange={value => update("gandoAdoptionRate", Math.max(0.01, Math.min(1, value / 100)))} />
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
              detail={"Cible M" + Math.round(inputs.currentRampMonth) + " · benchmark " + benchmark.label}
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

      <Card className="overflow-hidden border-primary/15">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-start gap-2">
            <Target className="mt-0.5 size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Plan de ciblage concret</div>
              <div className="text-[10px] text-muted-foreground">
                Transformer l’objectif de rendement en nombre d’entreprises, taille de flotte et cautions mensuelles attendues.
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="text-[9px]">
            Hypothèse : {number(inputs.rentalsPerVehicleMonth, 1)} locations/véhicule/mois × {percent(inputs.gandoAdoptionRate)}
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          <TeamMetric
            label="Flotte cœur de cible"
            value={number(inputs.targetFleetSize, 0) + " véhicules"}
            detail="Modifiable dans les hypothèses"
          />
          <TeamMetric
            label="Cautions / entreprise / mois"
            value={number(model.cautionsPerTargetCompany, 0)}
            detail="À maturité avec le taux d’adoption choisi"
          />
          <TeamMetric
            label="Portefeuille live nécessaire"
            value={number(model.liveCompaniesNeeded, 0) + " entreprises"}
            detail="Pour couvrir l’objectif de cautions mensuel"
          />
          <TeamMetric
            label="Entreprises qualifiées"
            value={number(model.qualifiedCompaniesNeeded, 0)}
            detail={"Avec " + percent(inputs.winRate) + " de closing"}
          />
          <TeamMetric
            label="Entreprises à prospecter"
            value={number(model.companiesToProspect, 0)}
            detail={model.weeklyProspecting != null ? "≈ " + number(model.weeklyProspecting, 0) + " / semaine" : "À calculer"}
          />
        </div>

        <div className="overflow-x-auto border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Flotte</TableHead>
                <TableHead className="text-right">Cautions / entreprise / mois</TableHead>
                <TableHead className="text-right">Entreprises live nécessaires</TableHead>
                <TableHead className="text-right">À qualifier</TableHead>
                <TableHead className="text-right">À prospecter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.fleetScenarios.map(row => (
                <TableRow key={row.fleetSize} className={row.fleetSize === 50 ? "bg-primary/[0.025]" : ""}>
                  <TableCell className="font-semibold">
                    {row.fleetSize === 20 ? "Petit loueur" : row.fleetSize === 50 ? "Cœur de cible" : "Compte structuré"}
                  </TableCell>
                  <TableCell className="text-right">{row.fleetSize} véhicules</TableCell>
                  <TableCell className="text-right font-semibold">{number(row.cautionsPerCompany, 0)}</TableCell>
                  <TableCell className="text-right">{number(row.liveCompanies, 0)}</TableCell>
                  <TableCell className="text-right">{number(row.qualifiedCompanies, 0)}</TableCell>
                  <TableCell className="text-right">{number(row.prospects, 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-border bg-muted/10 px-4 py-3 text-[10px] leading-4 text-muted-foreground">
          Exemple : avec une flotte cible de {number(inputs.targetFleetSize, 0)} véhicules, {number(inputs.rentalsPerVehicleMonth, 1)} locations par véhicule et {percent(inputs.gandoAdoptionRate)} des locations utilisant Gando, une entreprise représente environ {number(model.cautionsPerTargetCompany, 0)} cautions par mois. Le cockpit remonte ensuite le nombre d’entreprises à signer, qualifier puis prospecter pour atteindre l’objectif économique du SDR.
        </div>
      </Card>

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

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BriefcaseBusiness className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Coûts équipe enregistrés ce mois</div>
            <div className="text-[10px] text-muted-foreground">Les dépenses saisies dans Cash & coûts avec la catégorie Équipe remontent ici automatiquement.</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personne / poste</TableHead>
                <TableHead className="text-right">Coût du mois</TableHead>
                <TableHead className="text-right">Coût annualisé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTeamCosts.length ? currentTeamCosts.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.label}</TableCell>
                  <TableCell className="text-right">{euro(row.amount)}</TableCell>
                  <TableCell className="text-right">{euro(row.amount * 12)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-20 text-center text-xs text-muted-foreground">
                    Aucun coût personne n’est encore enregistré ce mois. Ajoute-le dans Cash & coûts → Structure → Équipe.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Le preset SDR est un scénario de travail. La partie ciblage est volontairement pilotable : taille de flotte, locations par véhicule, adoption Gando, qualification et closing. La lecture devient : coût complet → contribution cible → cautions nécessaires → portefeuille d’entreprises à construire → comptes à qualifier et prospecter.
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
