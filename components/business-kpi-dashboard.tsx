"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  Building2,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  TrendingDown,
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
};

type NumericKey = Exclude<keyof KpiRow, "id" | "year" | "monthNumber" | "month">;
type SourceKey =
  | "revenue"
  | "tdv"
  | "deposits"
  | "activeRenters"
  | "newUsers"
  | "registeredUsers"
  | "totalClients"
  | "depositCashouts"
  | "cashoutAmount"
  | "advancedGuarantee"
  | "churnedRenters";

type Derived = {
  takeRate: number | null;
  arpu: number | null;
  avgDeposit: number | null;
  revenuePerDeposit: number | null;
  depositsPerRenter: number | null;
  depositGrowth: number | null;
  revenueGrowth: number | null;
  tdvGrowth: number | null;
  cashoutRate: number | null;
  avgCashout: number | null;
  guaranteeShare: number | null;
  churnRate: number | null;
  cumulativeTdv: number;
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
type IconType = typeof Banknote;

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const SOURCE_FIELDS: Array<{
  key: SourceKey;
  label: string;
  group: "Revenu & volume" | "Usage" | "Risque & recouvrement";
  helper: string;
  suffix?: string;
}> = [
  { key: "revenue", label: "CA Gando du mois", group: "Revenu & volume", helper: "Revenu réellement généré par Gando sur le mois.", suffix: "€" },
  { key: "tdv", label: "€ de cautions sécurisées (TDV)", group: "Revenu & volume", helper: "Somme des montants de cautions activées sur le mois.", suffix: "€" },
  { key: "deposits", label: "Cautions activées", group: "Revenu & volume", helper: "Nombre de cautions effectivement activées." },
  { key: "activeRenters", label: "Loueurs actifs (MAU)", group: "Usage", helper: "Loueurs ayant activé au moins une caution pendant le mois." },
  { key: "newUsers", label: "Nouveaux utilisateurs", group: "Usage", helper: "Nouveaux locataires / utilisateurs créés pendant le mois." },
  { key: "registeredUsers", label: "Utilisateurs inscrits cumulés", group: "Usage", helper: "Total d'utilisateurs inscrits à fin de mois." },
  { key: "totalClients", label: "Loueurs clients cumulés", group: "Usage", helper: "Total de loueurs devenus clients à fin de mois." },
  { key: "depositCashouts", label: "Cautions encaissées", group: "Risque & recouvrement", helper: "Nombre de cautions ayant fait l'objet d'une demande d'encaissement." },
  { key: "cashoutAmount", label: "Montant encaissé / réclamé", group: "Risque & recouvrement", helper: "Montant total correspondant aux encaissements de caution.", suffix: "€" },
  { key: "advancedGuarantee", label: "Garantie Gando avancée", group: "Risque & recouvrement", helper: "Montant avancé par Gando au titre de la garantie.", suffix: "€" },
  { key: "churnedRenters", label: "Loueurs churnés", group: "Risque & recouvrement", helper: "Loueurs actifs le mois précédent qui ne sont plus actifs." },
];

const CORE_KEYS: SourceKey[] = ["revenue", "tdv", "deposits", "activeRenters"];

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value);
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
function points(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2).replace(".", ",")} pt`;
}
function n(value: number | null | undefined) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function ratio(top: number | null | undefined, bottom: number | null | undefined) {
  return typeof top === "number" && typeof bottom === "number" && bottom > 0 ? top / bottom : null;
}
function growth(current: number | null | undefined, previous: number | null | undefined) {
  return typeof current === "number" && typeof previous === "number" && previous > 0 ? current / previous - 1 : null;
}
function monthIndex(row: Pick<KpiRow, "year" | "monthNumber">) { return row.year * 12 + row.monthNumber - 1; }
function monthFromIndex(index: number) {
  const year = Math.floor(index / 12);
  const monthNumber = (index % 12) + 1;
  return { year, monthNumber, month: MONTHS[monthNumber - 1] };
}
function rowKey(year: number, monthNumber: number) { return `${year}-${String(monthNumber).padStart(2, "0")}`; }
function isFilled(row: KpiRow) { return SOURCE_FIELDS.some(field => row[field.key] != null); }
function mean(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => value != null && Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}
function averageIncrement(rows: KpiRow[], key: NumericKey) {
  const sorted = [...rows].sort((a, b) => monthIndex(a) - monthIndex(b));
  const values: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]?.[key];
    const current = sorted[i]?.[key];
    if (monthIndex(sorted[i]) - monthIndex(sorted[i - 1]) === 1 && typeof previous === "number" && typeof current === "number") values.push(current - previous);
  }
  return mean(values);
}
function firstKnown(rows: KpiRow[], key: NumericKey) {
  return [...rows].sort((a, b) => monthIndex(a) - monthIndex(b)).find(row => typeof row[key] === "number") || null;
}
function blankRow(year: number, monthNumber: number): KpiRow {
  return {
    year, monthNumber, month: MONTHS[monthNumber - 1], revenue: null, tdv: null, deposits: null,
    activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null,
    cumulativeDepositVolume: null, depositCashouts: null, cashoutAmount: null,
    advancedGuarantee: null, churnedRenters: null, churnRate: null, growth: null,
  };
}

function SourceField({ field, value, onChange }: {
  field: (typeof SOURCE_FIELDS)[number];
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035]">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{field.label}</span>
      <span className="mt-1 block min-h-8 text-[10px] leading-4 text-slate-400">{field.helper}</span>
      <div className="relative mt-2">
        <Input
          type="number"
          step="any"
          value={value == null ? "" : String(value)}
          onChange={event => {
            if (event.target.value === "") return onChange(null);
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className={cn("h-10 bg-slate-50 font-semibold dark:bg-white/[0.04]", field.suffix && "pr-8")}
        />
        {field.suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{field.suffix}</span> : null}
      </div>
    </label>
  );
}

function CalcCard({ label, value, formula, change, accent = false }: {
  label: string;
  value: string;
  formula: string;
  change?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border p-4", accent ? "border-[#735DF3]/25 bg-[#735DF3]/[0.045]" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]")}>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-[-0.035em] text-slate-900 dark:text-white">{value}</div>
      <div className="mt-2 text-[10px] leading-4 text-slate-400">Calcul : {formula}</div>
      {change ? <div className="mt-2 text-[11px] font-semibold text-[#735DF3]">{change}</div> : null}
    </div>
  );
}

function TrendBadge({ value, kind = "percent" }: { value: number | null; kind?: "percent" | "points" }) {
  if (value == null) return <span className="text-[10px] text-slate-300">pas de comparaison</span>;
  const positive = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold", positive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300")}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {kind === "points" ? points(value) : percent(value)}
    </span>
  );
}

function AssumptionField({ label, value, suffix, percentValue, onChange }: {
  label: string; value: number; suffix?: string; percentValue?: boolean; onChange: (value: number) => void;
}) {
  const shown = percentValue ? value * 100 : value;
  return (
    <label className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035]">
      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <div className="relative mt-2">
        <Input
          type="number"
          step="any"
          value={Number(shown.toFixed(2))}
          onChange={event => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(percentValue ? next / 100 : next);
          }}
          className="h-9 bg-slate-50 font-semibold dark:bg-white/[0.04]"
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function BusinessKpiDashboard({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"monthly" | "simulation">("monthly");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [draft, setDraft] = useState<KpiRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [horizon, setHorizon] = useState(12);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/kpi", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible de charger les KPI");
      setRows(Array.isArray(body.rows) ? body.rows : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les KPI");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => monthIndex(a) - monthIndex(b)), [rows]);
  const actualRows = useMemo(() => sortedRows.filter(isFilled), [sortedRows]);

  const derivedByMonth = useMemo(() => {
    const map = new Map<string, Derived>();
    let cumulativeTdv = 0;
    sortedRows.forEach((row, index) => {
      const previous = index > 0 ? sortedRows[index - 1] : null;
      cumulativeTdv += n(row.tdv);
      map.set(rowKey(row.year, row.monthNumber), {
        takeRate: ratio(row.revenue, row.tdv),
        arpu: ratio(row.revenue, row.activeRenters),
        avgDeposit: ratio(row.tdv, row.deposits),
        revenuePerDeposit: ratio(row.revenue, row.deposits),
        depositsPerRenter: ratio(row.deposits, row.activeRenters),
        depositGrowth: growth(row.deposits, previous?.deposits),
        revenueGrowth: growth(row.revenue, previous?.revenue),
        tdvGrowth: growth(row.tdv, previous?.tdv),
        cashoutRate: ratio(row.depositCashouts, row.deposits),
        avgCashout: ratio(row.cashoutAmount, row.depositCashouts),
        guaranteeShare: ratio(row.advancedGuarantee, row.cashoutAmount),
        churnRate: ratio(row.churnedRenters, previous?.activeRenters),
        cumulativeTdv,
      });
    });
    return map;
  }, [sortedRows]);

  useEffect(() => {
    if (selectedMonth || !actualRows.length) return;
    const latest = actualRows.at(-1);
    if (latest) setSelectedMonth(rowKey(latest.year, latest.monthNumber));
  }, [actualRows, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) return;
    const [yearRaw, monthRaw] = selectedMonth.split("-");
    const year = Number(yearRaw), monthNumber = Number(monthRaw);
    const existing = rows.find(row => row.year === year && row.monthNumber === monthNumber);
    setDraft(existing ? { ...existing } : blankRow(year, monthNumber));
    setMessage("");
  }, [selectedMonth, rows]);

  const selectedIndex = sortedRows.findIndex(row => rowKey(row.year, row.monthNumber) === selectedMonth);
  const selected = selectedIndex >= 0 ? sortedRows[selectedIndex] : draft;
  const previous = selectedIndex > 0 ? sortedRows[selectedIndex - 1] : null;
  const selectedDerived = selected ? derivedByMonth.get(rowKey(selected.year, selected.monthNumber)) || null : null;
  const previousDerived = previous ? derivedByMonth.get(rowKey(previous.year, previous.monthNumber)) || null : null;

  const historical = useMemo(() => {
    const derivedRows = actualRows.map(row => derivedByMonth.get(rowKey(row.year, row.monthNumber))).filter((row): row is Derived => Boolean(row));
    return {
      revenue: mean(actualRows.map(row => row.revenue)),
      tdv: mean(actualRows.map(row => row.tdv)),
      deposits: mean(actualRows.map(row => row.deposits)),
      mau: mean(actualRows.map(row => row.activeRenters)),
      newUsers: mean(actualRows.map(row => row.newUsers)),
      arpu: mean(derivedRows.map(row => row.arpu)),
      takeRate: mean(derivedRows.map(row => row.takeRate)),
      tdvPerDeposit: mean(derivedRows.map(row => row.avgDeposit)),
      depositsPerRenter: mean(derivedRows.map(row => row.depositsPerRenter)),
      depositGrowth: mean(derivedRows.map(row => row.depositGrowth)),
      newClientsPerMonth: averageIncrement(actualRows, "totalClients"),
      cashoutRate: mean(derivedRows.map(row => row.cashoutRate)),
      cashoutAmount: mean(derivedRows.map(row => row.avgCashout)),
      guaranteeShare: mean(derivedRows.map(row => row.guaranteeShare)),
      churnRate: mean(derivedRows.map(row => row.churnRate)),
    };
  }, [actualRows, derivedByMonth]);

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

  const simulation = useMemo<SimulationRow[]>(() => {
    if (!sortedRows.length || !actualRows.length || !assumptions) return [];
    const start = sortedRows[0];
    const lastActual = actualRows.at(-1) || start;
    const startIdx = monthIndex(start);
    const endIdx = monthIndex(lastActual) + horizon;
    const actualByMonth = new Map(sortedRows.map(row => [rowKey(row.year, row.monthNumber), row]));
    const firstDeposits = firstKnown(sortedRows, "deposits");
    const firstRegistered = firstKnown(sortedRows, "registeredUsers");
    const firstClients = firstKnown(sortedRows, "totalClients");
    let deposits = Number(firstDeposits?.deposits || 0);
    let registered = Math.max(0, Number(firstRegistered?.registeredUsers || 0) - assumptions.newUsersPerMonth * (firstRegistered ? monthIndex(firstRegistered) - startIdx : 0));
    let clients = Math.max(0, Number(firstClients?.totalClients || 0) - assumptions.newClientsPerMonth * (firstClients ? monthIndex(firstClients) - startIdx : 0));
    let cumulativeVolume = 0;
    const result: SimulationRow[] = [];

    for (let index = startIdx; index <= endIdx; index += 1) {
      if (index > startIdx) deposits = Math.max(0, deposits * (1 + assumptions.depositGrowth));
      const date = monthFromIndex(index);
      const activeRenters = assumptions.depositsPerRenter > 0 ? deposits / assumptions.depositsPerRenter : 0;
      const tdv = Math.max(0, deposits * assumptions.tdvPerDeposit);
      const revenue = Math.max(0, tdv * assumptions.takeRate);
      const newUsers = Math.max(0, assumptions.newUsersPerMonth);
      if (index > startIdx) { registered += newUsers; clients += Math.max(0, assumptions.newClientsPerMonth); }
      cumulativeVolume += tdv;
      const depositCashouts = Math.max(0, deposits * assumptions.cashoutRate);
      const cashoutAmount = Math.max(0, depositCashouts * assumptions.cashoutAmount);
      const advancedGuarantee = Math.max(0, cashoutAmount * assumptions.guaranteeShare);
      result.push({
        year: date.year, monthNumber: date.monthNumber, month: date.month,
        revenue, tdv, deposits, activeRenters, newUsers, registeredUsers: registered,
        totalClients: clients, cumulativeDepositVolume: cumulativeVolume,
        depositCashouts, cashoutAmount, advancedGuarantee,
        churnedRenters: Math.max(0, activeRenters * assumptions.churnRate),
        churnRate: assumptions.churnRate, growth: assumptions.depositGrowth,
        actual: actualByMonth.get(rowKey(date.year, date.monthNumber)),
      });
    }
    return result;
  }, [sortedRows, actualRows, assumptions, horizon]);

  async function save() {
    if (!draft || !canEdit) return;
    setSaving(true); setMessage("");
    try {
      const draftIndex = sortedRows.findIndex(row => monthIndex(row) >= monthIndex(draft));
      const prev = draftIndex > 0 ? sortedRows[draftIndex - 1] : null;
      const rowsBefore = sortedRows.filter(row => monthIndex(row) < monthIndex(draft));
      const payload: KpiRow = {
        ...draft,
        growth: growth(draft.deposits, prev?.deposits),
        churnRate: ratio(draft.churnedRenters, prev?.activeRenters),
        cumulativeDepositVolume: rowsBefore.reduce((sum, row) => sum + n(row.tdv), 0) + n(draft.tdv),
      };
      const response = await fetch("/api/kpi", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Enregistrement impossible");
      setRows(Array.isArray(body.rows) ? body.rows : rows);
      setEditorOpen(false); setMessage("Données sources enregistrées. Les KPI ont été recalculés.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Enregistrement impossible"); }
    finally { setSaving(false); }
  }

  function editRow(row: KpiRow) {
    if (!canEdit) return;
    setSelectedMonth(rowKey(row.year, row.monthNumber));
    setEditorOpen(true);
  }

  const signals = useMemo(() => {
    if (!selected || !selectedDerived) return [] as Array<{ tone: "good" | "watch" | "neutral"; text: string }>;
    const items: Array<{ tone: "good" | "watch" | "neutral"; text: string }> = [];
    if (!previous || !previousDerived) {
      items.push({ tone: "neutral", text: "Pas encore de mois précédent comparable pour calculer les évolutions." });
      return items;
    }
    if (selectedDerived.takeRate != null && previousDerived.takeRate != null) {
      const diff = selectedDerived.takeRate - previousDerived.takeRate;
      if (Math.abs(diff) >= 0.0005) items.push({ tone: diff >= 0 ? "good" : "watch", text: `Take rate ${diff >= 0 ? "en hausse" : "en baisse"} de ${points(Math.abs(diff))} vs ${previous.month}.` });
    }
    if (selectedDerived.depositsPerRenter != null && previousDerived.depositsPerRenter != null) {
      const diff = growth(selectedDerived.depositsPerRenter, previousDerived.depositsPerRenter);
      if (diff != null && Math.abs(diff) >= 0.03) items.push({ tone: diff >= 0 ? "good" : "watch", text: `Usage par loueur ${diff >= 0 ? "progresse" : "recule"} de ${percent(Math.abs(diff))}.` });
    }
    const mauGrowth = growth(selected.activeRenters, previous.activeRenters);
    if (mauGrowth != null && mauGrowth < 0) items.push({ tone: "watch", text: `Loueurs actifs en baisse de ${percent(Math.abs(mauGrowth))} vs le mois précédent.` });
    if (selectedDerived.churnRate != null && selectedDerived.churnRate > 0) items.push({ tone: "watch", text: `Churn loueurs calculé à ${percent(selectedDerived.churnRate)} (${integer(selected.churnedRenters)} loueur(s) churné(s)).` });
    if (!items.length) items.push({ tone: "good", text: "Aucun signal de dégradation détecté sur les principaux drivers comparables." });
    return items;
  }, [selected, previous, selectedDerived, previousDerived]);

  if (loading) return <div className="py-20 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Chargement des KPI…</div>;

  const coreFilled = selected ? CORE_KEYS.filter(key => selected[key] != null).length : 0;
  const sourceFilled = selected ? SOURCE_FIELDS.filter(field => selected[field.key] != null).length : 0;
  const projected = simulation.at(-1) || null;

  const projectionCards: Array<{ label: string; value: string; icon: IconType }> = projected ? [
    { label: "CA projeté", value: euro(projected.revenue, 2), icon: Banknote },
    { label: "TDV projeté", value: euro(projected.tdv), icon: WalletCards },
    { label: "Cautions", value: integer(projected.deposits), icon: ShieldCheck },
    { label: "Loueurs actifs", value: integer(projected.activeRenters), icon: Building2 },
    { label: "ARPU", value: projected.activeRenters ? euro((projected.revenue || 0) / projected.activeRenters, 2) : "—", icon: Activity },
    { label: "Users inscrits", value: integer(projected.registeredUsers), icon: UsersRound },
  ] : [];

  return (
    <div>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#735DF3]/20 bg-[#735DF3]/5 px-3 py-1 text-[11px] font-semibold text-[#735DF3]"><Calculator className="h-3.5 w-3.5" /> Calcul automatique</div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">Pilotage mensuel</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Tu saisis les chiffres bruts. Le Cockpit calcule les ratios, évolutions et signaux nécessaires pour piloter Gando.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <Button size="sm" variant={mode === "monthly" ? "secondary" : "ghost"} onClick={() => setMode("monthly")}>Mensuel</Button>
          <Button size="sm" variant={mode === "simulation" ? "secondary" : "ghost"} onClick={() => setMode("simulation")}><TrendingUp className="mr-1.5 h-4 w-4" /> Simulation</Button>
        </div>
      </section>

      {error ? <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {mode === "monthly" ? <>
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Mois analysé</div>
              <select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-white/10 dark:bg-[#1b1e29]">
                {sortedRows.map(row => <option key={rowKey(row.year, row.monthNumber)} value={rowKey(row.year, row.monthNumber)}>{row.month} {row.year}</option>)}
              </select>
            </div>
            <div className="h-10 w-px bg-slate-100 dark:bg-white/10" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Données essentielles</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                {coreFilled === CORE_KEYS.length ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}
                {coreFilled}/{CORE_KEYS.length} renseignées
              </div>
            </div>
            <div className="h-10 w-px bg-slate-100 dark:bg-white/10" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Sources disponibles</div>
              <div className="mt-1 text-sm font-semibold">{sourceFilled}/{SOURCE_FIELDS.length}</div>
            </div>
          </div>
          {canEdit ? <Button size="sm" onClick={() => setEditorOpen(true)}><Pencil className="mr-1.5 h-4 w-4" /> Saisir / corriger</Button> : null}
        </section>

        {selected && selectedDerived ? <>
          <section className="mt-5">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-bold">1. Résultat du mois</h2><p className="mt-1 text-xs text-slate-400">Les 4 chiffres bruts indispensables, comparés au mois précédent.</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "CA Gando", value: euro(selected.revenue, 2), change: growth(selected.revenue, previous?.revenue), icon: Banknote },
                { label: "€ sécurisés (TDV)", value: euro(selected.tdv), change: selectedDerived.tdvGrowth, icon: WalletCards },
                { label: "Cautions activées", value: integer(selected.deposits), change: selectedDerived.depositGrowth, icon: ShieldCheck },
                { label: "Loueurs actifs", value: integer(selected.activeRenters), change: growth(selected.activeRenters, previous?.activeRenters), icon: Building2 },
              ].map(card => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.035]"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{card.label}</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#735DF3]/10 text-[#735DF3]"><Icon className="h-4 w-4" /></span></div><div className="mt-4 text-2xl font-bold tracking-[-0.04em]">{card.value}</div><div className="mt-2"><TrendBadge value={card.change} /></div></article>; })}
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-[#735DF3]/15 bg-[#faf9ff] p-5 dark:border-[#735DF3]/20 dark:bg-[#735DF3]/[0.025]">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#735DF3]">Calculé automatiquement</div><h2 className="mt-1 text-lg font-bold tracking-[-0.025em]">2. Les vrais drivers business</h2><p className="mt-1 text-xs text-slate-500">Aucune saisie nécessaire : chaque KPI ci-dessous est recalculé à partir des données sources.</p></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CalcCard label="Take rate" value={percent(selectedDerived.takeRate, 2)} formula="CA / TDV" change={previousDerived?.takeRate != null && selectedDerived.takeRate != null ? `${points(selectedDerived.takeRate - previousDerived.takeRate)} vs mois précédent` : undefined} accent />
              <CalcCard label="ARPU loueur" value={euro(selectedDerived.arpu, 2)} formula="CA / loueurs actifs" change={previousDerived?.arpu ? `${percent(growth(selectedDerived.arpu, previousDerived.arpu))} vs mois précédent` : undefined} />
              <CalcCard label="Caution moyenne" value={euro(selectedDerived.avgDeposit, 0)} formula="TDV / cautions" change={previousDerived?.avgDeposit ? `${percent(growth(selectedDerived.avgDeposit, previousDerived.avgDeposit))} vs mois précédent` : undefined} />
              <CalcCard label="CA / caution" value={euro(selectedDerived.revenuePerDeposit, 2)} formula="CA / cautions" />
              <CalcCard label="Cautions / loueur actif" value={decimal(selectedDerived.depositsPerRenter, 2)} formula="cautions / MAU" change={previousDerived?.depositsPerRenter ? `${percent(growth(selectedDerived.depositsPerRenter, previousDerived.depositsPerRenter))} vs mois précédent` : undefined} />
              <CalcCard label="Taux d'encaissement" value={percent(selectedDerived.cashoutRate)} formula="cautions encaissées / cautions activées" />
              <CalcCard label="Montant moyen encaissé" value={euro(selectedDerived.avgCashout, 0)} formula="montant encaissé / encaissements" />
              <CalcCard label="Churn loueurs" value={percent(selectedDerived.churnRate)} formula="loueurs churnés / MAU du mois précédent" />
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.7fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
              <h2 className="text-sm font-bold">3. Lecture du mois</h2>
              <p className="mt-1 text-xs text-slate-400">Le Cockpit transforme les variations en points d'attention.</p>
              <div className="mt-4 space-y-2">{signals.map((signal, index) => <div key={`${signal.text}-${index}`} className={cn("rounded-xl border px-3 py-3 text-xs leading-5", signal.tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200" : signal.tone === "watch" ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300")}>{signal.text}</div>)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
              <h2 className="text-sm font-bold">Contexte cumulatif</h2>
              <div className="mt-4 space-y-4">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">TDV cumulé</div><div className="mt-1 text-2xl font-bold">{euro(selectedDerived.cumulativeTdv)}</div></div>
                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-white/10"><div><div className="text-[10px] text-slate-400">Users inscrits</div><div className="mt-1 text-lg font-bold">{integer(selected.registeredUsers)}</div></div><div><div className="text-[10px] text-slate-400">Loueurs clients</div><div className="mt-1 text-lg font-bold">{integer(selected.totalClients)}</div></div></div>
              </div>
            </div>
          </section>
        </> : null}

        {editorOpen && canEdit && draft ? <section className="mt-6 rounded-3xl border border-[#735DF3]/25 bg-white p-5 shadow-lg dark:bg-[#1b1e29]">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#735DF3]">Données sources</div><h2 className="mt-1 text-lg font-bold">Saisie · {MONTHS[draft.monthNumber - 1]} {draft.year}</h2><p className="mt-1 text-xs text-slate-400">Ne saisis que des faits. Croissance, ratios et churn sont calculés automatiquement.</p></div><Input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="h-10 w-44" /></div>
          {(["Revenu & volume", "Usage", "Risque & recouvrement"] as const).map(group => <div key={group} className="mt-5"><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{group}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SOURCE_FIELDS.filter(field => field.group === group).map(field => <SourceField key={field.key} field={field} value={draft[field.key]} onChange={value => setDraft(current => current ? ({ ...current, [field.key]: value } as KpiRow) : current)} />)}</div></div>)}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">{message ? <span className="mr-auto text-xs text-slate-500">{message}</span> : null}<Button variant="outline" onClick={() => setEditorOpen(false)}>Annuler</Button><Button onClick={save} disabled={saving}>{saving ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Enregistrer et recalculer</Button></div>
        </section> : null}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10"><div><h2 className="text-base font-bold">Historique mensuel calculé</h2><p className="mt-1 text-xs text-slate-400">Les colonnes violettes sont calculées automatiquement. Tu peux ainsi comparer les mois sans refaire de calcul.</p></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:bg-white/[0.025]"><tr><th className="px-5 py-3">Mois</th><th className="px-3 py-3">CA</th><th className="px-3 py-3">Δ CA</th><th className="px-3 py-3">TDV</th><th className="px-3 py-3 text-[#735DF3]">Take rate</th><th className="px-3 py-3">Cautions</th><th className="px-3 py-3">Δ cautions</th><th className="px-3 py-3">MAU</th><th className="px-3 py-3 text-[#735DF3]">Cautions / MAU</th><th className="px-3 py-3 text-[#735DF3]">ARPU</th><th className="px-3 py-3 text-[#735DF3]">Caution moy.</th><th className="px-3 py-3 text-[#735DF3]">Churn</th><th className="px-3 py-3" /></tr></thead><tbody className="divide-y divide-slate-100 text-sm dark:divide-white/10">{sortedRows.map(row => {
            const future = !isFilled(row); const derived = derivedByMonth.get(rowKey(row.year, row.monthNumber));
            return <tr key={rowKey(row.year, row.monthNumber)} className={cn(future && "text-slate-300 dark:text-slate-600", !future && "hover:bg-slate-50/70 dark:hover:bg-white/[0.02]", selectedMonth === rowKey(row.year, row.monthNumber) && "bg-[#735DF3]/[0.025]")}><td className="px-5 py-3.5 font-semibold">{row.month} <span className="ml-1 text-xs font-normal text-slate-400">{row.year}</span></td><td className="px-3 py-3.5 font-semibold">{euro(row.revenue, 2)}</td><td className="px-3 py-3.5"><TrendBadge value={derived?.revenueGrowth ?? null} /></td><td className="px-3 py-3.5">{euro(row.tdv)}</td><td className="px-3 py-3.5 font-semibold text-[#735DF3]">{percent(derived?.takeRate, 2)}</td><td className="px-3 py-3.5">{integer(row.deposits)}</td><td className="px-3 py-3.5"><TrendBadge value={derived?.depositGrowth ?? null} /></td><td className="px-3 py-3.5">{integer(row.activeRenters)}</td><td className="px-3 py-3.5 font-semibold text-[#735DF3]">{decimal(derived?.depositsPerRenter, 2)}</td><td className="px-3 py-3.5 font-semibold text-[#735DF3]">{euro(derived?.arpu, 2)}</td><td className="px-3 py-3.5 font-semibold text-[#735DF3]">{euro(derived?.avgDeposit, 0)}</td><td className="px-3 py-3.5 font-semibold text-[#735DF3]">{percent(derived?.churnRate)}</td><td className="px-3 py-3.5 text-right">{canEdit ? <Button size="sm" variant="ghost" onClick={() => editRow(row)}><Pencil className="h-3.5 w-3.5" /></Button> : null}</td></tr>;
          })}</tbody></table></div>
        </section>
      </> : assumptions ? <>
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Hypothèses issues du réel</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Le simulateur utilise les ratios calculés sur l'historique réel. Tu peux ensuite modifier une hypothèse pour tester un scénario.</p></div><div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/[0.05]">{[6,12,24].map(value => <Button key={value} size="sm" variant={horizon === value ? "secondary" : "ghost"} onClick={() => setHorizon(value)}>+{value} mois</Button>)}</div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["CA moyen / mois", euro(historical.revenue, 2)], ["TDV moyen / mois", euro(historical.tdv)], ["Cautions / mois", decimal(historical.deposits)], ["MAU moyen", decimal(historical.mau)], ["ARPU moyen", euro(historical.arpu, 2)], ["Take rate moyen", percent(historical.takeRate, 2)], ["Caution moyenne", euro(historical.tdvPerDeposit, 2)], ["Cautions / loueur", decimal(historical.depositsPerRenter, 2)], ["Nouveaux users / mois", decimal(historical.newUsers)], ["Croissance cautions", percent(historical.depositGrowth)],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-white/[0.035]"><div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div><div className="mt-1.5 text-lg font-semibold tracking-[-0.02em]">{value}</div></div>)}
          </div>
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-white/10"><div className="mb-3 text-xs font-semibold text-slate-500">Modifier le scénario</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <AssumptionField label="Croissance cautions" value={assumptions.depositGrowth} percentValue onChange={value => setAssumptions({ ...assumptions, depositGrowth: value })} />
            <AssumptionField label="Cautions / loueur" value={assumptions.depositsPerRenter} onChange={value => setAssumptions({ ...assumptions, depositsPerRenter: value })} />
            <AssumptionField label="Caution moyenne" value={assumptions.tdvPerDeposit} suffix="€" onChange={value => setAssumptions({ ...assumptions, tdvPerDeposit: value })} />
            <AssumptionField label="Take rate" value={assumptions.takeRate} percentValue onChange={value => setAssumptions({ ...assumptions, takeRate: value })} />
            <AssumptionField label="Nouveaux users / mois" value={assumptions.newUsersPerMonth} onChange={value => setAssumptions({ ...assumptions, newUsersPerMonth: value })} />
            <AssumptionField label="Nouveaux clients / mois" value={assumptions.newClientsPerMonth} onChange={value => setAssumptions({ ...assumptions, newClientsPerMonth: value })} />
            <AssumptionField label="Taux d'encaissement" value={assumptions.cashoutRate} percentValue onChange={value => setAssumptions({ ...assumptions, cashoutRate: value })} />
            <AssumptionField label="Montant / encaissement" value={assumptions.cashoutAmount} suffix="€" onChange={value => setAssumptions({ ...assumptions, cashoutAmount: value })} />
            <AssumptionField label="Part garantie avancée" value={assumptions.guaranteeShare} percentValue onChange={value => setAssumptions({ ...assumptions, guaranteeShare: value })} />
            <AssumptionField label="Churn loueurs" value={assumptions.churnRate} percentValue onChange={value => setAssumptions({ ...assumptions, churnRate: value })} />
          </div></div>
        </section>

        {projected ? <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{projectionCards.map(card => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/20"><div className="flex items-center justify-between text-xs text-violet-700 dark:text-violet-300"><span>{card.label}</span><Icon className="h-4 w-4" /></div><div className="mt-4 text-2xl font-semibold tracking-[-0.035em]">{card.value}</div><div className="mt-1 text-[10px] text-slate-400">{projected.month} {projected.year}</div></div>; })}</section> : null}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10"><h2 className="text-base font-semibold">Réel vs simulation</h2><p className="mt-1 text-xs text-slate-400">Projection +{horizon} mois après le dernier mois réel.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:bg-white/[0.025]"><tr><th className="px-5 py-3">Mois</th><th className="px-4 py-3">CA réel</th><th className="px-4 py-3">CA simulé</th><th className="px-4 py-3">TDV réel</th><th className="px-4 py-3">TDV simulé</th><th className="px-4 py-3">Cautions réel</th><th className="px-4 py-3">Cautions simulé</th><th className="px-4 py-3">MAU réel</th><th className="px-4 py-3">MAU simulé</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm dark:divide-white/10">{simulation.map(row => <tr key={rowKey(row.year, row.monthNumber)}><td className="px-5 py-3.5 font-medium">{row.month} <span className="ml-1 text-xs font-normal text-slate-400">{row.year}</span></td><td className="px-4 py-3.5">{euro(row.actual?.revenue, 2)}</td><td className="px-4 py-3.5 font-semibold text-violet-700 dark:text-violet-300">{euro(row.revenue, 2)}</td><td className="px-4 py-3.5">{euro(row.actual?.tdv)}</td><td className="px-4 py-3.5 font-medium">{euro(row.tdv)}</td><td className="px-4 py-3.5">{integer(row.actual?.deposits)}</td><td className="px-4 py-3.5 font-medium">{integer(row.deposits)}</td><td className="px-4 py-3.5">{integer(row.actual?.activeRenters)}</td><td className="px-4 py-3.5 font-medium">{integer(row.activeRenters)}</td></tr>)}</tbody></table></div>
        </section>
      </> : null}
    </div>
  );
}
