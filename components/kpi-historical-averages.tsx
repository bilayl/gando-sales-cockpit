"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Database, Download, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildKpiHistoricalReport,
  type HistoricalMetric,
  type HistoricalMonth,
  type HistoricalRawMonth,
} from "@/lib/kpi-historical-averages";

type MetricUnit = HistoricalMetric["unit"];
const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const decimalFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

function formatted(value: number | null | undefined, unit: MetricUnit = "decimal") {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "euro") return euroFormatter.format(value);
  if (unit === "percent") return percentFormatter.format(value);
  return unit === "integer" ? integerFormatter.format(value) : decimalFormatter.format(value);
}

function dateLabel(key: string | null) {
  return key ? dateFormatter.format(new Date(key + "-01T12:00:00Z")) : "—";
}

function csvSafe(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

type TableColumn = {
  key: keyof HistoricalMonth;
  title: string;
  unit: MetricUnit;
};
const TABLE_COLUMNS: TableColumn[] = [
  { key: "revenue", title: "CA Gando", unit: "euro" },
  { key: "tdv", title: "TDV sécurisé", unit: "euro" },
  { key: "deposits", title: "Cautions", unit: "integer" },
  { key: "activeRenters", title: "MAU", unit: "integer" },
  { key: "depositsPerMau", title: "Cautions / MAU", unit: "decimal" },
  { key: "arpu", title: "ARPU", unit: "euro" },
  { key: "averageDeposit", title: "Caution moy.", unit: "euro" },
  { key: "takeRate", title: "Take rate", unit: "percent" },
  { key: "depositCashouts", title: "Captures payées", unit: "integer" },
  { key: "cashoutAmount", title: "Montant encaissé", unit: "euro" },
  { key: "cashoutRate", title: "Taux encaissement", unit: "percent" },
  { key: "averageCashout", title: "Encaissement moy.", unit: "euro" },
  { key: "advancedGuarantee", title: "Avances garanties", unit: "euro" },
  { key: "guaranteeShare", title: "Taux de garantie", unit: "percent" },
];

function downloadCsv(rows: HistoricalMonth[]) {
  const columns = ["Mois", ...TABLE_COLUMNS.map(col => col.title)];
  const body = rows.map(row => [
    row.key,
    ...TABLE_COLUMNS.map(column => {
      const n = row[column.key];
      // Export numeric machine-readable values (ratios in percent units)
      // rather than localized presentation, so analysts can recompute them.
      return typeof n === "number" && column.unit === "percent" ? n * 100 : n;
    }),
  ]);
  const content = "\ufeff" + [columns, ...body]
    .map(values => values.map(value => csvSafe(value as string | number | null)).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "gando-kpi-historique-complet.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AverageCard({ metric, totalMonths }: { metric: HistoricalMetric; totalMonths: number }) {
  return (
    <article className="min-w-0 rounded-xl border border-border bg-card px-4 py-4">
      <div className="text-[11px] font-semibold text-muted-foreground">{metric.title}</div>
      <div className="mt-2 break-words text-[24px] font-semibold tracking-tight tabular-nums text-foreground">
        {formatted(metric.value, metric.unit)}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {metric.months}/{totalMonths || 0} mois exploitables
      </p>
      <p className="mt-3 min-h-9 text-[10px] leading-[17px] text-muted-foreground/90">{metric.explanation}</p>
      <details className="mt-2 border-t border-border/70 pt-2">
        <summary className="cursor-pointer text-[10px] font-medium text-primary">Détail du calcul</summary>
        <p className="mt-2 text-[10px] leading-[16px] text-muted-foreground">{metric.formula}</p>
        <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
          {metric.numerator != null && metric.denominator != null
            ? formatted(metric.numerator, "decimal") + " ÷ " + formatted(metric.denominator, "decimal")
            : "Données insuffisantes pour calculer ce ratio."}
        </p>
      </details>
    </article>
  );
}

export function KpiHistoricalAverages() {
  const [rows, setRows] = useState<HistoricalRawMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/kpi", { cache: "no-store", signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Les KPI historiques ne sont pas disponibles.");
      if (!Array.isArray(payload.rows)) throw new Error("Le format des données mensuelles est inattendu.");
      if (!signal?.aborted) setRows(payload.rows);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Impossible de consulter les données historiques.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const report = useMemo(() => buildKpiHistoricalReport(rows), [rows]);

  return (
    <section id="moyennes-historiques" className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/20 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <BarChart3 className="size-3.5" /> Données historiques
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Moyennes depuis le début</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              Calculées sur les données mensuelles réelles de Gando. Les ratios sont pondérés
              par leur volume, jamais par une simple moyenne des pourcentages mensuels.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50">
            <RefreshCw className={"size-3.5" + (loading ? " animate-spin" : "")} />
            Actualiser
          </button>
        </div>
        {loading ? <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) =>
            <Skeleton key={index} className="h-[175px] rounded-xl" />)}
        </div> : error ? <div className="p-5 text-sm text-destructive" role="alert">{error}</div> : !report.months.length ? (
          <div className="p-5 text-sm text-muted-foreground">
            Aucun mois historique exploitable. Les données seront affichées lorsque des métriques seront disponibles.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-4 text-xs text-muted-foreground sm:px-5">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />
                {dateLabel(report.from)} → {dateLabel(report.to)}
              </span>
              <span className="inline-flex items-center gap-1.5"><Database className="size-4" />
                {report.monthsCovered} mois avec données sur {report.monthsInRange} mois calendaires
              </span>
              {report.excludedFutureMonths ? <span>
                {report.excludedFutureMonths} mois futur(s) exclus
              </span> : null}
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
              {report.metrics.map(metric => (
                <AverageCard key={metric.id} metric={metric} totalMonths={report.monthsInRange} />
              ))}
            </div>
            <div className="border-t border-border bg-muted/10 px-4 py-3 text-[11px] leading-5 text-muted-foreground sm:px-5">
              Les mois sans donnée ne sont pas assimilés à zéro. Le taux d’encaissement compte les
              captures payées et non les cautions distinctes ; le taux de garantie représente les
              avances garanties en montant rapportées aux encaissements, pas le taux de couverture
              d’assurance. Les mois futurs et prévisionnels sont exclus.
            </div>
          </>
        )}
      </Card>
      {!loading && !error && report.months.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Données</div>
              <h3 className="mt-1 text-sm font-semibold">Historique mensuel — tous les indicateurs</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Chiffres sources et ratios mensuels, y compris les encaissements et la garantie.
              </p>
            </div>
            <button type="button" onClick={() => downloadCsv(report.months)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-muted">
              <Download className="size-3.5" /> Exporter CSV
            </button>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1850px] text-left text-xs">
              <thead className="bg-muted/35 text-[10px] text-muted-foreground">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-muted px-4 py-3 font-semibold">Mois</th>
                  {TABLE_COLUMNS.map(column => (
                    <th scope="col" key={column.key} className="whitespace-nowrap px-3 py-3 text-right font-semibold">{column.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.months.map(month => (
                  <tr key={month.key} className="group hover:bg-muted/20">
                    <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-card px-4 py-3 text-left text-[11px] font-semibold group-hover:bg-muted">
                      {dateLabel(month.key)}
                    </th>
                    {TABLE_COLUMNS.map(column => (
                      <td key={column.key} className="whitespace-nowrap px-3 py-3 text-right text-[11px] tabular-nums">
                        {formatted(month[column.key] as number | null, column.unit)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border bg-muted/10 px-4 py-2 text-[10px] text-muted-foreground">
            « — » signifie non disponible, et non zéro. Les taux du CSV sont exportés en points de pourcentage.
          </div>
        </Card>
      ) : null}
    </section>
  );
}
