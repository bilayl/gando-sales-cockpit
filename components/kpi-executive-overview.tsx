"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Banknote, Building2, CircleDollarSign, ShieldCheck, TrendingUp, UsersRound, WalletCards } from "lucide-react";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

type CoreRow = {
  year: number;
  monthNumber: number;
  revenue: number | null;
  tdv: number | null;
  deposits: number | null;
  activeRenters: number | null;
  churnRate: number | null;
};

type ValueRow = {
  year: number;
  monthNumber: number;
  prospectsContacted: number | null;
  meetings: number | null;
  rentersActivated: number | null;
  firstDepositRenters: number | null;
  paidSpend: number | null;
  salesCost: number | null;
  signedRevenue: number | null;
  cashCollected: number | null;
  netMargin: number | null;
  avgDealAgeDays: number | null;
  dealsOver40Days: number | null;
};

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value);
}

function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
}

function key(row: { year: number; monthNumber: number }) {
  return row.year * 12 + row.monthNumber;
}

function KpiCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Banknote }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white">{value}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</div>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#735DF3]/10 text-[#735DF3]"><Icon className="h-4 w-4" /></div>
      </div>
    </article>
  );
}

function FunnelItem({ label, value, conversion }: { label: string; value: string; conversion?: string }) {
  return (
    <div className="relative flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
      {conversion ? <div className="absolute -left-8 top-1/2 hidden -translate-y-1/2 text-[10px] font-bold text-[#735DF3] lg:block">{conversion}</div> : null}
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

export function KpiExecutiveOverview() {
  const [coreRows, setCoreRows] = useState<CoreRow[]>([]);
  const [valueRows, setValueRows] = useState<ValueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [coreResponse, valueResponse] = await Promise.all([
          fetch("/api/kpi", { cache: "no-store" }),
          fetch("/api/kpi/value-funnel", { cache: "no-store" }),
        ]);
        const [coreBody, valueBody] = await Promise.all([coreResponse.json(), valueResponse.json()]);
        if (!coreResponse.ok) throw new Error(coreBody.error || "Impossible de charger les KPI.");
        if (!valueResponse.ok) throw new Error(valueBody.error || "Impossible de charger le funnel.");
        setCoreRows(Array.isArray(coreBody.rows) ? coreBody.rows : []);
        setValueRows(Array.isArray(valueBody.rows) ? valueBody.rows : []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger l’aperçu KPI.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const snapshot = useMemo(() => {
    const latestValue = [...valueRows]
      .filter(row => Object.entries(row).some(([field, value]) => !["year", "monthNumber"].includes(field) && value != null))
      .sort((a, b) => key(b) - key(a))[0];
    const latestCore = [...coreRows]
      .filter(row => row.revenue != null || row.tdv != null || row.deposits != null || row.activeRenters != null)
      .sort((a, b) => key(b) - key(a))[0];
    const targetKey = Math.max(latestValue ? key(latestValue) : 0, latestCore ? key(latestCore) : 0);
    const value = valueRows.find(row => key(row) === targetKey) || latestValue || null;
    const core = coreRows.find(row => key(row) === targetKey) || latestCore || null;
    const year = value?.year || core?.year || new Date().getFullYear();
    const monthNumber = value?.monthNumber || core?.monthNumber || new Date().getMonth() + 1;

    const acquisitionCost = n(value?.paidSpend) + n(value?.salesCost);
    const cac = n(value?.rentersActivated) > 0 ? acquisitionCost / n(value?.rentersActivated) : null;
    const arpu = ratio(core?.revenue, core?.activeRenters);
    const churn = n(core?.churnRate);
    const lifetimeMonths = churn > 0 ? Math.min(24, 1 / churn) : 24;
    const ltv24 = arpu == null ? null : arpu * lifetimeMonths;
    const ltvCac = ltv24 != null && cac != null && cac > 0 ? ltv24 / cac : null;
    const takeRate = ratio(core?.revenue, core?.tdv);
    const collectionRate = ratio(value?.cashCollected, value?.signedRevenue);
    const marginRate = ratio(value?.netMargin, core?.revenue);
    const closingRate = ratio(value?.rentersActivated, value?.meetings);

    const alerts: string[] = [];
    if (ltvCac != null && ltvCac < 3) alerts.push(`LTV / CAC à ${decimal(ltvCac, 1)}× : sous le repère 3×.`);
    if (n(value?.avgDealAgeDays) > 40) alerts.push(`Âge moyen des deals : ${decimal(value?.avgDealAgeDays, 0)} jours.`);
    if (n(value?.dealsOver40Days) > 0) alerts.push(`${integer(value?.dealsOver40Days)} deal(s) ont plus de 40 jours.`);
    if (collectionRate != null && collectionRate < 0.9) alerts.push(`Taux de collecte à ${percent(collectionRate)} du CA signé.`);
    if (marginRate != null && marginRate < 0) alerts.push("Marge nette négative sur la période.");

    return { value, core, year, monthNumber, cac, ltv24, ltvCac, takeRate, collectionRate, marginRate, closingRate, alerts };
  }, [coreRows, valueRows]);

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.035]">Chargement de l’aperçu…</div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;

  const { value, core } = snapshot;

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#735DF3]">Vue d’ensemble</div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white">Santé business de Gando</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Les KPI à lire en moins de 30 secondes avant d’entrer dans le détail.</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300">{MONTHS[snapshot.monthNumber - 1]} {snapshot.year}</div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-950 dark:text-white">1. Santé business</h2><span className="text-xs text-slate-400">Valeur créée et encaissée</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard label="CA Gando" value={euro(core?.revenue)} detail={`Take rate ${percent(snapshot.takeRate)}`} icon={Banknote} />
          <KpiCard label="Marge nette" value={euro(value?.netMargin)} detail={`Taux de marge ${percent(snapshot.marginRate)}`} icon={CircleDollarSign} />
          <KpiCard label="TDV sécurisé" value={euro(core?.tdv)} detail={`${integer(core?.deposits)} cautions activées`} icon={ShieldCheck} />
          <KpiCard label="Loueurs actifs" value={integer(core?.activeRenters)} detail="MAU loueurs sur la période" icon={Building2} />
          <KpiCard label="Cash encaissé" value={euro(value?.cashCollected)} detail={`${percent(snapshot.collectionRate)} du CA signé`} icon={WalletCards} />
          <KpiCard label="Taux de closing" value={percent(snapshot.closingRate)} detail="RDV → loueurs activés" icon={UsersRound} />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-[#fafaff] p-5 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-950 dark:text-white">2. Funnel de création de valeur</h2><span className="text-xs text-slate-400">Du prospect à la 1re caution</span></div>
        <div className="grid gap-3 lg:grid-cols-4 lg:gap-8">
          <FunnelItem label="Prospects contactés" value={integer(value?.prospectsContacted)} />
          <FunnelItem label="RDV" value={integer(value?.meetings)} conversion={percent(ratio(value?.meetings, value?.prospectsContacted))} />
          <FunnelItem label="Loueurs activés" value={integer(value?.rentersActivated)} conversion={percent(ratio(value?.rentersActivated, value?.meetings))} />
          <FunnelItem label="1re caution" value={integer(value?.firstDepositRenters)} conversion={percent(ratio(value?.firstDepositRenters, value?.rentersActivated))} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#735DF3]" /><h2 className="text-sm font-bold text-slate-950 dark:text-white">3. Unit economics</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">CAC</div><div className="mt-2 text-xl font-bold">{euro(snapshot.cac)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">LTV 24 mois</div><div className="mt-2 text-xl font-bold">{euro(snapshot.ltv24)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">LTV / CAC</div><div className="mt-2 text-xl font-bold">{snapshot.ltvCac == null ? "—" : `${decimal(snapshot.ltvCac, 1)}×`}</div><div className="mt-1 text-[11px] text-slate-400">Cible : &gt; 3×</div></div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#735DF3]" /><h2 className="text-sm font-bold text-slate-950 dark:text-white">4. À surveiller</h2></div>
          <div className="mt-4 space-y-2">
            {snapshot.alerts.length ? snapshot.alerts.slice(0, 4).map(alert => <div key={alert} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{alert}</div>) : <div className="rounded-xl bg-emerald-50 px-3 py-3 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">Aucun signal critique avec les données disponibles.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
