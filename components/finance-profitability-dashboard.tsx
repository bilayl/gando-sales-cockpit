"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeEuro, Calculator, CircleAlert, TrendingUp, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Family = "acquisition" | "transaction" | "risk" | "partners" | "structure";

type CostEntry = {
  id: string;
  year: number;
  monthNumber: number;
  family: Family;
  amount: number;
};

type Budget = {
  year: number;
  monthNumber: number;
  family: Family;
  budgetAmount: number;
};

type CoreRow = {
  year: number;
  monthNumber: number;
  revenue: number | null;
  deposits: number | null;
};

type CostControlData = {
  entries?: CostEntry[];
  budgets?: Budget[];
  coreRows?: CoreRow[];
};

type DecisionData = {
  forecast?: {
    trailing?: {
      avgRevenuePerCautionCents?: number;
      measuredContributionPerCautionCents?: number;
    };
  };
};

type MonthRow = {
  key: string;
  year: number;
  monthNumber: number;
  revenue: number;
  totalCosts: number;
  operatingCosts: number;
  variableCosts: number;
  result: number;
  margin: number | null;
  deposits: number;
};

const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const OPERATING_FAMILIES = new Set<Family>(["acquisition", "structure"]);
const VARIABLE_FAMILIES = new Set<Family>(["transaction", "risk", "partners"]);
const TARGET_PROFIT_KEY = "gando-finance-target-profit-v1";

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(value);
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value);
}

function periodKey(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function shiftPeriod(value: string, delta: number) {
  const [year, monthNumber] = value.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return periodKey(date.getFullYear(), date.getMonth() + 1);
}

function monthLabel(year: number, monthNumber: number) {
  return `${MONTHS[monthNumber - 1]} ${year}`;
}

export function FinanceProfitabilityDashboard() {
  const [costData, setCostData] = useState<CostControlData | null>(null);
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null);
  const [targetProfit, setTargetProfit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TARGET_PROFIT_KEY);
      if (saved != null) setTargetProfit(Math.max(0, Number(saved) || 0));
    } catch {
      // Keep the default target.
    }

    void (async () => {
      try {
        const [costResponse, decisionResponse] = await Promise.all([
          fetch("/api/kpi/cost-control", { cache: "no-store" }),
          fetch("/api/kpi/decision-intelligence", { cache: "no-store" }),
        ]);
        const [costBody, decisionBody] = await Promise.all([
          costResponse.json(),
          decisionResponse.json(),
        ]);
        if (!costResponse.ok) throw new Error(costBody.error || "Impossible de charger les dépenses.");
        if (!decisionResponse.ok) throw new Error(decisionBody.error || "Impossible de charger l'économie unitaire.");
        setCostData(costBody);
        setDecisionData(decisionBody);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger la rentabilité.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now = new Date();
  const currentKey = periodKey(now.getFullYear(), now.getMonth() + 1);

  const monthlyRows = useMemo<MonthRow[]>(() => {
    const entries = costData?.entries || [];
    const coreRows = costData?.coreRows || [];

    return Array.from({ length: 12 }, (_, index) => shiftPeriod(currentKey, index - 11)).map(key => {
      const [year, monthNumber] = key.split("-").map(Number);
      const monthEntries = entries.filter(row => row.year === year && row.monthNumber === monthNumber);
      const revenue = n(coreRows.find(row => row.year === year && row.monthNumber === monthNumber)?.revenue);
      const deposits = n(coreRows.find(row => row.year === year && row.monthNumber === monthNumber)?.deposits);
      const operatingCosts = monthEntries
        .filter(row => OPERATING_FAMILIES.has(row.family))
        .reduce((sum, row) => sum + n(row.amount), 0);
      const variableCosts = monthEntries
        .filter(row => VARIABLE_FAMILIES.has(row.family))
        .reduce((sum, row) => sum + n(row.amount), 0);
      const totalCosts = monthEntries.reduce((sum, row) => sum + n(row.amount), 0);
      const result = revenue - totalCosts;

      return {
        key,
        year,
        monthNumber,
        revenue,
        totalCosts,
        operatingCosts,
        variableCosts,
        result,
        margin: revenue > 0 ? result / revenue : null,
        deposits,
      };
    });
  }, [costData, currentKey]);

  const profitability = useMemo(() => {
    const current = monthlyRows.find(row => row.key === currentKey) || null;
    const completed = monthlyRows.filter(row => row.key !== currentKey && row.revenue > 0);
    const trailing = completed.slice(-3);
    const trailingRevenue = trailing.reduce((sum, row) => sum + row.revenue, 0);
    const trailingVariableCosts = trailing.reduce((sum, row) => sum + row.variableCosts, 0);
    const trailingOperatingAverage = trailing.length
      ? trailing.reduce((sum, row) => sum + row.operatingCosts, 0) / trailing.length
      : 0;

    const avgRevenuePerCaution = n(decisionData?.forecast?.trailing?.avgRevenuePerCautionCents) / 100;
    const measuredContributionPerCaution = n(decisionData?.forecast?.trailing?.measuredContributionPerCautionCents) / 100;
    const contributionRateFromEconomics = avgRevenuePerCaution > 0
      ? measuredContributionPerCaution / avgRevenuePerCaution
      : null;

    const ledgerContributionRate = trailingRevenue > 0
      ? 1 - (trailingVariableCosts / trailingRevenue)
      : null;

    const contributionRateRaw = ledgerContributionRate ?? contributionRateFromEconomics;
    const contributionRate = contributionRateRaw != null && contributionRateRaw > 0
      ? Math.min(1, contributionRateRaw)
      : null;

    const [currentYear, currentMonth] = currentKey.split("-").map(Number);
    const currentOperatingBudget = (costData?.budgets || [])
      .filter(row =>
        row.year === currentYear &&
        row.monthNumber === currentMonth &&
        OPERATING_FAMILIES.has(row.family)
      )
      .reduce((sum, row) => sum + n(row.budgetAmount), 0);

    const operatingBase = currentOperatingBudget > 0
      ? currentOperatingBudget
      : trailingOperatingAverage > 0
        ? trailingOperatingAverage
        : n(current?.operatingCosts);

    const breakEvenRevenue = contributionRate && contributionRate > 0
      ? operatingBase / contributionRate
      : null;

    const targetRevenue = contributionRate && contributionRate > 0
      ? (operatingBase + targetProfit) / contributionRate
      : null;

    const requiredCautions = targetRevenue != null && avgRevenuePerCaution > 0
      ? Math.ceil(targetRevenue / avgRevenuePerCaution)
      : null;

    const elapsedDays = Math.max(1, now.getDate());
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const revenueRunRate = current?.revenue
      ? current.revenue / elapsedDays * daysInMonth
      : 0;

    const gapToTarget = targetRevenue != null ? revenueRunRate - targetRevenue : null;

    return {
      current,
      contributionRate,
      contributionRateSource: ledgerContributionRate != null ? "dépenses variables réelles" : "économie unitaire mesurée",
      operatingBase,
      operatingBaseSource: currentOperatingBudget > 0 ? "budget du mois" : trailingOperatingAverage > 0 ? "moyenne des 3 derniers mois" : "réel du mois",
      breakEvenRevenue,
      targetRevenue,
      requiredCautions,
      revenueRunRate,
      gapToTarget,
      avgRevenuePerCaution,
    };
  }, [costData, currentKey, decisionData, monthlyRows, now, targetProfit]);

  function changeTargetProfit(value: number) {
    const next = Math.max(0, Number.isFinite(value) ? value : 0);
    setTargetProfit(next);
    try {
      window.localStorage.setItem(TARGET_PROFIT_KEY, String(next));
    } catch {
      // The calculator remains usable even if local storage is unavailable.
    }
  }

  if (loading) return <Skeleton className="h-[560px] w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-primary/[0.025] px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <BadgeEuro className="size-3.5" /> Rentabilité mensuelle
            </div>
            <h2 className="mt-1 text-lg font-bold">Ce que Gando doit réellement générer chaque mois</h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
              Le point mort part des dépenses de structure et d’acquisition, puis applique le poids réel des coûts variables enregistrés.
            </p>
          </div>
          <label className="w-full max-w-[240px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Résultat mensuel cible</span>
            <div className="relative mt-1.5">
              <Input
                type="number"
                min="0"
                step="100"
                value={targetProfit}
                onChange={event => changeTargetProfit(Number(event.target.value || 0))}
                className="h-9 pr-9 text-right text-sm font-semibold tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">€</span>
            </div>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["CA minimum / mois", euro(profitability.breakEvenRevenue), "Point mort à résultat 0 €"],
            ["CA cible / mois", euro(profitability.targetRevenue), targetProfit > 0 ? `Pour dégager ${euro(targetProfit)} de résultat` : "Identique au point mort"],
            ["Cautions nécessaires", integer(profitability.requiredCautions), profitability.avgRevenuePerCaution > 0 ? `À ${euro(profitability.avgRevenuePerCaution, 2)} de CA moyen/caution` : "CA moyen/caution manquant"],
            ["Run-rate CA actuel", euro(profitability.revenueRunRate), "Projection du mois en cours"],
            ["Écart au CA cible", profitability.gapToTarget == null ? "—" : euro(profitability.gapToTarget), profitability.gapToTarget == null ? "Données insuffisantes" : profitability.gapToTarget >= 0 ? "Objectif couvert au run-rate actuel" : "CA supplémentaire à générer"],
          ].map(([label, value, helper], index) => (
            <div key={label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
              <div className={`mt-2 text-2xl font-semibold tabular-nums ${label === "Écart au CA cible" && profitability.gapToTarget != null && profitability.gapToTarget < 0 ? "text-destructive" : ""}`}>
                {value}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{helper}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Calculator className="size-4 text-primary" />
            <div className="text-sm font-semibold">Construction du point mort</div>
          </div>
          <div className="divide-y divide-border">
            <FinanceMetric
              label="Dépenses opérationnelles de base"
              value={euro(profitability.operatingBase)}
              detail={`Structure + acquisition · ${profitability.operatingBaseSource}`}
            />
            <FinanceMetric
              label="Marge disponible après coûts variables"
              value={percent(profitability.contributionRate)}
              detail={profitability.contributionRate ? `Calculée depuis ${profitability.contributionRateSource}` : "Il manque encore assez de données pour calculer la marge"}
            />
            <FinanceMetric
              label="Résultat comptable du mois"
              value={profitability.current ? euro(profitability.current.result) : "—"}
              detail={profitability.current ? `${euro(profitability.current.revenue)} de CA - ${euro(profitability.current.totalCosts)} de dépenses enregistrées` : "Aucune donnée ce mois"}
            />
          </div>
          <div className="flex gap-2 border-t border-border bg-muted/15 px-4 py-3 text-[10px] leading-4 text-muted-foreground">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Le calcul devient fiable si les dépenses sont saisies chaque mois. Les familles transaction, risque et partenaires servent au taux de coûts variables ; structure et acquisition servent à la base de dépenses à couvrir.
            </span>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <div>
                <div className="text-sm font-semibold">Suivi comptable mensuel</div>
                <div className="text-[10px] text-muted-foreground">CA, dépenses et résultat réel sur les 12 derniers mois.</div>
              </div>
            </div>
            <Badge variant="secondary" className="text-[9px]">12 mois</Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Dépenses</TableHead>
                  <TableHead className="text-right">Résultat</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead className="text-right">Cautions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyRows.map(row => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{monthLabel(row.year, row.monthNumber)}</TableCell>
                    <TableCell className="text-right">{euro(row.revenue)}</TableCell>
                    <TableCell className="text-right">{euro(row.totalCosts)}</TableCell>
                    <TableCell className={`text-right font-semibold ${row.result < 0 ? "text-destructive" : row.revenue > 0 ? "text-emerald-600" : ""}`}>
                      {row.revenue > 0 || row.totalCosts > 0 ? `${row.result > 0 ? "+" : ""}${euro(row.result)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{percent(row.margin)}</TableCell>
                    <TableCell className="text-right">{row.deposits > 0 ? integer(row.deposits) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <WalletCards className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Lecture CEO</div>
            <div className="text-[10px] text-muted-foreground">La question à suivre chaque mois : combien devons-nous générer pour couvrir Gando, puis commencer à créer du résultat ?</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3">
          <FinanceMetric
            label="Point mort"
            value={euro(profitability.breakEvenRevenue)}
            detail="CA mensuel minimum pour couvrir les dépenses"
          />
          <FinanceMetric
            label="Objectif choisi"
            value={euro(profitability.targetRevenue)}
            detail={targetProfit > 0 ? `Inclut ${euro(targetProfit)} de résultat cible` : "Aucun résultat additionnel demandé"}
          />
          <FinanceMetric
            label="Décision immédiate"
            value={profitability.gapToTarget == null ? "À compléter" : profitability.gapToTarget >= 0 ? "Au-dessus du seuil" : `+${euro(Math.abs(profitability.gapToTarget))}`}
            detail={profitability.gapToTarget == null ? "Saisir dépenses et CA pour obtenir le seuil" : profitability.gapToTarget >= 0 ? "Le run-rate actuel couvre la cible" : "CA mensuel supplémentaire à aller chercher"}
          />
        </div>
      </Card>
    </div>
  );
}

function FinanceMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{detail}</div>
    </div>
  );
}
