"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  Building2,
  Calculator,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type KpiRow = {
  id?: string;
  year: number;
  monthNumber: number;
  month: string;
  revenue: number | null;
  tdv: number | null;
  deposits: number | null;
  activeRenters: number | null;
  newUsers: number | null;
  registeredUsers: number | null;
  totalClients: number | null;
  cumulativeDepositVolume: number | null;
  depositCashouts: number | null;
  cashoutAmount: number | null;
  advancedGuarantee: number | null;
  churnedRenters: number | null;
  churnRate: number | null;
  growth: number | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

type Assumptions = {
  depositGrowth: number;
  depositsPerRenter: number;
  tdvPerDeposit: number;
  takeRate: number;
  newUsersPerMonth: number;
  newClientsPerMonth: number;
  cashoutRate: number;
  cashoutAmount: number;
  guaranteeShare: number;
  churnRate: number;
};

type SimulationRow = KpiRow & { actual?: KpiRow };

type NumericKey = Exclude<keyof KpiRow, "id" | "year" | "monthNumber" | "month" | "updatedAt" | "updatedBy">;

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const EDIT_FIELDS: Array<{ key: NumericKey; label: string; suffix?: string; percent?: boolean }> = [
  { key: "revenue", label: "Revenu", suffix: "€" },
  { key: "tdv", label: "TDV", suffix: "€" },
  { key: "deposits", label: "Cautions activées" },
  { key: "activeRenters", label: "Loueurs actifs (MAU)" },
  { key: "newUsers", label: "Nouveaux utilisateurs" },
  { key: "registeredUsers", label: "Utilisateurs inscrits" },
  { key: "totalClients", label: "Nombre total de clients" },
  { key: "cumulativeDepositVolume", label: "Volume de caution cumulé", suffix: "€" },
  { key: "depositCashouts", label: "Encaissements de caution" },
  { key: "cashoutAmount", label: "Montant des encaissements", suffix: "€" },
  { key: "advancedGuarantee", label: "Garantie Gando avancée", suffix: "€" },
  { key: "churnedRenters", label: "Loueurs churnés" },
  { key: "churnRate", label: "Taux de churn", percent: true },
  { key: "growth", label: "Croissance mensuelle cautions", percent: true },
];

function euro(value: number | null | undefined, maximumFractionDigits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits }).format(value);
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
}

function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value);
}

function monthIndex(row: Pick<KpiRow, "year" | "monthNumber">) {
  return row.year * 12 + row.monthNumber - 1;
}

function monthFromIndex(index: number) {
  const year = Math.floor(index / 12);
  const monthNumber = (index % 12) + 1;
  return { year, monthNumber, month: MONTHS[monthNumber - 1] };
}

function keyFor(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function isFilled(row: KpiRow) {
  return EDIT_FIELDS.some(field => row[field.key] != null);
}

function mean(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function averageRatio(rows: KpiRow[], numerator: NumericKey, denominator: NumericKey) {
  return mean(rows.map(row => {
    const top = row[numerator];
    const bottom = row[denominator];
    return typeof top === "number" && typeof bottom === "number" && bottom > 0 ? top / bottom : null;
  }));
}

function averageSequentialGrowth(rows: KpiRow[], key: NumericKey) {
  const sorted = [...rows].sort((a, b) => monthIndex(a) - monthIndex(b));
  const rates: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const previousValue = previous[key];
    const currentValue = current[key];
    if (
      monthIndex(current) - monthIndex(previous) === 1
      && typeof previousValue === "number"
      && typeof currentValue === "number"
      && previousValue > 0
    ) {
      rates.push(currentValue / previousValue - 1);
    }
  }
  return mean(rates);
}

function averageSequentialIncrement(rows: KpiRow[], key: NumericKey) {
  const sorted = [...rows].sort((a, b) => monthIndex(a) - monthIndex(b));
  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const previousValue = previous[key];
    const currentValue = current[key];
    if (
      monthIndex(current) - monthIndex(previous) === 1
      && typeof previousValue === "number"
      && typeof currentValue === "number"
    ) {
      deltas.push(currentValue - previousValue);
    }
  }
  return mean(deltas);
}

function firstKnown(rows: KpiRow[], key: NumericKey) {
  const sorted = [...rows].sort((a, b) => monthIndex(a) - monthIndex(b));
  return sorted.find(row => typeof row[key] === "number") || null;
}

function safe(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function blankRow(year: number, monthNumber: number): KpiRow {
  return {
    year,
    monthNumber,
    month: MONTHS[monthNumber - 1],
    revenue: null,
    tdv: null,
    deposits: null,
    activeRenters: null,
    newUsers: null,
    registeredUsers: null,
    totalClients: null,
    cumulativeDepositVolume: null,
    depositCashouts: null,
    cashoutAmount: null,
    advancedGuarantee: null,
    churnedRenters: null,
    churnRate: null,
    growth: null,
  };
}

function EditableNumber({
  label,
  value,
  onChange,
  suffix,
  percentValue,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  suffix?: string;
  percentValue?: boolean;
}) {
  const displayed = value == null ? "" : String(percentValue ? value * 100 : value);
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <div className="relative">
        <Input
          type="number"
          step="any"
          value={displayed}
          onChange={event => {
            if (event.target.value === "") return onChange(null);
            const parsed = Number(event.target.value);
            if (!Number.isFinite(parsed)) return;
            onChange(percentValue ? parsed / 100 : parsed);
          }}
          className={cn("h-10 bg-white dark:bg-white/[0.04]", suffix && "pr-8")}
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span> : null}
      </div>
    </label>
  );
}

function AssumptionInput({
  label,
  value,
  onChange,
  suffix,
  percentValue,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  percentValue?: boolean;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="relative mt-2">
        <Input
          type="number"
          step="any"
          value={Number((percentValue ? value * 100 : value).toFixed(percentValue ? 2 : 2))}
          onChange={event => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) onChange(percentValue ? parsed / 100 : parsed);
          }}
          className="h-9 bg-slate-50 font-semibold dark:bg-white/[0.04]"
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{suffix}</span> : null}
      </div>
      {helper ? <div className="mt-1.5 text-[10px] leading-4 text-slate-400">{helper}</div> : null}
    </div>
  );
}

export function KpiBusinessDashboard({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"real" | "simulation">("real");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [draft, setDraft] = useState<KpiRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [horizon, setHorizon] = useState(12);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);

  async function loadRows() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/kpi", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible de charger les KPI");
      setRows(Array.isArray(body.rows) ? body.rows : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les KPI");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => monthIndex(a) - monthIndex(b)), [rows]);
  const actualRows = useMemo(() => sortedRows.filter(isFilled), [sortedRows]);
  const lastClosed = actualRows.at(-1) || sortedRows[0] || null;

  const historical = useMemo(() => {
    const revenue = mean(actualRows.map(row => row.revenue));
    const tdv = mean(actualRows.map(row => row.tdv));
    const deposits = mean(actualRows.map(row => row.deposits));
    const mau = mean(actualRows.map(row => row.activeRenters));
    const newUsers = mean(actualRows.map(row => row.newUsers));
    const arpu = averageRatio(actualRows, "revenue", "activeRenters");
    const takeRate = averageRatio(actualRows, "revenue", "tdv");
    const tdvPerDeposit = averageRatio(actualRows, "tdv", "deposits");
    const depositsPerRenter = averageRatio(actualRows, "deposits", "activeRenters");
    const depositGrowth = averageSequentialGrowth(actualRows, "deposits");
    const newClientsPerMonth = averageSequentialIncrement(actualRows, "totalClients");
    const churnRateFromRows = mean(actualRows.map(row => row.churnRate));
    const churnRateFromCounts = averageRatio(actualRows, "churnedRenters", "activeRenters");
    const cashoutRate = averageRatio(actualRows, "depositCashouts", "deposits");
    const cashoutAmount = averageRatio(actualRows, "cashoutAmount", "depositCashouts");
    const guaranteeShare = averageRatio(actualRows, "advancedGuarantee", "cashoutAmount");
    return {
      revenue,
      tdv,
      deposits,
      mau,
      newUsers,
      arpu,
      takeRate,
      tdvPerDeposit,
      depositsPerRenter,
      depositGrowth,
      newClientsPerMonth,
      cashoutRate,
      cashoutAmount,
      guaranteeShare,
      churnRate: churnRateFromRows || churnRateFromCounts || 0,
    };
  }, [actualRows]);

  useEffect(() => {
    setAssumptions({
      depositGrowth: historical.depositGrowth,
      depositsPerRenter: historical.depositsPerRenter || 1,
      tdvPerDeposit: historical.tdvPerDeposit,
      takeRate: historical.takeRate,
      newUsersPerMonth: historical.newUsers,
      newClientsPerMonth: historical.newClientsPerMonth,
      cashoutRate: historical.cashoutRate,
      cashoutAmount: historical.cashoutAmount,
      guaranteeShare: historical.guaranteeShare,
      churnRate: historical.churnRate,
    });
  }, [historical]);

  useEffect(() => {
    if (!rows.length || selectedMonth) return;
    const now = new Date();
    const value = keyFor(now.getFullYear(), now.getMonth() + 1);
    setSelectedMonth(value);
  }, [rows, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) return;
    const [yearRaw, monthRaw] = selectedMonth.split("-");
    const year = Number(yearRaw);
    const monthNumber = Number(monthRaw);
    if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) return;
    const existing = rows.find(row => row.year === year && row.monthNumber === monthNumber);
    setDraft(existing ? { ...existing } : blankRow(year, monthNumber));
    setSaveMessage("");
  }, [selectedMonth, rows]);

  const simulationRows = useMemo<SimulationRow[]>(() => {
    if (!sortedRows.length || !actualRows.length || !assumptions) return [];
    const start = sortedRows[0];
    const lastActual = actualRows.at(-1) || start;
    const startIndex = monthIndex(start);
    const endIndex = monthIndex(lastActual) + horizon;
    const actualByKey = new Map(sortedRows.map(row => [keyFor(row.year, row.monthNumber), row]));

    const firstDeposits = firstKnown(sortedRows, "deposits");
    const initialDeposits = Math.max(0, Number(firstDeposits?.deposits || 0));
    const firstRegistered = firstKnown(sortedRows, "registeredUsers");
    const firstClients = firstKnown(sortedRows, "totalClients");
    const registeredOffset = firstRegistered ? Math.max(0, monthIndex(firstRegistered) - startIndex) : 0;
    const clientsOffset = firstClients ? Math.max(0, monthIndex(firstClients) - startIndex) : 0;

    let deposits = initialDeposits;
    let registeredUsers = Math.max(0, Number(firstRegistered?.registeredUsers || 0) - assumptions.newUsersPerMonth * registeredOffset);
    let totalClients = Math.max(0, Number(firstClients?.totalClients || 0) - assumptions.newClientsPerMonth * clientsOffset);
    let cumulativeVolume = 0;
    const result: SimulationRow[] = [];

    for (let index = startIndex; index <= endIndex; index += 1) {
      const date = monthFromIndex(index);
      if (index > startIndex) deposits = Math.max(0, deposits * (1 + assumptions.depositGrowth));
      const activeRenters = assumptions.depositsPerRenter > 0 ? deposits / assumptions.depositsPerRenter : 0;
      const tdv = Math.max(0, deposits * assumptions.tdvPerDeposit);
      const revenue = Math.max(0, tdv * assumptions.takeRate);
      const newUsers = Math.max(0, assumptions.newUsersPerMonth);
      if (index > startIndex) registeredUsers += newUsers;
      if (index > startIndex) totalClients += Math.max(0, assumptions.newClientsPerMonth);
      cumulativeVolume += tdv;
      const depositCashouts = Math.max(0, deposits * assumptions.cashoutRate);
      const cashoutAmount = Math.max(0, depositCashouts * assumptions.cashoutAmount);
      const advancedGuarantee = Math.max(0, cashoutAmount * assumptions.guaranteeShare);
      const churnedRenters = Math.max(0, activeRenters * assumptions.churnRate);
      const actual = actualByKey.get(keyFor(date.year, date.monthNumber));

      result.push({
        year: date.year,
        monthNumber: date.monthNumber,
        month: date.month,
        revenue,
        tdv,
        deposits,
        activeRenters,
        newUsers,
        registeredUsers,
        totalClients,
        cumulativeDepositVolume: cumulativeVolume,
        depositCashouts,
        cashoutAmount,
        advancedGuarantee,
        churnedRenters,
        churnRate: assumptions.churnRate,
        growth: assumptions.depositGrowth,
        actual,
      });
    }
    return result;
  }, [sortedRows, actualRows, assumptions, horizon]);

  const projected = simulationRows.at(-1) || null;

  async function saveDraft() {
    if (!draft || !canEdit) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/kpi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Enregistrement impossible");
      setRows(Array.isArray(body.rows) ? body.rows : rows);
      setSaveMessage("Données enregistrées");
      setEditorOpen(false);
    } catch (reason) {
      setSaveMessage(reason instanceof Error ? reason.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  function openMonth(row: KpiRow) {
    if (!canEdit) return;
    setSelectedMonth(keyFor(row.year, row.monthNumber));
    setEditorOpen(true);
  }

  const takeRate = lastClosed?.revenue != null && lastClosed?.tdv ? lastClosed.revenue / lastClosed.tdv : null;
  const arpu = lastClosed?.revenue != null && lastClosed?.activeRenters ? lastClosed.revenue / lastClosed.activeRenters : null;

  if (loading) {
    return <div className="py-20 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Chargement des KPI…</div>;
  }

  return (
    <div>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
            <TrendingUp className="h-3.5 w-3.5" /> Pilotage entreprise
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">Business KPI</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Saisissez les chiffres réels, puis simulez Gando à partir de ses moyennes historiques.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <Button size="sm" variant={mode === "real" ? "secondary" : "ghost"} onClick={() => setMode("real")}>Réel</Button>
          <Button size="sm" variant={mode === "simulation" ? "secondary" : "ghost"} onClick={() => setMode("simulation")}>
            <Calculator className="mr-1.5 h-4 w-4" /> Simulation
          </Button>
        </div>
      </section>

      {error ? <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {mode === "real" ? (
        <>
          <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Revenu", value: euro(lastClosed?.revenue, 2), helper: "dernier mois renseigné", icon: Banknote },
              { label: "TDV", value: euro(lastClosed?.tdv), helper: "volume traité", icon: WalletCards },
              { label: "Take rate", value: percent(takeRate), helper: "revenu / TDV", icon: TrendingUp },
              { label: "Cautions activées", value: integer(lastClosed?.deposits), helper: "sur le mois", icon: ShieldCheck },
              { label: "Loueurs actifs", value: integer(lastClosed?.activeRenters), helper: "MAU", icon: Building2 },
              { label: "ARPU loueur", value: euro(arpu, 2), helper: "revenu / loueur actif", icon: Activity },
            ].map(({ label, value, helper, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"><Icon className="h-4 w-4" /></span>
                </div>
                <div className="mt-5 text-[25px] font-semibold tracking-[-0.04em]">{value}</div>
                <div className="mt-1 text-[11px] text-slate-400">{helper}</div>
              </article>
            ))}
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div>
                <h2 className="text-base font-semibold">Suivi mensuel</h2>
                <p className="mt-1 text-xs text-slate-400">Cliquez sur un mois pour saisir ou corriger ses données.</p>
              </div>
              {canEdit ? (
                <Button size="sm" onClick={() => setEditorOpen(current => !current)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Saisir un mois
                </Button>
              ) : null}
            </div>

            {editorOpen && canEdit && draft ? (
              <div className="border-b border-slate-100 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mois à saisir</span>
                    <Input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="h-10 w-44 bg-white dark:bg-white/[0.04]" />
                  </label>
                  <div className="text-xs text-slate-400">Les champs laissés vides restent inconnus et ne sont pas forcés à zéro.</div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {EDIT_FIELDS.map(field => (
                    <EditableNumber
                      key={field.key}
                      label={field.label}
                      value={draft[field.key] as number | null}
                      suffix={field.suffix}
                      percentValue={field.percent}
                      onChange={value => setDraft(current => current ? { ...current, [field.key]: value } as KpiRow : current)}
                    />
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-end gap-3">
                  {saveMessage ? <span className="text-xs text-slate-500">{saveMessage}</span> : null}
                  <Button variant="outline" onClick={() => setEditorOpen(false)}>Annuler</Button>
                  <Button onClick={saveDraft} disabled={saving}>
                    {saving ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                    Enregistrer
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:bg-white/[0.025]">
                  <tr>
                    <th className="px-5 py-3">Mois</th>
                    <th className="px-4 py-3">Revenu</th>
                    <th className="px-4 py-3">TDV</th>
                    <th className="px-4 py-3">Take rate</th>
                    <th className="px-4 py-3">Cautions</th>
                    <th className="px-4 py-3">MAU</th>
                    <th className="px-4 py-3">ARPU</th>
                    <th className="px-4 py-3">Nouveaux users</th>
                    <th className="px-4 py-3">Croissance</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/10">
                  {sortedRows.map(row => {
                    const future = !isFilled(row);
                    const rowTakeRate = row.revenue != null && row.tdv ? row.revenue / row.tdv : null;
                    const rowArpu = row.revenue != null && row.activeRenters ? row.revenue / row.activeRenters : null;
                    return (
                      <tr key={keyFor(row.year, row.monthNumber)} className={cn(future && "text-slate-300 dark:text-slate-600", !future && "hover:bg-slate-50/70 dark:hover:bg-white/[0.02]")}>
                        <td className="px-5 py-3.5 font-medium">{row.month} <span className="ml-1 text-xs font-normal text-slate-400">{row.year}</span></td>
                        <td className="px-4 py-3.5 font-medium">{euro(row.revenue, 2)}</td>
                        <td className="px-4 py-3.5">{euro(row.tdv)}</td>
                        <td className="px-4 py-3.5">{percent(rowTakeRate)}</td>
                        <td className="px-4 py-3.5">{integer(row.deposits)}</td>
                        <td className="px-4 py-3.5">{integer(row.activeRenters)}</td>
                        <td className="px-4 py-3.5">{euro(rowArpu, 2)}</td>
                        <td className="px-4 py-3.5">{integer(row.newUsers)}</td>
                        <td className="px-4 py-3.5">{percent(row.growth)}</td>
                        <td className="px-4 py-3.5 text-right">
                          {canEdit ? <Button size="sm" variant="ghost" onClick={() => openMonth(row)}><Pencil className="h-3.5 w-3.5" /></Button> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : assumptions ? (
        <>
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Moyennes historiques</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Le moteur repart du premier mois connu et rejoue la croissance avec les moyennes observées. Toutes les hypothèses restent modifiables.</p>
              </div>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/[0.05]">
                {[6, 12, 24].map(value => <Button key={value} size="sm" variant={horizon === value ? "secondary" : "ghost"} onClick={() => setHorizon(value)}>+{value} mois</Button>)}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Revenu moyen / mois", euro(historical.revenue, 2)],
                ["TDV moyen / mois", euro(historical.tdv)],
                ["Cautions / mois", decimal(historical.deposits, 1)],
                ["MAU moyen", decimal(historical.mau, 1)],
                ["ARPU moyen", euro(historical.arpu, 2)],
                ["Take rate moyen", percent(historical.takeRate, 2)],
                ["TDV / caution", euro(historical.tdvPerDeposit, 2)],
                ["Cautions / loueur", decimal(historical.depositsPerRenter, 2)],
                ["Nouveaux users / mois", decimal(historical.newUsers, 1)],
                ["Croissance cautions", percent(historical.depositGrowth, 1)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-white/[0.035]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div>
                  <div className="mt-1.5 text-lg font-semibold tracking-[-0.02em]">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-white/10">
              <div className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Hypothèses de simulation</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <AssumptionInput label="Croissance cautions" value={assumptions.depositGrowth} percentValue onChange={value => setAssumptions(current => current ? { ...current, depositGrowth: value } : current)} helper="moyenne mensuelle historique" />
                <AssumptionInput label="Cautions / loueur" value={assumptions.depositsPerRenter} onChange={value => setAssumptions(current => current ? { ...current, depositsPerRenter: value } : current)} />
                <AssumptionInput label="TDV / caution" value={assumptions.tdvPerDeposit} suffix="€" onChange={value => setAssumptions(current => current ? { ...current, tdvPerDeposit: value } : current)} />
                <AssumptionInput label="Take rate" value={assumptions.takeRate} percentValue onChange={value => setAssumptions(current => current ? { ...current, takeRate: value } : current)} />
                <AssumptionInput label="Nouveaux users / mois" value={assumptions.newUsersPerMonth} onChange={value => setAssumptions(current => current ? { ...current, newUsersPerMonth: value } : current)} />
                <AssumptionInput label="Nouveaux clients / mois" value={assumptions.newClientsPerMonth} onChange={value => setAssumptions(current => current ? { ...current, newClientsPerMonth: value } : current)} />
                <AssumptionInput label="Taux d’encaissement" value={assumptions.cashoutRate} percentValue onChange={value => setAssumptions(current => current ? { ...current, cashoutRate: value } : current)} />
                <AssumptionInput label="Montant / encaissement" value={assumptions.cashoutAmount} suffix="€" onChange={value => setAssumptions(current => current ? { ...current, cashoutAmount: value } : current)} />
                <AssumptionInput label="Part garantie avancée" value={assumptions.guaranteeShare} percentValue onChange={value => setAssumptions(current => current ? { ...current, guaranteeShare: value } : current)} />
                <AssumptionInput label="Churn loueurs" value={assumptions.churnRate} percentValue onChange={value => setAssumptions(current => current ? { ...current, churnRate: value } : current)} />
              </div>
            </div>
          </section>

          {projected ? (
            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                ["Revenu projeté", euro(projected.revenue, 2), Banknote],
                ["TDV projeté", euro(projected.tdv), WalletCards],
                ["Cautions", integer(projected.deposits), ShieldCheck],
                ["Loueurs actifs", integer(projected.activeRenters), Building2],
                ["ARPU", projected.activeRenters ? euro((projected.revenue || 0) / projected.activeRenters, 2) : "—", Activity],
                ["Users inscrits", integer(projected.registeredUsers), UsersRound],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof Banknote;
                return (
                  <div key={String(label)} className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                    <div className="flex items-center justify-between text-xs text-violet-700 dark:text-violet-300"><span>{label}</span><MetricIcon className="h-4 w-4" /></div>
                    <div className="mt-4 text-2xl font-semibold tracking-[-0.035em]">{String(value)}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{projected.month} {projected.year}</div>
                  </div>
                );
              })}
            </section>
          ) : null}

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-semibold">Réel vs simulation depuis le début</h2>
              <p className="mt-1 text-xs text-slate-400">La série simulée commence au premier mois du suivi et continue {horizon} mois après le dernier mois réel.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:bg-white/[0.025]">
                  <tr>
                    <th className="px-5 py-3">Mois</th>
                    <th className="px-4 py-3">Revenu réel</th>
                    <th className="px-4 py-3">Revenu simulé</th>
                    <th className="px-4 py-3">TDV réel</th>
                    <th className="px-4 py-3">TDV simulé</th>
                    <th className="px-4 py-3">Cautions réel</th>
                    <th className="px-4 py-3">Cautions simulé</th>
                    <th className="px-4 py-3">MAU réel</th>
                    <th className="px-4 py-3">MAU simulé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/10">
                  {simulationRows.map(row => {
                    const afterActual = lastClosed ? monthIndex(row) > monthIndex(lastClosed) : false;
                    return (
                      <tr key={keyFor(row.year, row.monthNumber)} className={afterActual ? "bg-violet-50/35 dark:bg-violet-950/10" : ""}>
                        <td className="px-5 py-3.5 font-medium">{row.month} <span className="ml-1 text-xs font-normal text-slate-400">{row.year}</span></td>
                        <td className="px-4 py-3.5">{euro(row.actual?.revenue, 2)}</td>
                        <td className="px-4 py-3.5 font-semibold text-violet-700 dark:text-violet-300">{euro(row.revenue, 2)}</td>
                        <td className="px-4 py-3.5">{euro(row.actual?.tdv)}</td>
                        <td className="px-4 py-3.5 font-medium">{euro(row.tdv)}</td>
                        <td className="px-4 py-3.5">{integer(row.actual?.deposits)}</td>
                        <td className="px-4 py-3.5 font-medium">{integer(row.deposits)}</td>
                        <td className="px-4 py-3.5">{integer(row.actual?.activeRenters)}</td>
                        <td className="px-4 py-3.5 font-medium">{integer(row.activeRenters)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
