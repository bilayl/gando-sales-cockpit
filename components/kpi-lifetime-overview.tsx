"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Megaphone,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

type CoreRow = {
  year: number;
  monthNumber: number;
  month?: string;
  revenue: number | null;
  tdv: number | null;
  deposits: number | null;
  activeRenters: number | null;
  newUsers: number | null;
  registeredUsers: number | null;
  totalClients: number | null;
  depositCashouts: number | null;
  cashoutAmount: number | null;
  advancedGuarantee: number | null;
  churnedRenters: number | null;
};

type ValueRow = {
  year: number;
  monthNumber: number;
  prospectsContacted: number | null;
  callsMade: number | null;
  meetings: number | null;
  rentersRegistered: number | null;
  rentersActivated: number | null;
  firstDepositRenters: number | null;
  paidSpend: number | null;
  salesCost: number | null;
  paidLeads: number | null;
  organicLeads: number | null;
  signedRevenue: number | null;
  cashCollected: number | null;
  mrr: number | null;
  refunds: number | null;
  netMargin: number | null;
  avgClosingDays: number | null;
  avgDealAgeDays: number | null;
  dealsOver40Days: number | null;
  decisionsTaken: number | null;
};

type CampaignRow = {
  id?: string;
  year: number;
  monthNumber: number;
  source: string;
  campaign: string;
  spend: number | null;
  leads: number | null;
  meetings: number | null;
  clients: number | null;
  signedRevenue: number | null;
  cashCollected: number | null;
};

type IconType = typeof Banknote;

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sum<T>(rows: T[], pick: (row: T) => number | null | undefined) {
  return rows.reduce((total, row) => total + n(pick(row)), 0);
}

function countKnown<T>(rows: T[], pick: (row: T) => number | null | undefined) {
  return rows.filter(row => hasNumber(pick(row))).length;
}

function ratio(top: number | null | undefined, bottom: number | null | undefined) {
  const b = n(bottom);
  return b > 0 ? n(top) / b : null;
}

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

function key(row: { year: number; monthNumber: number }) {
  return row.year * 12 + row.monthNumber - 1;
}

function label(row: { year: number; monthNumber: number }) {
  return `${MONTHS[row.monthNumber - 1]} ${row.year}`;
}

function geometricMonthlyGrowth(first: number | null | undefined, last: number | null | undefined, periods: number) {
  if (!hasNumber(first) || !hasNumber(last) || first <= 0 || last < 0 || periods <= 0) return null;
  return Math.pow(last / first, 1 / periods) - 1;
}

function lastKnown<T>(rows: T[], pick: (row: T) => number | null | undefined) {
  return [...rows].reverse().find(row => hasNumber(pick(row))) || null;
}

function bestRow<T>(rows: T[], pick: (row: T) => number | null | undefined) {
  return rows.reduce<T | null>((best, row) => {
    const value = pick(row);
    if (!hasNumber(value)) return best;
    if (!best) return row;
    return value > n(pick(best)) ? row : best;
  }, null);
}

function coverage(known: number, total: number) {
  return total > 0 ? known / total : 0;
}

function CoveragePill({ known, total }: { known: number; total: number }) {
  const value = coverage(known, total);
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold",
      value >= 0.9 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" :
      value >= 0.6 ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-100" :
      "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300",
    )}>
      {known}/{total} mois
    </span>
  );
}

function LifetimeCard({ label: cardLabel, value, detail, icon: Icon, coverageText, accent }: {
  label: string;
  value: string;
  detail: string;
  icon: IconType;
  coverageText?: string;
  accent?: boolean;
}) {
  return (
    <article className={cn(
      "rounded-2xl border p-5 shadow-sm",
      accent ? "border-[#735DF3]/25 bg-[#735DF3]/[0.035]" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">{cardLabel}</div>
          <div className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white">{value}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</div>
          {coverageText ? <div className="mt-2 text-[10px] font-semibold text-slate-400">{coverageText}</div> : null}
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#735DF3]/10 text-[#735DF3]"><Icon className="h-4 w-4" /></div>
      </div>
    </article>
  );
}

function FunnelStep({ label: stepLabel, value, conversion }: { label: string; value: string; conversion?: string }) {
  return (
    <div className="relative min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
      {conversion ? <div className="absolute -left-8 top-1/2 hidden -translate-y-1/2 text-[10px] font-bold text-[#735DF3] xl:block">{conversion}</div> : null}
      <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">{stepLabel}</div>
      <div className="mt-2 text-xl font-bold tracking-[-0.03em] text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

export function KpiLifetimeOverview() {
  const [coreRows, setCoreRows] = useState<CoreRow[]>([]);
  const [valueRows, setValueRows] = useState<ValueRow[]>([]);
  const [campaignRows, setCampaignRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [coreResponse, valueResponse, campaignResponse] = await Promise.all([
          fetch("/api/kpi", { cache: "no-store" }),
          fetch("/api/kpi/value-funnel", { cache: "no-store" }),
          fetch("/api/kpi/campaigns", { cache: "no-store" }),
        ]);
        const [coreBody, valueBody, campaignBody] = await Promise.all([
          coreResponse.json(), valueResponse.json(), campaignResponse.json(),
        ]);
        if (!coreResponse.ok) throw new Error(coreBody.error || "Impossible de charger les KPI business.");
        if (!valueResponse.ok) throw new Error(valueBody.error || "Impossible de charger le funnel.");
        if (!campaignResponse.ok) throw new Error(campaignBody.error || "Impossible de charger les campagnes.");
        setCoreRows(Array.isArray(coreBody.rows) ? coreBody.rows : []);
        setValueRows(Array.isArray(valueBody.rows) ? valueBody.rows : []);
        setCampaignRows(Array.isArray(campaignBody.rows) ? campaignBody.rows : []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger la vue historique.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const lifetime = useMemo(() => {
    const core = [...coreRows]
      .filter(row => [row.revenue, row.tdv, row.deposits, row.activeRenters, row.newUsers, row.registeredUsers, row.totalClients, row.depositCashouts, row.cashoutAmount, row.advancedGuarantee, row.churnedRenters].some(hasNumber))
      .sort((a, b) => key(a) - key(b));
    const values = [...valueRows]
      .filter(row => Object.entries(row).some(([field, value]) => !["year", "monthNumber"].includes(field) && hasNumber(value as number | null)))
      .sort((a, b) => key(a) - key(b));

    if (!core.length && !values.length) return null;

    const firstKey = Math.min(core[0] ? key(core[0]) : Infinity, values[0] ? key(values[0]) : Infinity);
    const lastCore = core.at(-1) || null;
    const lastValue = values.at(-1) || null;
    const lastKey = Math.max(lastCore ? key(lastCore) : -Infinity, lastValue ? key(lastValue) : -Infinity);
    const spanMonths = Math.max(1, lastKey - firstKey + 1);
    const firstDate = core.find(row => key(row) === firstKey) || values.find(row => key(row) === firstKey) || core[0] || values[0];
    const lastDate = [...core, ...values].sort((a, b) => key(a) - key(b)).at(-1)!;

    const totalRevenue = sum(core, row => row.revenue);
    const totalTdv = sum(core, row => row.tdv);
    const totalDeposits = sum(core, row => row.deposits);
    const totalCashouts = sum(core, row => row.depositCashouts);
    const totalCashoutAmount = sum(core, row => row.cashoutAmount);
    const totalGuarantee = sum(core, row => row.advancedGuarantee);
    const revenueMonths = countKnown(core, row => row.revenue);
    const tdvMonths = countKnown(core, row => row.tdv);
    const depositMonths = countKnown(core, row => row.deposits);
    const mauMonths = countKnown(core, row => row.activeRenters);

    const firstRevenueRow = core.find(row => hasNumber(row.revenue) && n(row.revenue) > 0) || null;
    const lastRevenueRow = lastKnown(core, row => row.revenue);
    const firstDepositRow = core.find(row => hasNumber(row.deposits) && n(row.deposits) > 0) || null;
    const lastDepositRow = lastKnown(core, row => row.deposits);
    const revenueGrowthPeriods = firstRevenueRow && lastRevenueRow ? key(lastRevenueRow) - key(firstRevenueRow) : 0;
    const depositGrowthPeriods = firstDepositRow && lastDepositRow ? key(lastDepositRow) - key(firstDepositRow) : 0;

    const latestClientsRow = lastKnown(core, row => row.totalClients);
    const latestUsersRow = lastKnown(core, row => row.registeredUsers);
    const latestMauRow = lastKnown(core, row => row.activeRenters);
    const peakRevenueRow = bestRow(core, row => row.revenue);
    const peakDepositsRow = bestRow(core, row => row.deposits);
    const peakMauRow = bestRow(core, row => row.activeRenters);

    const matchedArpuRows = core.filter(row => hasNumber(row.revenue) && hasNumber(row.activeRenters) && n(row.activeRenters) > 0);
    const matchedArpuRevenue = sum(matchedArpuRows, row => row.revenue);
    const renterMonths = sum(matchedArpuRows, row => row.activeRenters);
    const blendedArpu = ratio(matchedArpuRevenue, renterMonths);

    const prospects = sum(values, row => row.prospectsContacted);
    const calls = sum(values, row => row.callsMade);
    const meetings = sum(values, row => row.meetings);
    const rentersRegistered = sum(values, row => row.rentersRegistered);
    const rentersActivated = sum(values, row => row.rentersActivated);
    const firstDepositRenters = sum(values, row => row.firstDepositRenters);
    const paidSpend = sum(values, row => row.paidSpend);
    const salesCost = sum(values, row => row.salesCost);
    const paidLeads = sum(values, row => row.paidLeads);
    const organicLeads = sum(values, row => row.organicLeads);
    const signedRevenue = sum(values, row => row.signedRevenue);
    const cashCollected = sum(values, row => row.cashCollected);
    const refunds = sum(values, row => row.refunds);
    const netMargin = sum(values, row => row.netMargin);
    const decisionsTaken = sum(values, row => row.decisionsTaken);
    const acquisitionCost = paidSpend + salesCost;

    const marginMatched = values.filter(value => hasNumber(value.netMargin)).map(value => ({
      value,
      core: core.find(row => row.year === value.year && row.monthNumber === value.monthNumber),
    })).filter(item => item.core && hasNumber(item.core.revenue));
    const marginRevenueBase = marginMatched.reduce((total, item) => total + n(item.core?.revenue), 0);

    const campaignSpend = sum(campaignRows, row => row.spend);
    const campaignLeads = sum(campaignRows, row => row.leads);
    const campaignMeetings = sum(campaignRows, row => row.meetings);
    const campaignClients = sum(campaignRows, row => row.clients);
    const campaignSigned = sum(campaignRows, row => row.signedRevenue);
    const campaignCash = sum(campaignRows, row => row.cashCollected);
    const topCampaign = [...campaignRows].sort((a, b) => n(b.cashCollected) - n(a.cashCollected))[0] || null;

    const coreSourceFields: Array<keyof CoreRow> = ["revenue", "tdv", "deposits", "activeRenters", "newUsers", "registeredUsers", "totalClients", "depositCashouts", "cashoutAmount", "advancedGuarantee", "churnedRenters"];
    const coreKnownCells = coreSourceFields.reduce((total, field) => total + core.filter(row => hasNumber(row[field] as number | null)).length, 0);
    const coreCompleteness = core.length ? coreKnownCells / (spanMonths * coreSourceFields.length) : 0;
    const valueSourceFields: Array<keyof ValueRow> = ["prospectsContacted", "callsMade", "meetings", "rentersRegistered", "rentersActivated", "firstDepositRenters", "paidSpend", "salesCost", "paidLeads", "organicLeads", "signedRevenue", "cashCollected", "mrr", "refunds", "netMargin", "avgClosingDays", "avgDealAgeDays", "dealsOver40Days", "decisionsTaken"];
    const valueKnownCells = valueSourceFields.reduce((total, field) => total + values.filter(row => hasNumber(row[field] as number | null)).length, 0);
    const valueCompleteness = values.length ? valueKnownCells / (spanMonths * valueSourceFields.length) : 0;

    return {
      core, values, spanMonths, firstDate, lastDate,
      totalRevenue, totalTdv, totalDeposits, totalCashouts, totalCashoutAmount, totalGuarantee,
      revenueMonths, tdvMonths, depositMonths, mauMonths,
      weightedTakeRate: ratio(totalRevenue, totalTdv),
      avgDeposit: ratio(totalTdv, totalDeposits),
      revenuePerDeposit: ratio(totalRevenue, totalDeposits),
      avgRevenueMonth: revenueMonths ? totalRevenue / revenueMonths : null,
      avgTdvMonth: tdvMonths ? totalTdv / tdvMonths : null,
      revenueMonthlyGrowth: geometricMonthlyGrowth(firstRevenueRow?.revenue, lastRevenueRow?.revenue, revenueGrowthPeriods),
      depositMonthlyGrowth: geometricMonthlyGrowth(firstDepositRow?.deposits, lastDepositRow?.deposits, depositGrowthPeriods),
      latestClients: latestClientsRow?.totalClients ?? null,
      latestUsers: latestUsersRow?.registeredUsers ?? null,
      latestMau: latestMauRow?.activeRenters ?? null,
      avgMau: mauMonths ? sum(core, row => row.activeRenters) / mauMonths : null,
      peakRevenueRow, peakDepositsRow, peakMauRow, blendedArpu,
      prospects, calls, meetings, rentersRegistered, rentersActivated, firstDepositRenters,
      paidSpend, salesCost, paidLeads, organicLeads, signedRevenue, cashCollected, refunds, netMargin, decisionsTaken,
      cplPaid: ratio(paidSpend, paidLeads),
      cac: ratio(acquisitionCost, rentersActivated),
      meetingRate: ratio(meetings, prospects),
      closingRate: ratio(rentersActivated, meetings),
      firstDepositRate: ratio(firstDepositRenters, rentersActivated),
      collectionRate: ratio(cashCollected, signedRevenue),
      marginRate: ratio(netMargin, marginRevenueBase),
      cashoutRate: ratio(totalCashouts, totalDeposits),
      avgCashout: ratio(totalCashoutAmount, totalCashouts),
      guaranteeShare: ratio(totalGuarantee, totalCashoutAmount),
      campaignSpend, campaignLeads, campaignMeetings, campaignClients, campaignSigned, campaignCash,
      campaignCpl: ratio(campaignSpend, campaignLeads),
      campaignCac: ratio(campaignSpend, campaignClients),
      campaignRoas: ratio(campaignSigned, campaignSpend),
      campaignCashRoas: ratio(campaignCash, campaignSpend),
      topCampaign,
      coreCompleteness, valueCompleteness,
    };
  }, [coreRows, valueRows, campaignRows]);

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.035]">Calcul de l’historique complet…</div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  if (!lifetime) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.035]">Aucune donnée historique disponible.</div>;

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#735DF3]">Depuis le début</div>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white">Toute l’activité Gando consolidée</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Cumul, ratios pondérés, trajectoire et qualité des données depuis le premier mois renseigné. Un ratio n’est calculé que lorsque ses données sources existent.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300"><CalendarRange className="mr-1.5 inline h-3.5 w-3.5" />{label(lifetime.firstDate)} → {label(lifetime.lastDate)}</div>
            <div className="rounded-xl bg-[#735DF3]/10 px-3 py-2 text-xs font-bold text-[#735DF3]">{lifetime.spanMonths} mois d’activité</div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="text-sm font-bold text-slate-950 dark:text-white">1. Valeur créée depuis le lancement</h2><p className="mt-1 text-xs text-slate-400">Les cumuls sont accompagnés de leur couverture réelle pour éviter les faux totaux.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LifetimeCard label="CA Gando cumulé" value={euro(lifetime.totalRevenue, 2)} detail={`Moyenne ${euro(lifetime.avgRevenueMonth, 2)} / mois renseigné`} coverageText={`${lifetime.revenueMonths}/${lifetime.spanMonths} mois avec CA`} icon={Banknote} accent />
          <LifetimeCard label="TDV cumulé renseigné" value={euro(lifetime.totalTdv)} detail={`Take rate pondéré ${percent(lifetime.weightedTakeRate, 2)}`} coverageText={`${lifetime.tdvMonths}/${lifetime.spanMonths} mois avec TDV`} icon={WalletCards} />
          <LifetimeCard label="Cautions activées" value={integer(lifetime.totalDeposits)} detail={`Caution moyenne ${euro(lifetime.avgDeposit, 0)}`} coverageText={`${lifetime.depositMonths}/${lifetime.spanMonths} mois avec volume`} icon={ShieldCheck} />
          <LifetimeCard label="CA par caution" value={euro(lifetime.revenuePerDeposit, 2)} detail={`Croissance cautions composée ${percent(lifetime.depositMonthlyGrowth)}`} coverageText="Calcul pondéré sur les données disponibles" icon={TrendingUp} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#735DF3]" /><h2 className="text-sm font-bold">2. Trajectoire</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Croissance CA composée</div><div className="mt-2 text-xl font-bold">{percent(lifetime.revenueMonthlyGrowth)}</div><div className="mt-1 text-[11px] text-slate-400">par mois, premier → dernier CA connu</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">MAU actuel</div><div className="mt-2 text-xl font-bold">{integer(lifetime.latestMau)}</div><div className="mt-1 text-[11px] text-slate-400">moyenne historique {decimal(lifetime.avgMau, 1)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">ARPU pondéré</div><div className="mt-2 text-xl font-bold">{euro(lifetime.blendedArpu, 2)}</div><div className="mt-1 text-[11px] text-slate-400">CA / loueur-mois sur mois comparables</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Pic de CA</div><div className="mt-2 text-xl font-bold">{euro(lifetime.peakRevenueRow?.revenue, 2)}</div><div className="mt-1 text-[11px] text-slate-400">{lifetime.peakRevenueRow ? label(lifetime.peakRevenueRow) : "—"}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Pic de cautions</div><div className="mt-2 text-xl font-bold">{integer(lifetime.peakDepositsRow?.deposits)}</div><div className="mt-1 text-[11px] text-slate-400">{lifetime.peakDepositsRow ? label(lifetime.peakDepositsRow) : "—"}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Base actuelle</div><div className="mt-2 text-xl font-bold">{integer(lifetime.latestClients)} loueurs</div><div className="mt-1 text-[11px] text-slate-400">{integer(lifetime.latestUsers)} utilisateurs inscrits</div></div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center gap-2"><Database className="h-4 w-4 text-[#735DF3]" /><h2 className="text-sm font-bold">Précision des données</h2></div>
          <p className="mt-1 text-xs leading-5 text-slate-400">Cette vue distingue les données réellement disponibles des périodes manquantes.</p>
          <div className="mt-5 space-y-4">
            <div><div className="flex items-center justify-between text-xs"><span className="font-semibold">Business mensuel</span><span>{percent(lifetime.coreCompleteness, 0)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5"><div className="h-full rounded-full bg-[#735DF3]" style={{ width: `${Math.min(100, lifetime.coreCompleteness * 100)}%` }} /></div></div>
            <div><div className="flex items-center justify-between text-xs"><span className="font-semibold">Funnel / finance</span><span>{percent(lifetime.valueCompleteness, 0)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5"><div className="h-full rounded-full bg-[#735DF3]" style={{ width: `${Math.min(100, lifetime.valueCompleteness * 100)}%` }} /></div></div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
              <div><div className="text-[10px] text-slate-400">TDV</div><div className="mt-1"><CoveragePill known={lifetime.tdvMonths} total={lifetime.spanMonths} /></div></div>
              <div><div className="text-[10px] text-slate-400">MAU</div><div className="mt-1"><CoveragePill known={lifetime.mauMonths} total={lifetime.spanMonths} /></div></div>
              <div><div className="text-[10px] text-slate-400">Campagnes</div><div className="mt-1 text-sm font-bold">{campaignRows.length}</div></div>
              <div><div className="text-[10px] text-slate-400">Décisions tracées</div><div className="mt-1 text-sm font-bold">{integer(lifetime.decisionsTaken)}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-[#fafaff] p-5 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">3. Funnel cumulé depuis le début</h2><p className="mt-1 text-xs text-slate-400">Somme des activités mensuelles renseignées ; les conversions sont calculées sur les totaux.</p></div></div>
        <div className="grid gap-3 xl:grid-cols-5 xl:gap-8">
          <FunnelStep label="Prospects contactés" value={integer(lifetime.prospects)} />
          <FunnelStep label="RDV" value={integer(lifetime.meetings)} conversion={percent(lifetime.meetingRate)} />
          <FunnelStep label="Loueurs inscrits" value={integer(lifetime.rentersRegistered)} conversion={percent(ratio(lifetime.rentersRegistered, lifetime.meetings))} />
          <FunnelStep label="Loueurs activés" value={integer(lifetime.rentersActivated)} conversion={percent(lifetime.closingRate)} />
          <FunnelStep label="1re caution" value={integer(lifetime.firstDepositRenters)} conversion={percent(lifetime.firstDepositRate)} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LifetimeCard label="Calls réalisés" value={integer(lifetime.calls)} detail="activité commerciale cumulée" icon={UsersRound} />
          <LifetimeCard label="Leads paid" value={integer(lifetime.paidLeads)} detail={`${integer(lifetime.organicLeads)} leads organiques`} icon={Megaphone} />
          <LifetimeCard label="CPL paid" value={euro(lifetime.cplPaid, 2)} detail={`${euro(lifetime.paidSpend)} de spend paid`} icon={CircleDollarSign} />
          <LifetimeCard label="CAC blended" value={euro(lifetime.cac, 0)} detail="paid + coût commercial / loueur activé" icon={Activity} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-[#735DF3]" /><h2 className="text-sm font-bold">4. Finance cumulée</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase text-slate-400">CA signé</div><div className="mt-2 text-xl font-bold">{euro(lifetime.signedRevenue)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase text-slate-400">Cash encaissé</div><div className="mt-2 text-xl font-bold">{euro(lifetime.cashCollected)}</div><div className="mt-1 text-[11px] text-slate-400">collecte {percent(lifetime.collectionRate)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase text-slate-400">Marge nette renseignée</div><div className="mt-2 text-xl font-bold">{euro(lifetime.netMargin)}</div><div className="mt-1 text-[11px] text-slate-400">marge {percent(lifetime.marginRate)} sur mois comparables</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase text-slate-400">Remboursements / churn €</div><div className="mt-2 text-xl font-bold">{euro(lifetime.refunds)}</div></div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#735DF3]" /><h2 className="text-sm font-bold">5. Risque & encaissements</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase text-slate-400">Cautions encaissées</div><div className="mt-2 text-xl font-bold">{integer(lifetime.totalCashouts)}</div><div className="mt-1 text-[11px] text-slate-400">taux {percent(lifetime.cashoutRate)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase text-slate-400">Montant encaissé / réclamé</div><div className="mt-2 text-xl font-bold">{euro(lifetime.totalCashoutAmount)}</div><div className="mt-1 text-[11px] text-slate-400">moyenne {euro(lifetime.avgCashout)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase text-slate-400">Garantie avancée</div><div className="mt-2 text-xl font-bold">{euro(lifetime.totalGuarantee)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase text-slate-400">Part garantie / encaissements</div><div className="mt-2 text-xl font-bold">{percent(lifetime.guaranteeShare)}</div></div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-[#735DF3]" /><h2 className="text-sm font-bold">6. Acquisition attribuée</h2></div><p className="mt-1 text-xs text-slate-400">Consolidation de toutes les campagnes renseignées depuis le début.</p></div>{lifetime.topCampaign ? <div className="text-xs text-slate-400">Top cash : <span className="font-bold text-slate-700 dark:text-slate-200">{lifetime.topCampaign.campaign}</span> · {lifetime.topCampaign.source}</div> : null}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LifetimeCard label="Spend campagnes" value={euro(lifetime.campaignSpend)} detail={`${integer(lifetime.campaignLeads)} leads attribués`} icon={CircleDollarSign} />
          <LifetimeCard label="CPL campagne" value={euro(lifetime.campaignCpl, 2)} detail={`${integer(lifetime.campaignMeetings)} RDV attribués`} icon={Megaphone} />
          <LifetimeCard label="CAC campagne" value={euro(lifetime.campaignCac, 0)} detail={`${integer(lifetime.campaignClients)} clients attribués`} icon={UsersRound} />
          <LifetimeCard label="ROAS cash" value={lifetime.campaignCashRoas == null ? "—" : `${decimal(lifetime.campaignCashRoas, 2)}×`} detail={`ROAS signé ${lifetime.campaignRoas == null ? "—" : `${decimal(lifetime.campaignRoas, 2)}×`}`} icon={TrendingUp} />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#735DF3]" /><h2 className="text-sm font-bold">7. Trajectoire mensuelle complète</h2></div><p className="mt-1 text-xs text-slate-400">Une ligne par mois réellement renseigné, avec ratios recalculés à partir des sources disponibles.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:bg-white/[0.025]"><tr><th className="px-5 py-3">Mois</th><th className="px-3">CA</th><th className="px-3">TDV</th><th className="px-3">Take rate</th><th className="px-3">Cautions</th><th className="px-3">Caution moy.</th><th className="px-3">MAU</th><th className="px-3">ARPU</th><th className="px-3">Clients cumulés</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {lifetime.core.map(row => (
                <tr key={`${row.year}-${row.monthNumber}`}>
                  <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">{label(row)}</td>
                  <td className="px-3 py-3.5">{euro(row.revenue, 2)}</td>
                  <td className="px-3 py-3.5">{euro(row.tdv)}</td>
                  <td className="px-3 py-3.5">{percent(ratio(row.revenue, row.tdv), 2)}</td>
                  <td className="px-3 py-3.5">{integer(row.deposits)}</td>
                  <td className="px-3 py-3.5">{euro(ratio(row.tdv, row.deposits), 0)}</td>
                  <td className="px-3 py-3.5">{integer(row.activeRenters)}</td>
                  <td className="px-3 py-3.5">{euro(ratio(row.revenue, row.activeRenters), 2)}</td>
                  <td className="px-3 py-3.5">{integer(row.totalClients)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
