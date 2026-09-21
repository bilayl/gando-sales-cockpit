"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { KpiWorkspace } from "@/components/kpi-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { useKpiSync } from "@/hooks/queries/use-kpi";
import { KPI_VIEW_META, KPI_VIEWS, type KpiView } from "@/lib/kpi-views";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function syncTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function KpiClientShell({
  role,
}: {
  email?: string;
  role: "admin" | "member" | "commercial";
}) {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum<KpiView>([...KPI_VIEWS]).withDefault("ceo"),
  );
  const sync = useKpiSync(role === "admin");
  const lastRunAt = useRef(0);

  useEffect(() => {
    const run = () => {
      if (sync.isPending) return;
      lastRunAt.current = Date.now();
      sync.mutate();
    };

    run();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastRunAt.current >= AUTO_REFRESH_INTERVAL_MS) run();
    }, AUTO_REFRESH_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRunAt.current >= AUTO_REFRESH_INTERVAL_MS) run();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [role]);

  const meta = KPI_VIEW_META[view];
  const lastSync = syncTime(sync.data?.completedAt);

  return (
    <div className="page-shell min-h-[calc(100svh-3rem)]">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Pilotage"
          title="KPI"
          description={meta.description}
          actions={
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
                {sync.isPending ? <RefreshCw className="size-3.5 animate-spin" /> : sync.isError ? <TriangleAlert className="size-3.5 text-amber-500" /> : <CheckCircle2 className="size-3.5 text-emerald-500" />}
                <span>{sync.isPending ? "Synchronisation…" : sync.isError ? "Source à vérifier" : lastSync ? `À jour · ${lastSync}` : "Actualisation automatique"}</span>
              </div>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => sync.mutate()} disabled={sync.isPending}>
                <RefreshCw className={cn("size-3.5", sync.isPending && "animate-spin")} />
                Actualiser
              </Button>
            </div>
          }
        />

        <nav className="mt-6 flex min-w-0 gap-1 overflow-x-auto border-b border-border/60 pb-px minari-scrollbar" aria-label="Vues KPI">
          {KPI_VIEWS.map(id => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => void setView(id)}
                className={cn(
                  "relative shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                {KPI_VIEW_META[id].label}
                {active ? <span className="absolute inset-x-2 -bottom-px h-px bg-foreground" /> : null}
              </button>
            );
          })}
        </nav>
      </div>

      <KpiWorkspace view={view} canEdit={role !== "commercial"} />
    </div>
  );
}
