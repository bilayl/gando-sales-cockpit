"use client";

import { ShieldCheck, TrendingUp, UsersRound, WalletCards } from "lucide-react";
import { Stat } from "@/components/cockpit/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { useKpiScorecard } from "@/hooks/queries/use-kpis";

function euroCents(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100);
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function KpiCeoScorecard() {
  const { data, isPending, error } = useKpiScorecard();

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)}
      </div>
    );
  }

  if (error || !data) {
    return <div className="rounded-lg bg-destructive/7 px-3 py-2.5 text-xs text-destructive">{error instanceof Error ? error.message : "KPI indisponibles"}</div>;
  }

  const stats = [
    {
      label: "Cautions",
      value: integer(data.cautions.current),
      delta: data.cautions.mom == null ? null : data.cautions.mom * 100,
      hint: `${euroCents(data.cautions.tdvCents, 0)} garantis · ${euroCents(data.guarantee.averagePerCautionCents, 0)} / caution`,
      icon: <TrendingUp className="h-3.5 w-3.5" />,
    },
    {
      label: "Loueurs actifs",
      value: integer(data.mau.current),
      hint: `${decimal(data.mau.cautionsPerMau)} cautions / MAU · ${integer(data.mau.activatedEver)} activés depuis le début`,
      icon: <UsersRound className="h-3.5 w-3.5" />,
    },
    {
      label: "Marge contributive",
      value: data.contribution.perCautionCents == null ? "À fiabiliser" : euroCents(data.contribution.perCautionCents),
      hint: `${euroCents(data.contribution.measuredContributionCents)} ce mois · avant PSP + perte nette`,
      icon: <WalletCards className="h-3.5 w-3.5" />,
    },
    {
      label: data.loss.isProxy ? "Risque activé" : "Loss rate net",
      value: percent(data.loss.currentRate, 2),
      hint: `${euroCents(data.loss.currentAmountCents)} ce mois${data.loss.isProxy ? " · proxy à confirmer" : ""}`,
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
    },
  ];

  const lifetime = [
    ["Cautions cumulées", integer(data.cautions.total)],
    ["Volume garanti cumulé", euroCents(data.cautions.totalTdvCents, 0)],
    ["Revenu brut cumulé", euroCents(data.contribution.totalGrossRevenueCents)],
    ["Marge mesurée cumulée", euroCents(data.contribution.totalMeasuredContributionCents)],
  ];

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Vue d’ensemble</div>
          <div className="mt-0.5 text-sm font-semibold capitalize">{monthLabel(data.period.currentMonth)}</div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {data.period.comparisonMode === "same_elapsed_period_previous_month" ? "Comparaison à période égale vs M-1" : "Comparaison mensuelle"}
        </div>
      </div>

      <div className="grid divide-y divide-border/50 border-y border-border/50 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {stats.map(item => (
          <Stat
            key={item.label}
            label={item.label}
            value={item.value}
            delta={item.delta}
            hint={item.hint}
            icon={item.icon}
            className="px-1 sm:px-4 first:sm:pl-0 last:sm:pr-0"
          />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border/50 pb-5 lg:grid-cols-4">
        {lifetime.map(([label, value]) => (
          <div key={label}>
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {!data.contribution.complete || data.loss.isProxy ? (
        <p className="mt-3 max-w-4xl text-[10px] leading-5 text-muted-foreground">
          Fiabilité CFO : la marge reste mesurée avant PSP et perte nette Gando après récupération. Le risque affiché reste un proxy tant que les pertes clôturées ne sont pas entièrement reliées.
        </p>
      ) : null}
    </section>
  );
}
