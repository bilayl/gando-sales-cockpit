"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronRight, Loader2, RefreshCw, Save, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Guarantee = {
  captureId: string; depositId: string; amountCents: number; activatedAt: string | null;
  amountDueCents: number | null; amountPaidCents: number | null;
  remainingDueCents: number | null; note: string | null; updatedAt: string | null;
};
type Renter = {
  accountId: string; name: string; companyName: string;
  activatedDeposits: number; depositVolumeCents: number; feesCents: number; feesMatchedDeposits: number;
  acceptedGuarantees: number; guaranteeAmountCents: number; gapFeesVsGuaranteesCents: number;
  confirmedDueCents: number; confirmedPaidCents: number; confirmedOutstandingCents: number;
  unconfirmedGuarantees: number; guarantees: Guarantee[];
};
type Report = {
  canEdit: boolean; period: string;
  source: { lastSyncedAt: string | null };
  summary: {
    renters: number; activatedDeposits: number; feesCents: number;
    acceptedGuarantees: number; guaranteeAmountCents: number; gapFeesVsGuaranteesCents: number;
    confirmedDueCents: number; confirmedPaidCents: number; confirmedOutstandingCents: number;
    unconfirmedGuarantees: number;
  };
  quality: { matchedFees: number; unmatchedAcceptedGuarantees: number; feeMatchApproximate: boolean };
  rows: Renter[];
};

function money(cents: number | null | undefined, digits = 2) {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(cents / 100);
}
function number(value: number) { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function localMonth() {
  const today = new Date();
  return today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
}
function fromCents(value: number | null) {
  return value === null ? "0,00" : (value / 100).toFixed(2).replace(".", ",");
}
function eurosToCents(value: string) {
  const trimmed = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Math.round(Number(trimmed) * 100);
  return Number.isSafeInteger(amount) ? amount : null;
}

function GuaranteeEditor({ item, accountId, canEdit, onSaved }: {
  item: Guarantee; accountId: string; canEdit: boolean; onSaved: () => Promise<void>;
}) {
  const [due, setDue] = useState(fromCents(item.amountDueCents));
  const [paid, setPaid] = useState(fromCents(item.amountPaidCents));
  const [note, setNote] = useState(item.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const untouched = item.amountDueCents === null;
  async function save() {
    const dueCents = eurosToCents(due);
    const paidCents = eurosToCents(paid);
    if (dueCents === null || paidCents === null || paidCents > dueCents) {
      setError("Saisissez des montants valides (le paiement ne peut pas dépasser la somme due).");
      return;
    }
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/kpi/renter-guarantee-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId, captureId: item.captureId,
          amountDueCents: dueCents, amountPaidCents: paidCents, note,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer le montant dû.");
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de mise à jour.");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold">Garantie du {formatDate(item.activatedAt)}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Capture : <span className="font-mono">{item.captureId}</span></p>
          <p className="mt-1 text-[11px] text-muted-foreground">Montant accepté : <span className="font-semibold text-foreground">{money(item.amountCents)}</span></p>
        </div>
        {untouched
          ? <Badge variant="outline" className="text-[10px]">Dette non qualifiée</Badge>
          : <Badge variant="secondary" className="text-[10px]">Reste dû : {money(item.remainingDueCents)}</Badge>}
      </div>
      {canEdit ? (
        <>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Renseigner uniquement la créance effectivement prévue par contrat ou confirmée avec le loueur. Une garantie n'est pas automatiquement une somme due.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-[150px_150px_minmax(150px,1fr)_auto] sm:items-end">
            <label className="block text-[11px] font-semibold">
              Montant dû (€)
              <Input inputMode="decimal" value={due} onChange={event => setDue(event.target.value)} className="mt-1 h-9 text-xs" />
            </label>
            <label className="block text-[11px] font-semibold">
              Déjà réglé (€)
              <Input inputMode="decimal" value={paid} onChange={event => setPaid(event.target.value)} className="mt-1 h-9 text-xs" />
            </label>
            <label className="block text-[11px] font-semibold">
              Justification / référence
              <Input value={note} maxLength={1500} onChange={event => setNote(event.target.value)}
                placeholder="Contrat, facture ou décision…" className="mt-1 h-9 text-xs" />
            </label>
            <Button size="sm" disabled={busy} onClick={() => void save()} className="h-9">
              {busy ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Enregistrer
            </Button>
          </div>
          {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
        </>
      ) : item.note ? <p className="mt-2 text-[11px] text-muted-foreground">{item.note}</p> : null}
      {item.amountDueCents !== null ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <span>Confirmé : {money(item.amountDueCents)}</span>
          <span>Payé : {money(item.amountPaidCents)}</span>
          <span>Reste : <strong className="text-foreground">{money(item.remainingDueCents)}</strong></span>
          {item.updatedAt ? <span>Actualisé le {formatDate(item.updatedAt)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function KpiRenterGuaranteeBalance() {
  const [report, setReport] = useState<Report | null>(null);
  const [period, setPeriod] = useState<"all" | "month">("all");
  const [month, setMonth] = useState(localMonth);
  const [query, setQuery] = useState("");
  const [guaranteesOnly, setGuaranteesOnly] = useState(false);
  const [sort, setSort] = useState<"risk" | "fees" | "outstanding">("risk");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const key = period === "all" ? "all" : month;
      const response = await fetch("/api/kpi/renter-guarantee-balance?month=" + encodeURIComponent(key),
        { cache: "no-store" });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Impossible de lire les balances loueurs.");
      setReport(value as Report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Données indisponibles.");
    } finally { setLoading(false); }
  }, [period, month]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    const filtered = (report?.rows || []).filter(row =>
      (!guaranteesOnly || row.acceptedGuarantees > 0)
      && (!needle || (row.name + " " + row.companyName).toLocaleLowerCase("fr-FR").includes(needle)));
    return filtered.sort((a,b) => sort === "fees" ? b.feesCents - a.feesCents :
      sort === "outstanding" ? b.confirmedOutstandingCents - a.confirmedOutstandingCents :
        b.guaranteeAmountCents - a.guaranteeAmountCents || b.feesCents - a.feesCents);
  }, [report, query, guaranteesOnly, sort]);
  const stats = report?.summary;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Rentabilité & risque par loueur</div>
          <h2 className="mt-1 text-base font-semibold">Frais de sécurisation vs garanties</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Confrontation des frais générés par les cautions, des garanties acceptées et des sommes contractuellement mises à la charge du loueur.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Période des indicateurs" value={period} onChange={event => setPeriod(event.target.value as "all" | "month")}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs">
            <option value="all">Depuis le lancement</option>
            <option value="month">Par mois</option>
          </select>
          {period === "month" ? <Input aria-label="Mois" type="month" value={month} onChange={event => setMonth(event.target.value)}
            className="h-9 w-[151px] text-xs"/> : null}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-9">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Actualiser
          </Button>
        </div>
      </div>
      {loading && !report ? <Skeleton className="h-[480px] w-full"/> : null}
      {error ? <p role="alert" className="m-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">{error}</p> : null}
      {stats ? <>
        <div className="grid grid-cols-2 border-b border-border xl:grid-cols-4">
          {[
            { label: "Frais de sécurisation", value: money(stats.feesCents), detail: number(stats.activatedDeposits) + " caution(s) activée(s)" },
            { label: "Garanties acceptées", value: money(stats.guaranteeAmountCents), detail: number(stats.acceptedGuarantees) + " dossier(s) de garantie" },
            { label: "Écart brut frais / garanties", value: money(stats.gapFeesVsGuaranteesCents), detail: "Indicateur d'exposition, pas une dette" },
            { label: "Reste dû confirmé", value: money(stats.confirmedOutstandingCents), detail:
              stats.unconfirmedGuarantees ? number(stats.unconfirmedGuarantees) + " garantie(s) sans créance qualifiée" :
                "Sommes confirmées et non réglées" },
          ].map((card,index) =>
            <div key={card.label} className={"px-4 py-4 " + (index % 2 ? "border-l border-border " : "") +
              (index >= 2 ? "border-t border-border xl:border-t-0 " : "") + (index === 2 ? "xl:border-l " : "")}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{card.label}</div>
              <div className="mt-2 text-[22px] font-semibold tracking-tight tabular-nums">{card.value}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{card.detail}</div>
            </div>
          )}
        </div>
        {stats.unconfirmedGuarantees > 0 ? <div className="flex items-start gap-2 border-b border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 text-xs leading-5 text-muted-foreground">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600"/>
          Le reste dû affiché n'inclut pas {number(stats.unconfirmedGuarantees)} garantie(s) dont la créance n'a pas encore été qualifiée. La somme des garanties acceptées ne doit pas être interprétée comme une facture à envoyer au loueur.
        </div> : null}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
          <div className="relative w-full sm:max-w-[290px]">
            <Search size={14} className="absolute left-3 top-[10px] text-muted-foreground"/>
            <Input aria-label="Rechercher un loueur" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Rechercher un loueur…" className="h-9 pl-9 text-xs"/>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={guaranteesOnly} onChange={event => setGuaranteesOnly(event.target.checked)}/>
            Uniquement avec garantie
          </label>
          <select value={sort} onChange={event => setSort(event.target.value as "risk" | "fees" | "outstanding")}
            aria-label="Trier les loueurs" className="ml-auto h-9 rounded-lg border border-border bg-background px-2 text-xs">
            <option value="risk">Plus forte garantie</option>
            <option value="fees">Plus de frais générés</option>
            <option value="outstanding">Reste dû confirmé</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1050px]">
            <TableHeader>
              <TableRow className="bg-muted/25">
                <TableHead className="w-9"/>
                <TableHead>Loueur</TableHead>
                <TableHead className="text-right">Cautions</TableHead>
                <TableHead className="text-right">Volume cautions</TableHead>
                <TableHead className="text-right">Frais sécu.</TableHead>
                <TableHead className="text-right">Garanties acceptées</TableHead>
                <TableHead className="text-right">Montant garanties</TableHead>
                <TableHead className="text-right">Écart brut</TableHead>
                <TableHead className="text-right">Reste dû confirmé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <Fragment key={row.accountId}><TableRow className="group">
                  <TableCell className="pr-0">
                    {row.guarantees.length > 0 ? <button type="button" aria-label={"Détails garanties " + row.name}
                      onClick={() => setExpanded(old => ({ ...old, [row.accountId]: !old[row.accountId] }))}
                      className="rounded p-1 hover:bg-muted">
                      {expanded[row.accountId] ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                    </button> : null}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">{row.name}</div>
                    {row.companyName && row.companyName !== row.name ? <p className="text-[10px] text-muted-foreground">{row.companyName}</p> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{number(row.activatedDeposits)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(row.depositVolumeCents, 0)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{money(row.feesCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number(row.acceptedGuarantees)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(row.guaranteeAmountCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(row.gapFeesVsGuaranteesCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.unconfirmedGuarantees === row.acceptedGuarantees && row.acceptedGuarantees > 0
                      ? <span className="text-xs text-muted-foreground">À qualifier</span>
                      : <span className="font-semibold">{money(row.confirmedOutstandingCents)}</span>}
                    {row.unconfirmedGuarantees > 0 && row.unconfirmedGuarantees !== row.acceptedGuarantees
                      ? <div className="text-[10px] text-amber-700">+ {row.unconfirmedGuarantees} non qualifiée(s)</div> : null}
                  </TableCell>
                </TableRow>
                {expanded[row.accountId] && row.guarantees.length ? <TableRow key={row.accountId + "-details"}>
                  <TableCell colSpan={9} className="bg-muted/10 px-5 py-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold"><CalendarDays size={14}/> Garanties acceptées · {row.name}</div>
                    <div className="grid gap-3">{row.guarantees.map(item =>
                      <GuaranteeEditor key={item.captureId} item={item} accountId={row.accountId}
                        canEdit={report.canEdit} onSaved={load}/>)}</div>
                  </TableCell>
                </TableRow> : null}</Fragment>
              ))}
              {!rows.length ? <TableRow><TableCell colSpan={9} className="h-24 text-center text-xs text-muted-foreground">Aucun loueur pour cette sélection.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </div>
        <footer className="space-y-1 border-t border-border bg-muted/10 px-4 py-3 text-[10px] leading-5 text-muted-foreground">
          <p><strong>Méthode :</strong> cautions activées selon leur date de début, frais de sécurisation encaissés rapprochés à chaque caution, garanties comptées uniquement si la demande a été acceptée. L'écart brut = frais − montant des garanties acceptées ; ce n'est pas une marge nette.</p>
          <p><strong>Créances :</strong> les montants réellement dus et déjà payés doivent être confirmés pour chaque garantie par un administrateur. Aucun montant n'est facturé automatiquement à partir du taux de sinistralité.</p>
          <p><strong>Qualité :</strong> {number(report.quality.matchedFees)} frais rattachés à une caution, rapprochement temporel indicatif sur 14 jours
            {report.quality.unmatchedAcceptedGuarantees ? " · " + report.quality.unmatchedAcceptedGuarantees + " garantie(s) sans capture correspondante" : ""}
            {report.source.lastSyncedAt ? " · Dernière synchronisation : " + formatDate(report.source.lastSyncedAt) : ""}.</p>
        </footer>
      </> : null}
    </Card>
  );
}
