"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeEuro, CalendarClock, ShieldCheck, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type InsuranceMonth = {
  month: string;
  partial: boolean;
  cautions: number;
  tdvCents: number;
  insuranceCostCents: number;
};

type DecisionData = {
  actual?: InsuranceMonth[];
  forecast?: {
    trailing?: {
      insuranceRateBps?: number;
      insuranceEffectiveFrom?: string;
    };
  };
};

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

function euroFromCents(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(value / 100);
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function rateFromBps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 10000);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return `${MONTHS[month - 1]} ${year}`;
}

export function KpiInsurancePayable() {
  const [data, setData] = useState<DecisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/decision-intelligence", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Impossible de calculer l’assurance à payer.");
        setData(body);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de calculer l’assurance à payer.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const model = useMemo(() => {
    const rows = data?.actual || [];
    const rateBps = data?.forecast?.trailing?.insuranceRateBps || 0;
    const effectiveFrom = data?.forecast?.trailing?.insuranceEffectiveFrom || null;
    const effectiveMonth = effectiveFrom ? effectiveFrom.slice(0, 7) : null;
    const insuredRows = rows.filter(row => !effectiveMonth || row.month >= effectiveMonth);
    const current = insuredRows.at(-1) || null;
    const lastClosed = [...insuredRows].reverse().find(row => !row.partial) || null;
    const cumulative = insuredRows.reduce((sum, row) => sum + Number(row.insuranceCostCents || 0), 0);
    const trailing12 = insuredRows.slice(-12).reduce((sum, row) => sum + Number(row.insuranceCostCents || 0), 0);

    return {
      rows: insuredRows,
      rateBps,
      effectiveFrom,
      current,
      lastClosed,
      cumulative,
      trailing12,
    };
  }, [data]);

  if (loading) return <Skeleton className="h-[360px] w-full rounded-xl" />;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
        {error || "Données assurance indisponibles."}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 text-primary" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Assurance</div>
            <div className="mt-0.5 text-sm font-semibold">Ce que Gando doit payer à l’assurance</div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Calcul mensuel automatique sur les cautions rapprochées : TDV assuré × taux d’assurance.
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Taux {rateFromBps(model.rateBps)}
        </Badge>
      </div>

      <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
        <InsuranceMetric
          icon={<WalletCards className="size-3.5" />}
          label="À payer ce mois"
          value={euroFromCents(model.current?.insuranceCostCents)}
          detail={model.current ? `${monthLabel(model.current.month)} · ${model.current.partial ? "mois en cours" : "mois clôturé"}` : "Aucune donnée"}
        />
        <InsuranceMetric
          icon={<CalendarClock className="size-3.5" />}
          label="Dernier mois clôturé"
          value={euroFromCents(model.lastClosed?.insuranceCostCents)}
          detail={model.lastClosed ? monthLabel(model.lastClosed.month) : "Aucun mois clôturé"}
        />
        <InsuranceMetric
          icon={<BadgeEuro className="size-3.5" />}
          label="12 derniers mois"
          value={euroFromCents(model.trailing12)}
          detail="Assurance calculée sur les mois disponibles"
        />
        <InsuranceMetric
          icon={<ShieldCheck className="size-3.5" />}
          label="Cumul depuis prise d’effet"
          value={euroFromCents(model.cumulative)}
          detail={model.effectiveFrom ? `Depuis ${new Date(model.effectiveFrom).toLocaleDateString("fr-FR")}` : "Date de prise d’effet non renseignée"}
        />
      </div>

      <div className="overflow-x-auto border-t border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mois</TableHead>
              <TableHead className="text-right">Cautions assurées</TableHead>
              <TableHead className="text-right">TDV assuré</TableHead>
              <TableHead className="text-right">Taux</TableHead>
              <TableHead className="text-right">Assurance à payer</TableHead>
              <TableHead className="text-right">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...model.rows].reverse().map(row => (
              <TableRow key={row.month}>
                <TableCell className="font-medium">{monthLabel(row.month)}</TableCell>
                <TableCell className="text-right">{integer(row.cautions)}</TableCell>
                <TableCell className="text-right">{euroFromCents(row.tdvCents)}</TableCell>
                <TableCell className="text-right">{rateFromBps(model.rateBps)}</TableCell>
                <TableCell className="text-right font-semibold">{euroFromCents(row.insuranceCostCents)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={row.partial ? "secondary" : "outline"} className="text-[9px]">
                    {row.partial ? "En cours" : "Clôturé"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {!model.rows.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                  Aucune période assurance disponible pour le moment.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="border-t border-border bg-muted/10 px-4 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Le montant est calculé à partir des cautions activées rapprochées avec leurs frais. Le mois en cours reste provisoire jusqu’à clôture et synchronisation complète des données.
      </div>
    </Card>
  );
}

function InsuranceMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}
