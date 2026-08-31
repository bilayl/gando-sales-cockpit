"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  Building2,
  Calculator,
  Clock,
  Euro,
  Megaphone,
  Plus,
  Save,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CoreKpiRow = {
  year: number;
  monthNumber: number;
  revenue: number | null;
  tdv: number | null;
  deposits: number | null;
  activeRenters: number | null;
  churnRate: number | null;
};

type ValueRow = {
  id?: string;
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

type ValueNumericKey = Exclude<keyof ValueRow, "id" | "year" | "monthNumber">;

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const VALUE_FIELDS: Array<{ key: ValueNumericKey; label: string; group: string; euro?: boolean; days?: boolean }> = [
  { key: "prospectsContacted", label: "Prospects contactés", group: "Acquisition / Sales" },
  { key: "callsMade", label: "Calls réalisés", group: "Acquisition / Sales" },
  { key: "meetings", label: "RDV qualifiés", group: "Acquisition / Sales" },
  { key: "rentersRegistered", label: "Loueurs inscrits", group: "Activation" },
  { key: "rentersActivated", label: "Loueurs activés", group: "Activation" },
  { key: "firstDepositRenters", label: "Loueurs avec 1re caution", group: "Activation" },
  { key: "paidSpend", label: "Dépenses paid", group: "Acquisition / Sales", euro: true },
  { key: "salesCost", label: "Coût commercial", group: "Acquisition / Sales", euro: true },
  { key: "paidLeads", label: "Leads paid", group: "Acquisition / Sales" },
  { key: "organicLeads", label: "Leads organiques", group: "Acquisition / Sales" },
  { key: "signedRevenue", label: "CA signé", group: "Finance", euro: true },
  { key: "cashCollected", label: "Cash encaissé", group: "Finance", euro: true },
  { key: "mrr", label: "MRR", group: "Récurrence", euro: true },
  { key: "refunds", label: "Churn / remboursements €", group: "Récurrence", euro: true },
  { key: "netMargin", label: "Marge nette Gando", group: "Finance", euro: true },
  { key: "avgClosingDays", label: "Délai moyen de closing", group: "Sales quality", days: true },
  { key: "avgDealAgeDays", label: "Âge moyen des deals", group: "Sales quality", days: true },
  { key: "dealsOver40Days", label: "Deals > 40 jours", group: "Sales quality" },
  { key: "decisionsTaken", label: "Décisions prises grâce aux KPI", group: "Pilotage" },
];

function blankValue(year: number, monthNumber: number): ValueRow {
  return {
    year,
    monthNumber,
    prospectsContacted: null,
    callsMade: null,
    meetings: null,
    rentersRegistered: null,
    rentersActivated: null,
    firstDepositRenters: null,
    paidSpend: null,
    salesCost: null,
    paidLeads: null,
    organicLeads: null,
    signedRevenue: null,
    cashCollected: null,
    mrr: null,
    refunds: null,
    netMargin: null,
    avgClosingDays: null,
    avgDealAgeDays: null,
    dealsOver40Days: null,
    decisionsTaken: null,
  };
}

function rowKey(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function ratio(top: number | null | undefined, bottom: number | null | undefined) {
  const t = n(top), b = n(bottom);
  return b > 0 ? t / b : null;
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

function MetricCard({ label, value, detail, icon: Icon, warning }: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof Activity;
  warning?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border bg-white p-4 shadow-sm dark:bg-white/[0.035]", warning ? "border-amber-300 dark:border-amber-500/40" : "border-slate-200 dark:border-white/10")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-bold tracking-[-0.035em] text-slate-900 dark:text-white">{value}</div>
          {detail ? <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</div> : null}
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#735DF3]/10 text-[#735DF3]"><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );
}

function FunnelStep({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{sub}</div> : null}
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return <div className="flex w-16 shrink-0 items-center justify-center text-center text-[10px] font-semibold leading-4 text-[#735DF3]">{label}</div>;
}

export function ValueKpiFunnel({ canEdit }: { canEdit: boolean }) {
  const [coreRows, setCoreRows] = useState<CoreKpiRow[]>([]);
  const [valueRows, setValueRows] = useState<ValueRow[]>([]);
  const [campaignRows, setCampaignRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ValueRow | null>(null);
  const [campaignDraft, setCampaignDraft] = useState<CampaignRow>({ year: new Date().getFullYear(), monthNumber: new Date().getMonth() + 1, source: "", campaign: "", spend: null, leads: null, meetings: null, clients: null, signedRevenue: null, cashCollected: null });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [coreResponse, valueResponse, campaignResponse] = await Promise.all([
        fetch("/api/kpi", { cache: "no-store" }),
        fetch("/api/kpi/value-funnel", { cache: "no-store" }),
        fetch("/api/kpi/campaigns", { cache: "no-store" }),
      ]);
      const [coreBody, valueBody, campaignBody] = await Promise.all([coreResponse.json(), valueResponse.json(), campaignResponse.json()]);
      if (!coreResponse.ok) throw new Error(coreBody.error || "Impossible de charger les KPI business.");
      if (!valueResponse.ok) throw new Error(valueBody.error || "Impossible de charger le funnel KPI.");
      if (!campaignResponse.ok) throw new Error(campaignBody.error || "Impossible de charger les campagnes.");
      setCoreRows(Array.isArray(coreBody.rows) ? coreBody.rows : []);
      setValueRows(Array.isArray(valueBody.rows) ? valueBody.rows : []);
      setCampaignRows(Array.isArray(campaignBody.rows) ? campaignBody.rows : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les KPI.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const row of coreRows) keys.add(rowKey(row.year, row.monthNumber));
    for (const row of valueRows) keys.add(rowKey(row.year, row.monthNumber));
    const now = new Date();
    keys.add(rowKey(now.getFullYear(), now.getMonth() + 1));
    return [...keys].sort().reverse();
  }, [coreRows, valueRows]);

  useEffect(() => {
    if (selectedMonth || !monthOptions.length) return;
    const valueFilled = [...valueRows].filter(row => VALUE_FIELDS.some(field => row[field.key] != null)).sort((a, b) => (b.year * 12 + b.monthNumber) - (a.year * 12 + a.monthNumber));
    if (valueFilled[0]) setSelectedMonth(rowKey(valueFilled[0].year, valueFilled[0].monthNumber));
    else setSelectedMonth(monthOptions[0]);
  }, [monthOptions, selectedMonth, valueRows]);

  const [year, monthNumber] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return [y || new Date().getFullYear(), m || new Date().getMonth() + 1];
  }, [selectedMonth]);

  const core = coreRows.find(row => row.year === year && row.monthNumber === monthNumber) || null;
  const value = valueRows.find(row => row.year === year && row.monthNumber === monthNumber) || blankValue(year, monthNumber);
  const campaigns = campaignRows.filter(row => row.year === year && row.monthNumber === monthNumber);

  useEffect(() => {
    setDraft({ ...value });
    setCampaignDraft({ year, monthNumber, source: "", campaign: "", spend: null, leads: null, meetings: null, clients: null, signedRevenue: null, cashCollected: null });
  }, [selectedMonth, valueRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const derived = useMemo(() => {
    const totalLeads = n(value.paidLeads) + n(value.organicLeads);
    const acquisitionCost = n(value.paidSpend) + n(value.salesCost);
    const cac = n(value.rentersActivated) > 0 ? acquisitionCost / n(value.rentersActivated) : null;
    const arpu = ratio(core?.revenue, core?.activeRenters);
    const churn = n(core?.churnRate);
    const lifetimeMonths = churn > 0 ? Math.min(24, 1 / churn) : 24;
    const ltv24 = arpu == null ? null : arpu * lifetimeMonths;
    const ltvCac = ltv24 != null && cac != null && cac > 0 ? ltv24 / cac : null;
    const collectionRate = ratio(value.cashCollected, value.signedRevenue);
    const marginRate = ratio(value.netMargin, core?.revenue);
    const nrr = value.mrr == null ? null : Math.max(0, n(value.mrr) * (1 - churn) - n(value.refunds));
    const organicShare = totalLeads > 0 ? n(value.organicLeads) / totalLeads : null;
    const campaignSpend = campaigns.reduce((sum, row) => sum + n(row.spend), 0);
    const campaignRevenue = campaigns.reduce((sum, row) => sum + n(row.signedRevenue), 0);
    const campaignCash = campaigns.reduce((sum, row) => sum + n(row.cashCollected), 0);
    return {
      totalLeads,
      cplPaid: ratio(value.paidSpend, value.paidLeads),
      cac,
      arpu,
      ltv24,
      ltvCac,
      closingRate: ratio(value.rentersActivated, value.meetings),
      collectionRate,
      takeRate: ratio(core?.revenue, core?.tdv),
      marginRate,
      nrr,
      organicShare,
      campaignSpend,
      campaignRevenue,
      campaignCash,
    };
  }, [value, core, campaigns]);

  const alerts = useMemo(() => {
    const items: string[] = [];
    if (derived.ltvCac != null && derived.ltvCac < 3) items.push(`LTV / CAC à ${decimal(derived.ltvCac, 1)} : sous le repère 3x.`);
    if (n(value.avgDealAgeDays) > 40) items.push(`Âge moyen des deals à ${decimal(value.avgDealAgeDays, 0)} jours : pipeline à nettoyer.`);
    if (n(value.dealsOver40Days) > 0) items.push(`${integer(value.dealsOver40Days)} deal(s) ont plus de 40 jours.`);
    if (derived.collectionRate != null && derived.collectionRate < 0.9) items.push(`Seulement ${percent(derived.collectionRate)} du CA signé est encaissé.`);
    if (derived.organicShare != null && derived.organicShare < 0.2 && n(value.paidLeads) > 0) items.push(`Dépendance paid élevée : ${percent(1 - derived.organicShare)} des leads viennent du paid.`);
    if (derived.marginRate != null && derived.marginRate < 0) items.push("Marge nette négative sur le mois.");
    return items;
  }, [derived, value]);

  async function saveValue() {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await fetch("/api/kpi/value-funnel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer.");
      setValueRows(Array.isArray(body.rows) ? body.rows : []);
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCampaign() {
    if (!campaignDraft.source.trim() || !campaignDraft.campaign.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/kpi/campaigns", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...campaignDraft, year, monthNumber }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer la campagne.");
      setCampaignRows(Array.isArray(body.rows) ? body.rows : []);
      setCampaignDraft({ year, monthNumber, source: "", campaign: "", spend: null, leads: null, meetings: null, clients: null, signedRevenue: null, cashCollected: null });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer la campagne.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampaign(id?: string) {
    if (!id) return;
    const response = await fetch("/api/kpi/campaigns", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const body = await response.json();
    if (response.ok) setCampaignRows(Array.isArray(body.rows) ? body.rows : []);
  }

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.035]">Chargement du Value Funnel…</div>;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#735DF3]">Value KPI</div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white">Le funnel qui relie activité → revenu → marge</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Prospects contactés → RDV → loueurs inscrits → activés → 1re caution → usage → volume sécurisé → CA Gando → marge nette.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-white/10 dark:bg-[#1b1e29]">
            {monthOptions.map(key => {
              const [y, m] = key.split("-").map(Number);
              return <option key={key} value={key}>{MONTHS[m - 1]} {y}</option>;
            })}
          </select>
          {canEdit ? <Button type="button" variant="outline" onClick={() => setEditing(value => !value)}>{editing ? "Fermer" : "Saisir les KPI"}</Button> : null}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-3xl border border-slate-200 bg-[#fafaff] p-5 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mb-4 flex items-center justify-between"><div className="text-sm font-bold text-slate-900 dark:text-white">1. Funnel commercial & activation</div><div className="text-xs text-slate-400">Chaque ratio explique la perte entre 2 étapes</div></div>
        <div className="flex min-w-[980px] items-stretch overflow-x-auto pb-2">
          <FunnelStep label="Prospects contactés" value={integer(value.prospectsContacted)} />
          <Connector label={percent(ratio(value.meetings, value.prospectsContacted))} />
          <FunnelStep label="RDV" value={integer(value.meetings)} sub={`${integer(value.callsMade)} calls`} />
          <Connector label={percent(ratio(value.rentersRegistered, value.meetings))} />
          <FunnelStep label="Loueurs inscrits" value={integer(value.rentersRegistered)} />
          <Connector label={percent(ratio(value.rentersActivated, value.rentersRegistered))} />
          <FunnelStep label="Loueurs activés" value={integer(value.rentersActivated)} />
          <Connector label={percent(ratio(value.firstDepositRenters, value.rentersActivated))} />
          <FunnelStep label="1re caution" value={integer(value.firstDepositRenters)} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="mb-4 text-sm font-bold text-slate-900 dark:text-white">2. Création de valeur Gando</div>
        <div className="flex min-w-[760px] items-stretch overflow-x-auto pb-2">
          <FunnelStep label="Cautions / mois" value={integer(core?.deposits)} sub={core?.activeRenters ? `${decimal(ratio(core.deposits, core.activeRenters), 1)} / loueur actif` : undefined} />
          <Connector label={core?.deposits ? `${euro(ratio(core.tdv, core.deposits), 0)} / caution` : "—"} />
          <FunnelStep label="€ sécurisés (TDV)" value={euro(core?.tdv)} />
          <Connector label={`Take rate ${percent(derived.takeRate)}`} />
          <FunnelStep label="CA Gando" value={euro(core?.revenue)} />
          <Connector label={`Marge ${percent(derived.marginRate)}`} />
          <FunnelStep label="Marge nette" value={euro(value.netMargin)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="CPL Paid" value={euro(derived.cplPaid, 2)} detail={`${integer(value.paidLeads)} leads paid · ${euro(value.paidSpend)} dépensés`} icon={Megaphone} />
        <MetricCard label="CAC complet" value={euro(derived.cac, 0)} detail="Paid + coût commercial / loueur activé" icon={Calculator} />
        <MetricCard label="LTV 24 mois" value={euro(derived.ltv24, 0)} detail={`ARPU ${euro(derived.arpu, 0)} · LTV plafonnée à 24 mois`} icon={TrendingUp} />
        <MetricCard label="LTV / CAC" value={derived.ltvCac == null ? "—" : `${decimal(derived.ltvCac, 1)}×`} detail="Repère de pilotage : viser > 3×" icon={BarChart3} warning={derived.ltvCac != null && derived.ltvCac < 3} />

        <MetricCard label="Taux de closing" value={percent(derived.closingRate)} detail="RDV → loueurs activés" icon={Users} />
        <MetricCard label="Délai de closing" value={value.avgClosingDays == null ? "—" : `${decimal(value.avgClosingDays, 0)} j`} detail={`Âge moyen pipeline : ${value.avgDealAgeDays == null ? "—" : `${decimal(value.avgDealAgeDays, 0)} j`}`} icon={Clock} warning={n(value.avgDealAgeDays) > 40} />
        <MetricCard label="CA signé → cash" value={percent(derived.collectionRate)} detail={`${euro(value.signedRevenue)} signé · ${euro(value.cashCollected)} encaissé`} icon={Wallet} warning={derived.collectionRate != null && derived.collectionRate < 0.9} />
        <MetricCard label="Net Recurring Revenue" value={euro(derived.nrr)} detail={`MRR ${euro(value.mrr)} · churn ${percent(core?.churnRate)} · remboursements ${euro(value.refunds)}`} icon={Banknote} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-sm font-bold text-slate-900 dark:text-white">Attribution campagne → cash</div><div className="mt-1 text-xs text-slate-500">Ne jamais optimiser uniquement sur le CPL : chaque campagne va jusqu’au client, au CA signé et au cash.</div></div>
            <div className="text-right text-xs text-slate-400">{euro(derived.campaignSpend)} spend → {euro(derived.campaignCash)} cash</div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] uppercase tracking-[0.1em] text-slate-400 dark:border-white/10"><tr><th className="py-3 pr-3">Source / campagne</th><th className="px-2">Spend</th><th className="px-2">Leads</th><th className="px-2">CPL</th><th className="px-2">RDV</th><th className="px-2">Clients</th><th className="px-2">CAC</th><th className="px-2">CA signé</th><th className="px-2">Cash</th><th /></tr></thead>
              <tbody>
                {campaigns.map(row => (
                  <tr key={row.id || `${row.source}-${row.campaign}`} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-3 pr-3"><div className="font-semibold text-slate-900 dark:text-white">{row.campaign}</div><div className="text-slate-400">{row.source}</div></td>
                    <td className="px-2">{euro(row.spend)}</td><td className="px-2">{integer(row.leads)}</td><td className="px-2">{euro(ratio(row.spend, row.leads), 2)}</td><td className="px-2">{integer(row.meetings)}</td><td className="px-2">{integer(row.clients)}</td><td className="px-2">{euro(ratio(row.spend, row.clients), 0)}</td><td className="px-2">{euro(row.signedRevenue)}</td><td className="px-2 font-semibold">{euro(row.cashCollected)}</td>
                    <td>{canEdit ? <button type="button" onClick={() => void deleteCampaign(row.id)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button> : null}</td>
                  </tr>
                ))}
                {!campaigns.length ? <tr><td colSpan={10} className="py-6 text-center text-slate-400">Aucune campagne renseignée pour ce mois.</td></tr> : null}
              </tbody>
            </table>
          </div>

          {canEdit ? <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.025] sm:grid-cols-2 xl:grid-cols-5">
            <Input placeholder="Source (Meta, SEO…)" value={campaignDraft.source} onChange={e => setCampaignDraft(prev => ({ ...prev, source: e.target.value }))} />
            <Input placeholder="Campagne" value={campaignDraft.campaign} onChange={e => setCampaignDraft(prev => ({ ...prev, campaign: e.target.value }))} />
            <Input type="number" placeholder="Spend €" value={campaignDraft.spend ?? ""} onChange={e => setCampaignDraft(prev => ({ ...prev, spend: e.target.value === "" ? null : Number(e.target.value) }))} />
            <Input type="number" placeholder="Leads" value={campaignDraft.leads ?? ""} onChange={e => setCampaignDraft(prev => ({ ...prev, leads: e.target.value === "" ? null : Number(e.target.value) }))} />
            <Input type="number" placeholder="RDV" value={campaignDraft.meetings ?? ""} onChange={e => setCampaignDraft(prev => ({ ...prev, meetings: e.target.value === "" ? null : Number(e.target.value) }))} />
            <Input type="number" placeholder="Clients" value={campaignDraft.clients ?? ""} onChange={e => setCampaignDraft(prev => ({ ...prev, clients: e.target.value === "" ? null : Number(e.target.value) }))} />
            <Input type="number" placeholder="CA signé €" value={campaignDraft.signedRevenue ?? ""} onChange={e => setCampaignDraft(prev => ({ ...prev, signedRevenue: e.target.value === "" ? null : Number(e.target.value) }))} />
            <Input type="number" placeholder="Cash €" value={campaignDraft.cashCollected ?? ""} onChange={e => setCampaignDraft(prev => ({ ...prev, cashCollected: e.target.value === "" ? null : Number(e.target.value) }))} />
            <Button type="button" onClick={() => void saveCampaign()} disabled={saving || !campaignDraft.source.trim() || !campaignDraft.campaign.trim()} className="xl:col-span-2"><Plus className="mr-2 h-4 w-4" /> Ajouter la campagne</Button>
          </div> : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Activity className="h-4 w-4 text-[#735DF3]" /> Signaux à traiter</div>
            <div className="mt-4 space-y-2">
              {alerts.length ? alerts.map(item => <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{item}</div>) : <div className="rounded-xl bg-emerald-50 px-3 py-3 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">Aucun signal critique détecté avec les données disponibles.</div>}
            </div>
          </div>
          <MetricCard label="Décisions prises" value={integer(value.decisionsTaken)} detail="Le dashboard doit provoquer une action concrète, pas seulement être consulté." icon={Building2} />
          <MetricCard label="Mix organique" value={percent(derived.organicShare)} detail={`${integer(value.organicLeads)} organiques / ${integer(derived.totalLeads)} leads`} icon={Euro} />
        </div>
      </div>

      {editing && canEdit && draft ? <div className="rounded-3xl border border-[#735DF3]/25 bg-[#735DF3]/[0.035] p-5">
        <div className="flex items-center justify-between"><div><div className="text-sm font-bold text-slate-900 dark:text-white">Saisie Value KPI · {MONTHS[monthNumber - 1]} {year}</div><div className="mt-1 text-xs text-slate-500">Les KPI dérivés se recalculent automatiquement.</div></div><Button onClick={() => void saveValue()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
        {["Acquisition / Sales", "Activation", "Finance", "Récurrence", "Sales quality", "Pilotage"].map(group => {
          const fields = VALUE_FIELDS.filter(field => field.group === group);
          return <div key={group} className="mt-5"><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{group}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields.map(field => <label key={field.key} className="space-y-1.5"><span className="text-[11px] font-semibold text-slate-500">{field.label}</span><div className="relative"><Input type="number" step="any" value={draft[field.key] ?? ""} onChange={e => setDraft(prev => prev ? ({ ...prev, [field.key]: e.target.value === "" ? null : Number(e.target.value) }) : prev)} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{field.euro ? "€" : field.days ? "j" : ""}</span></div></label>)}</div></div>;
        })}
      </div> : null}
    </section>
  );
}
