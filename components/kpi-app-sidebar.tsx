"use client"

import { ChartNoAxesCombined, Gauge, History, Infinity, Network, PhoneCall, WalletCards } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import type { KpiView } from "@/lib/kpi-views"

const sections: Array<{ id: KpiView; label: string; icon: typeof Gauge }> = [
  { id: "lifetime", label: "Vue d’ensemble", icon: Infinity },
  { id: "system", label: "Système KPI", icon: Network },
  { id: "calls", label: "Appels du jour", icon: PhoneCall },
  { id: "costs", label: "Cost Control", icon: WalletCards },
  { id: "overview", label: "Dernier mois", icon: Gauge },
  { id: "funnel", label: "Funnel & économie", icon: ChartNoAxesCombined },
  { id: "history", label: "Mensuel & projection", icon: History },
]

const ROLE_LABEL: Record<"admin" | "member" | "commercial", string> = {
  admin: "Administrateur",
  member: "Membre",
  commercial: "Commercial",
}

export function KpiAppSidebar({
  email,
  role,
  view,
  onViewChange,
}: {
  email?: string
  role: "admin" | "member" | "commercial"
  view: KpiView
  onViewChange: (view: KpiView) => void
}) {
  return (
    <aside className="flex h-screen w-[72px] flex-col border-r border-border bg-card px-2.5 py-4 lg:w-[216px] lg:px-3">
      <button
        type="button"
        onClick={() => onViewChange("lifetime")}
        className="flex h-11 w-full items-center justify-center gap-2.5 px-1 text-left lg:justify-start lg:px-2"
      >
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg" aria-hidden="true">
          <svg viewBox="0 0 128 128" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <rect width="128" height="128" rx="28" fill="#CDDFFF" />
            <path d="M98.8479 81.2759C95.3613 88.4324 89.7153 94.3147 82.706 98.0931C75.6966 101.872 67.6776 103.356 59.7795 102.336C51.8811 101.317 44.5022 97.8459 38.6831 92.4119C32.8637 86.9779 28.8977 79.8554 27.344 72.0485C25.7903 64.2415 26.7273 56.144 30.0231 48.8979C33.3188 41.6516 38.807 35.622 45.7136 31.6592C52.6203 27.6965 60.5972 26.0004 68.5197 26.8102C76.4421 27.62 83.9105 30.8948 89.8717 36.1728L87.804 38.5059C84.1861 42.5879 77.934 42.7267 72.773 40.9575C70.9774 40.3419 69.1075 39.929 67.1975 39.7338C61.9821 39.2006 56.731 40.3172 52.1842 42.926C47.6377 45.5346 44.0247 49.5038 41.8552 54.274C39.6856 59.0443 39.0687 64.3748 40.0916 69.5139C41.1143 74.6533 43.7252 79.342 47.5561 82.9192C51.3868 86.4964 56.2443 88.7815 61.4437 89.4526C66.643 90.1234 71.922 89.1465 76.5362 86.659C78.2261 85.7482 79.7955 83.6513 81.2188 83.3957C85.3096 79.7873 91.139 77.5239 96.0444 79.9115L98.8479 81.2759Z" fill="#19324D" />
            <path d="M58.7457 70.2185C65.9074 65.8701 74.6138 63.9597 83.2509 64.8414C89.7683 65.5067 95.9122 67.7276 101.047 71.2166C103.606 72.9549 102.959 76.3178 100.113 77.6647C96.2643 73.9283 88.7754 73.899 83.6102 75.2809C80.5881 76.2958 76.5579 78.9089 73.3011 81.6975C70.7982 83.8406 66.7866 84.4307 64.2231 82.3437C59.6547 78.624 54.1802 72.9909 58.7457 70.2185Z" fill="#19324D" />
          </svg>
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block text-sm font-bold tracking-[-0.02em]">Gando</span>
          <span className="block text-[9px] font-bold uppercase tracking-[0.17em] text-muted-foreground">Cockpit · KPI</span>
        </span>
      </button>

      <div className="my-4 border-t border-border" />

      <nav className="min-h-0 flex-1 overflow-y-auto minari-scrollbar" aria-label="Navigation KPI">
        <div className="mb-1 hidden px-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70 lg:block">
          Pilotage
        </div>
        <div className="space-y-1">
          {sections.map(({ id, label, icon: Icon }) => {
            const active = view === id
            return (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => onViewChange(id)}
                className={cn(
                  "group flex h-10 w-full items-center justify-center gap-3 rounded-lg px-2.5 text-sm font-semibold transition-colors lg:justify-start",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className={cn("grid h-5 w-5 place-items-center", active && "text-primary")}>
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span className="hidden truncate lg:block">{label}</span>
                {active ? <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-primary lg:block" /> : null}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="mt-3 border-t border-border pt-3">
        <div className="rounded-lg bg-muted/70 p-2">
          <div className="flex items-center justify-center gap-2.5 lg:justify-start">
            <Avatar className="h-7 w-7 shrink-0 border border-border">
              <AvatarFallback className="bg-card text-[11px] font-bold text-primary">
                {(email || "G").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 flex-1 lg:block">
              <div className="truncate text-[11px] font-semibold text-foreground">{email || "Compte Gando"}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {ROLE_LABEL[role]}
              </div>
            </div>
            <div className="hidden lg:block"><ThemeToggle /></div>
          </div>
        </div>
      </div>
    </aside>
  )
}
