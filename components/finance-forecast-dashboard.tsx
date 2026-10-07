"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, CircleAlert, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ActualRow = {
  month: string;
  partial: boolean;
  cautions: number;
  tdvCents: number;
  revenueCents: number;
  insuranceCostCents: number;
  partnerCostCents: number;
};

type DecisionData = {
  actual?: ActualRow[];
  forecast?: {
    currentMonthRunRateCautions?: number;
    trailing?: {
      insuranceRateBps?: number;
    };
  };
};

type Family = "acquisition" | "transaction" | "risk" | "partners" | "structure";
type CostEntry = { year: number; monthNumber: number; family: Family; amount: number };
type CostData = { entries?: CostEntry[] };

type FinancialRow = {
  month: string;
  partial: boolean;
  cautions: number;
  revenue: number;
  operatingCosts: number;
  transactionCosts: number;
  riskCosts: number;
  partnerCosts: number;
  totalCosts: number;
  result: number;
  margin: number | null;
};

const STORAGE_KEY = "gando-finance-forecast-v1";

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value);
}
function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}
function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value);
}
function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}
function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function FinanceForecastDashboard() {
  const [decision, setDecision] = useState<DecisionData | null>(null);
  const [costs, setCosts] = useState<CostData | null>(null);
  const [growth, setGrowth] = useState(0.12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved != null) setGrowth(Number(saved) || 0);
    } catch {}

    void (async () => {
      try {
        const [decisionResponse, costResponse] = await Promise.all([
          fetch("/api/kpi/decision-intelligence", { cache: "no-store" }),
          fetch("/api/kpi/cost-control", { cache: "no-store" }),
        ]);
        const [decisionBody, costBody] = await Promise.all([decisionResponse.json(), costResponse.json()]);
        if (!decisionResponse.ok) throw new Error(decisionBody.error || "Impossible de charger le réel Gando.");
        if (!costResponse.ok) throw new Error(costBody.error || "Impossible de charger les dépenses.");
        setDecision(decisionBody);
        setCosts(costBody);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger le prévisionnel.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const actual = useMemo<FinancialRow[]>(() => {
    const entries = costs?.entries || [];
    return (decision?.actual || []).map(row => {
      const [year, monthNumber] = row.month.split("-").map(Number);
      const monthEntries = entries.filter(entry => entry.year === year && entry.monthNumber === monthNumber);
      const family = (name: Family) => monthEntries.filter(entry => entry.family === name).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const revenue = Number(row.revenueCents || 0) / 100;
      const operatingCosts = family("acquisition") + family("structure");
      const manualTransaction = family("transaction");
      const manualRisk = family("risk");
      const manualPartners = family("partners");
      const transactionCosts = manualTransaction > 0 ? manualTransaction : revenue * 0.016 + Number(row.cautions || 0) * 0.35;
      const riskCosts = manualRisk > 0 ? manualRisk : Number(row.insuranceCostCents || 0) / 100;
      const partnerCosts = manualPartners > 0 ? manualPartners : Number(row.partnerCostCents || 0) / 100;
      const totalCosts = operatingCosts + transactionCosts + riskCosts + partnerCosts;
      const result = revenue - totalCosts;
      return {
        month: row.month,
        partial: Boolean(row.partial),
        cautions: Number(row.cautions || 0),
        revenue,
        operatingCosts,
        transactionCosts,
        riskCosts,
        partnerCosts,
        totalCosts,
        result,
        margin: revenue > 0 ? result / revenue : null,
      };
    });
  }, [costs, decision]);

  const completed = actual.filter(row => !row.partial && row.revenue > 0);
  const latest = completed.at(-1) || null;
  const trailing = completed.slice(-3);
  const trailingRevenue = trailing.reduce((sum, row) => sum + row.revenue, 0);
  const trailingVariable = trailing.reduce((sum, row) => sum + row.transactionCosts + row.riskCosts + row.partnerCosts, 0);
  const variableRate = trailingRevenue > 0 ? trailingVariable / trailingRevenue : 0;
  const operatingBase = trailing.length ? trailing.reduce((sum, row) => sum + row.operatingCosts, 0) / trailing.length : 0;

  const forecast = useMemo(() => {
    if (!latest) return [];
    return Array.from({ length: 12 }, (_, index) => {
      const offset = index + 1;
      const revenue = latest.revenue * Math.pow(1 + growth, offset);
      const variableCosts = revenue * variableRate;
      const result = revenue - variableCosts - operatingBase;
      return {
        month: shiftMonth(latest.month, offset),
        revenue,
        variableCosts,
        operatingCosts: operatingBase,
        result,
        margin: revenue > 0 ? result / revenue : null,
      };
    });
  }, [growth, latest, operatingBase, variableRate]);

  if (loading) return <Skeleton className="h-[680px] w-full rounded-xl" />;

  const current = actual.at(-1) || null;
  const month12 = forecast.at(-1) || null;
  const insuranceRate = Number(decision?.forecast?.trailing?.insuranceRateBps || 114) / 10000;

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div> : null}

      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-primary/[0.025] px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary"><TrendingUp className="size-3.5" /> Prévisionnel financier</div>
            <h2 className="mt-1 text-lg font-bold">Partir du vrai résultat avant de projeter la croissance</h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">Le dernier mois complet réel sert de base. Septembre est donc intégré au CA historique avant toute projection.</p>
          </div>
          <label className="w-full max-w-[220px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Croissance mensuelle</span>
            <div className="relative mt-1.5">
              <Input type="number" step="1" value={growth * 100} onChange={event => {
                const next=Number(event.target.value || 0)/100;
                setGrowth(next);
                try { window.localStorage.setItem(STORAGE_KEY,String(next)); } catch {}
              }} className="h-9 pr-9 text-right font-semibold" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
            </div>
          </label>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Dernier CA complet", euro(latest?.revenue), latest ? monthLabel(latest.month) : "—"],
            ["Dépenses du dernier mois", euro(latest?.totalCosts), "Variables automatiques + ledger"],
            ["Résultat du dernier mois", euro(latest?.result), latest?.margin != null ? percent(latest.margin) + " de marge" : "—"],
            ["Assurance", percent(insuranceRate, 2), "Sur le volume sécurisé"],
            ["CA projeté à M12", euro(month12?.revenue), month12 ? "Résultat " + euro(month12.result) : "—"],
          ].map(([label,value,helper]) => (
            <div key={label} className="border-border px-4 py-4 sm:border-l first:sm:border-l-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{helper}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Calculator className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Réel financier</div>
            <div className="text-[10px] text-muted-foreground">Le CA vient du flux Gando réel ; les dépenses structure/acquisition viennent du ledger.</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Mois</TableHead><TableHead className="text-right">Cautions</TableHead><TableHead className="text-right">CA</TableHead><TableHead className="text-right">Coûts variables</TableHead><TableHead className="text-right">Structure + acquisition</TableHead><TableHead className="text-right">Résultat</TableHead><TableHead className="text-right">Marge</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {actual.slice(-8).map(row => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{monthLabel(row.month)}{row.partial ? " · en cours" : ""}</TableCell>
                  <TableCell className="text-right">{integer(row.cautions)}</TableCell>
                  <TableCell className="text-right font-semibold">{euro(row.revenue)}</TableCell>
                  <TableCell className="text-right">{euro(row.transactionCosts + row.riskCosts + row.partnerCosts)}</TableCell>
                  <TableCell className="text-right">{euro(row.operatingCosts)}</TableCell>
                  <TableCell className={"text-right font-semibold " + (row.result < 0 ? "text-destructive" : "text-emerald-600")}>{row.result > 0 ? "+" : ""}{euro(row.result)}</TableCell>
                  <TableCell className="text-right">{percent(row.margin)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3"><div className="text-sm font-semibold">Projection 12 mois</div><div className="text-[10px] text-muted-foreground">CA, coûts et résultat projetés depuis le dernier mois complet.</div></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Mois</TableHead><TableHead className="text-right">CA</TableHead><TableHead className="text-right">Coûts variables</TableHead><TableHead className="text-right">Coûts fixes</TableHead><TableHead className="text-right">Résultat</TableHead><TableHead className="text-right">Marge</TableHead></TableRow></TableHeader>
            <TableBody>{forecast.map(row => (
              <TableRow key={row.month}>
                <TableCell className="font-medium">{monthLabel(row.month)}</TableCell>
                <TableCell className="text-right">{euro(row.revenue)}</TableCell>
                <TableCell className="text-right">{euro(row.variableCosts)}</TableCell>
                <TableCell className="text-right">{euro(row.operatingCosts)}</TableCell>
                <TableCell className={"text-right font-semibold " + (row.result < 0 ? "text-destructive" : "text-emerald-600")}>{row.result > 0 ? "+" : ""}{euro(row.result)}</TableCell>
                <TableCell className="text-right">{percent(row.margin)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>Si une dépense structure/acquisition n’est pas saisie dans Finance, le résultat restera trop optimiste. Les coûts assurance et partenaires sont automatiques ; le PSP est estimé quand aucun coût transaction réel n’est renseigné.</span>
      </div>
    </div>
  );
}
