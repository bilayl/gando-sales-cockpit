"use client";

import {
  BadgeEuro,
  ChartSpline,
  Database,
  HandCoins,
  History,
  LayoutDashboard,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { KpiView } from "@/lib/kpi-views";
import { cn } from "@/lib/utils";

const items: Array<{ id: KpiView; label: string; icon: typeof LayoutDashboard }> = [
  { id: "ceo", label: "Vue d’ensemble", icon: LayoutDashboard },
  { id: "growth", label: "Croissance", icon: TrendingUp },
  { id: "economics", label: "Économie & risque", icon: BadgeEuro },
  { id: "forecast", label: "Prévisions", icon: ChartSpline },
  { id: "acquisition", label: "Acquisition", icon: Target },
  { id: "cash", label: "Cash", icon: WalletCards },
  { id: "remuneration", label: "Redevances", icon: HandCoins },
  { id: "history", label: "Historique", icon: History },
  { id: "data", label: "Données", icon: Database },
];

export function KpiViewTabs({
  value,
  onChange,
}: {
  value: KpiView;
  onChange: (value: KpiView) => void;
}) {
  return (
    <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-border/45 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(item => {
        const Icon = item.icon;
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground",
              active && "text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            {item.label}
            {active ? <span className="absolute inset-x-2 -bottom-px h-px bg-foreground" /> : null}
          </button>
        );
      })}
    </div>
  );
}
