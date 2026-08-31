"use client"

import Link from "next/link"
import {
  BarChart3,
  ChartNoAxesCombined,
  Database,
  Gauge,
  Landmark,
  PanelTop,
  Table2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"

const sections = [
  { href: "#kpi-dashboard", label: "Vue d’ensemble", icon: Gauge },
  { href: "#kpi-trajectory", label: "Trajectoire", icon: ChartNoAxesCombined },
  { href: "#kpi-funnel", label: "Funnel", icon: BarChart3 },
  { href: "#kpi-finance", label: "Finance & marge", icon: Landmark },
  { href: "#kpi-history", label: "Historique mensuel", icon: Table2 },
]

export function KpiAppSidebar({ email }: { email?: string; role: "admin" | "member" | "commercial" }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-[var(--sidebar-width,18rem)] shrink-0 flex-col px-3 py-3 lg:flex">
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
        <Link href="/" className="flex h-[var(--header-height,3rem)] items-center gap-3 border-b border-border px-4">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PanelTop className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight">Gando KPI</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Business dashboard</div>
          </div>
        </Link>

        <nav className="flex-1 p-3">
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Pilotage</div>
          <div className="space-y-1">
            {sections.map(item => {
              const Icon = item.icon
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              )
            })}
          </div>

          <div className="mt-6 mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Données</div>
          <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Database className="h-3.5 w-3.5 text-primary" /> Données calculées
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">CA, TDV, cautions, MAU, take rate, ARPU, cash, marge et conversions.</p>
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="text-xs font-bold">{(email || "G").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{email || "Compte Gando"}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">KPI business</div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  )
}
