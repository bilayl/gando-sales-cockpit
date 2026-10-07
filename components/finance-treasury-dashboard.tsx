"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Calculator, CircleAlert, PiggyBank, Save, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DecisionData = {
  forecast?: {
    currentMonthRunRateCautions?: number;
    trailing?: {
      measuredContributionPerCautionCents?: number;
    };
  };
};

type CostControlData = {
  entries?: Array<{
    year: number;
    monthNumber: number;
    amount: number;
    family?: string;
  }>;
};

type TreasuryInputs = {
  treasury: number;
  safetyMonths: number;
  monthlyGrowthRate: number;
};

const STORAGE_KEY = "gando-finance-planning-v1";
const DEFAULTS: TreasuryInputs = { treasury: 0, safetyMonths: 12, monthlyGrowthRate: 0.12 };

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value);
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

export function FinanceTreasuryDashboard() {
  const [inputs, setInputs] = useState<TreasuryInputs>(DEFAULTS);
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null);
  const [costData, setCostData] = useState<CostControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setInputs({
          treasury: Number(parsed.treasury || 0),
          safetyMonths: Number(parsed.safetyMonths || 12),
          monthlyGrowthRate: Number(parsed.monthlyGrowthRate ?? 0.12),
        });
      }
    } catch {
      // Keep defaults.
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

  const model = useMemo(() => {
    const now = new Date();
    const monthlyOperatingCosts = (costData?.entries || [])
      .filter(row =>
        row.year === now.getFullYear() &&
        row.monthNumber === now.getMonth() + 1 &&
        (row.family === "structure" || row.family === "acquisition")
      )
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const contributionPerCaution = Number(decisionData?.forecast?.trailing?.measuredContributionPerCautionCents || 0) / 100;
    const runRateCautions = Number(decisionData?.forecast?.currentMonthRunRateCautions || 0);
    const currentContribution = contributionPerCaution * runRateCautions;
    const netBurn = Math.max(0, monthlyOperatingCosts - currentContribution);
    const runway = netBurn > 0 ? inputs.treasury / netBurn : Number.POSITIVE_INFINITY;
    const safetyReserve = monthlyOperatingCosts * inputs.safetyMonths;
    const investableCash = Math.max(0, inputs.treasury - safetyReserve);
    const breakEvenCautions = contributionPerCaution > 0
      ? Math.ceil(monthlyOperatingCosts / contributionPerCaution)
      : null;

    let cash = inputs.treasury;
    const forecast = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const cautions = runRateCautions * Math.pow(1 + inputs.monthlyGrowthRate, index);
      const contribution = cautions * contributionPerCaution;
      const cashFlow = contribution - monthlyOperatingCosts;
      cash += cashFlow;
      return { month, cautions, contribution, operatingCosts: monthlyOperatingCosts, cashFlow, cash };
    });

    return {
      monthlyOperatingCosts,
      contributionPerCaution,
      runRateCautions,
      currentContribution,
      netBurn,
      runway,
      safetyReserve,
      investableCash,
      breakEvenCautions,
      forecast,
      month12Cash: forecast.at(-1)?.cash || inputs.treasury,
    };
  }, [costData, decisionData, inputs]);

  function update<K extends keyof TreasuryInputs>(key: K, value: TreasuryInputs[K]) {
    setInputs(current => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    try {
      const previous = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...previous, ...inputs }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      // Keep dashboard usable without persistence.
    }
  }

  if (loading) return <Skeleton className="h-[620px] w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-primary/[0.025] px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <WalletCards className="size-3.5" /> Trésorerie
            </div>
            <h2 className="mt-1 text-lg font-bold">Combien de mois Gando peut tenir et combien peut être investi</h2>
            <p className="mt-1 max-w-3xl text-[11px] text-muted-foreground">
              La trésorerie est mise au premier plan : cash disponible, burn net, runway, réserve de sécurité et projection à 12 mois.
            </p>
          </div>
          <Button size="sm" className="h-8 gap-1.5" onClick={save}>
            <Save className="size-3.5" /> {saved ? "Enregistré" : "Enregistrer"}
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Trésorerie disponible", euro(inputs.treasury), "Cash actuel"],
            ["Burn net / mois", euro(model.netBurn), "Dépenses structure + acquisition - contribution"],
            ["Runway", Number.isFinite(model.runway) ? model.runway.toFixed(1) + " mois" : "∞", "Autonomie au burn actuel"],
            ["Réserve de sécurité", euro(model.safetyReserve), inputs.safetyMonths + " mois de dépenses"],
            ["Cash investissable", euro(model.investableCash), "Au-delà de la réserve"],
          ].map(([label, value, helper]) => (
            <div key={label} className="border-border px-4 py-4 sm:border-l first:sm:border-l-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{helper}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Calculator className="size-4 text-primary" />
            <div className="text-sm font-semibold">Hypothèses de trésorerie</div>
          </div>
          <div className="grid gap-4 p-4">
            <Field label="Trésorerie disponible" value={inputs.treasury} suffix="€" onChange={value => update("treasury", value)} />
            <Field label="Réserve de sécurité" value={inputs.safetyMonths} suffix="mois" onChange={value => update("safetyMonths", Math.max(1, value))} />
            <Field label="Croissance mensuelle des cautions" value={inputs.monthlyGrowthRate * 100} suffix="%" onChange={value => update("monthlyGrowthRate", value / 100)} />
          </div>
          <div className="divide-y divide-border border-t border-border">
            <TreasuryMetric label="Dépenses opérationnelles / mois" value={euro(model.monthlyOperatingCosts)} detail="Structure + acquisition enregistrées" />
            <TreasuryMetric label="Contribution actuelle / mois" value={euro(model.currentContribution)} detail={integer(model.runRateCautions) + " cautions au run-rate"} />
            <TreasuryMetric label="Cautions nécessaires au point mort" value={integer(model.breakEvenCautions)} detail={euro(model.contributionPerCaution, 2) + " de contribution par caution"} />
            <TreasuryMetric label="Trésorerie projetée à M12" value={euro(model.month12Cash)} detail="Scénario organique" />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <PiggyBank className="size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Projection de cash · 12 mois</div>
              <div className="text-[10px] text-muted-foreground">Sans nouveau recrutement : croissance du volume et dépenses opérationnelles actuelles.</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Cautions</TableHead>
                  <TableHead className="text-right">Contribution</TableHead>
                  <TableHead className="text-right">Dépenses</TableHead>
                  <TableHead className="text-right">Cash-flow</TableHead>
                  <TableHead className="text-right">Trésorerie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.forecast.map(row => (
                  <TableRow key={row.month}>
                    <TableCell className="font-semibold">M{row.month}</TableCell>
                    <TableCell className="text-right">{integer(row.cautions)}</TableCell>
                    <TableCell className="text-right">{euro(row.contribution)}</TableCell>
                    <TableCell className="text-right">{euro(row.operatingCosts)}</TableCell>
                    <TableCell className={"text-right font-semibold " + (row.cashFlow < 0 ? "text-destructive" : "text-emerald-600")}>
                      {row.cashFlow > 0 ? "+" : ""}{euro(row.cashFlow)}
                    </TableCell>
                    <TableCell className={"text-right font-semibold " + (row.cash < 0 ? "text-destructive" : "")}>{euro(row.cash)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="flex gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>Le runway doit être lu avec les dépenses mensuelles réellement enregistrées. Une dépense absente du ledger Finance rend automatiquement le burn trop optimiste.</span>
      </div>
    </div>
  );
}

function Field({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div className="relative mt-1.5">
        <Input type="number" value={Number.isFinite(value) ? value : 0} onChange={event => onChange(Number(event.target.value || 0))} className="h-9 pr-14 text-right font-medium" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>
      </div>
    </label>
  );
}

function TreasuryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}
