"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  LayoutDashboard,
  Palette,
  PanelTop,
  UsersRound,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

type Role = "admin" | "member" | "commercial"

const items = [
  { href: "/kpi", label: "Dashboard KPI", icon: LayoutDashboard },
  { href: "/prospection", label: "CRM", icon: UsersRound },
  { href: "/deal-room", label: "Deal Room", icon: BriefcaseBusiness },
  { href: "/design", label: "Design", icon: Palette },
  { href: "/brand", label: "Brand Book", icon: BookOpen },
]

export function KpiAppSidebar({ email, role }: { email?: string; role: Role }) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-svh w-[var(--sidebar-width,18rem)] shrink-0 flex-col px-3 py-3 lg:flex">
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
        <Link href="/" className="flex h-[var(--header-height,3rem)] items-center gap-3 border-b border-border px-4">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PanelTop className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight">Gando</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cockpit · KPI</div>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 p-3">
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Produits</div>
          {items.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
            if (item.href === "/deal-room" && role === "commercial") return null
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="text-xs font-bold">{(email || "G").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{email || "Compte Gando"}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <BarChart3 className="h-3 w-3" /> Business analytics
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  )
}
