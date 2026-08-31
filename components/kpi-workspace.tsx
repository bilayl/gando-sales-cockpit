"use client";

import { useState } from "react";
import { BarChart3, ChartNoAxesCombined, Gauge, History } from "lucide-react";
import { KpiExecutiveOverview } from "@/components/kpi-executive-overview";
import { ValueKpiFunnel } from "@/components/value-kpi-funnel";
import { BusinessKpiDashboard } from "@/components/business-kpi-dashboard";
import { cn } from "@/lib/utils";

type View = "overview" | "funnel" | "history";

const VIEWS: Array<{ id: View; label: string; description: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Vue d’ensemble", description: "Santé business, funnel et alertes", icon: Gauge },
  { id: "funnel", label: "Funnel & économie", description: "Acquisition, sales, finance et campagnes", icon: ChartNoAxesCombined },
  { id: "history", label: "Historique & simulation", description: "Mois réels, moyennes et projections", icon: History },
];

export function KpiWorkspace({ canEdit }: { canEdit: boolean }) {
  const [view, setView] = useState<View>("overview");

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
        <div className="grid gap-2 lg:grid-cols-3">
          {VIEWS.map(item => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition",
                  active
                    ? "bg-[#735DF3] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5",
                )}
              >
                <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", active ? "bg-white/15" : "bg-[#735DF3]/10 text-[#735DF3]")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className={cn("mt-0.5 text-xs", active ? "text-white/70" : "text-slate-400")}>{item.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {view === "overview" ? <KpiExecutiveOverview /> : null}

      {view === "funnel" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white"><ChartNoAxesCombined className="h-4 w-4 text-[#735DF3]" /> Funnel & économie</div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Vue détaillée pour analyser les conversions, les unit economics, les campagnes et saisir les KPI opérationnels.</p>
          </div>
          <ValueKpiFunnel canEdit={canEdit} />
        </div>
      ) : null}

      {view === "history" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white"><BarChart3 className="h-4 w-4 text-[#735DF3]" /> Historique & simulation</div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saisie mensuelle, lecture des tendances historiques et projections à partir des moyennes réelles.</p>
          </div>
          <BusinessKpiDashboard canEdit={canEdit} />
        </div>
      ) : null}
    </div>
  );
}
