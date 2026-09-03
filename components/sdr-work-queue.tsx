"use client";

import { CalendarClock, CircleSlash2, List, PhoneCall, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProspectionBucket } from "@/lib/company-prospection-priority";

export type SdrWorkFilter = ProspectionBucket | "ALL";

type Props = {
  activeFilter: SdrWorkFilter;
  actionableCount: number;
  opportunitiesCount: number;
  snoozedCount: number;
  excludedCount: number;
  totalCount: number;
  segmentName?: string;
  loading?: boolean;
  onFilterChange: (filter: SdrWorkFilter) => void;
  onStartSession: () => void;
};

const buckets: Array<{
  value: SdrWorkFilter;
  label: string;
  description: string;
  icon: typeof PhoneCall;
}> = [
  {
    value: "ACTIONABLE",
    label: "À appeler",
    description: "À traiter maintenant",
    icon: PhoneCall,
  },
  {
    value: "OPPORTUNITY",
    label: "Opportunités",
    description: "RDV ou deal en cours",
    icon: Target,
  },
  {
    value: "SNOOZED",
    label: "Plus tard",
    description: "Relance déjà planifiée",
    icon: CalendarClock,
  },
  {
    value: "EXCLUDED",
    label: "Écartés",
    description: "À ne plus prospecter",
    icon: CircleSlash2,
  },
  {
    value: "ALL",
    label: "Tous",
    description: "Toute la file de travail",
    icon: List,
  },
];

export function SdrWorkQueue({
  activeFilter,
  actionableCount,
  opportunitiesCount,
  snoozedCount,
  excludedCount,
  totalCount,
  segmentName,
  loading = false,
  onFilterChange,
  onStartSession,
}: Props) {
  const counts: Record<SdrWorkFilter, number> = {
    ACTIONABLE: actionableCount,
    OPPORTUNITY: opportunitiesCount,
    SNOOZED: snoozedCount,
    EXCLUDED: excludedCount,
    ALL: totalCount,
  };

  return (
    <section className="border-b border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-lg font-bold tracking-tight">Votre file de travail</h1>
            {segmentName ? <Badge variant="outline" className="max-w-[240px] truncate">{segmentName}</Badge> : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Le cockpit trie automatiquement : <strong className="text-foreground">tâches en retard → relances → recontacts → nouveaux comptes</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            disabled={loading || actionableCount === 0}
            onClick={onStartSession}
            className="h-9 gap-2"
          >
            <PhoneCall size={15} />
            Démarrer les appels
            {actionableCount > 0 ? (
              <Badge variant="secondary" className="bg-background/80 text-foreground">{actionableCount}</Badge>
            ) : null}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-5">
        {buckets.map(bucket => {
          const Icon = bucket.icon;
          const active = activeFilter === bucket.value;
          return (
            <button
              key={bucket.value}
              type="button"
              onClick={() => onFilterChange(bucket.value)}
              className={cn(
                "flex min-w-0 items-center gap-3 border-r border-border px-4 py-3 text-left transition-colors last:border-r-0 hover:bg-muted/50",
                active && "bg-primary/[0.06]",
              )}
            >
              <span className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground",
                active && "border-primary/30 bg-primary/10 text-primary",
              )}>
                <Icon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("truncate text-sm font-semibold", active && "text-primary")}>{bucket.label}</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">{counts[bucket.value]}</span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">{bucket.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
