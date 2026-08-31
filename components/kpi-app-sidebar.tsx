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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/kpi-shadcn/ui/sidebar"
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
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Gando KPI">
              <Link href="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <PanelTop className="size-4" />
                </span>
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Gando KPI</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">Business dashboard</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pilotage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((item, index) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={index === 0} tooltip={item.label}>
                      <a href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Données</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="mx-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Database className="size-3.5 text-sidebar-primary" />
                Calcul automatique
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-sidebar-foreground/60">
                CA, TDV, cautions, MAU, take rate, ARPU, cash, marge et conversions.
              </p>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="h-auto py-2" tooltip={email || "Compte Gando"}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs font-semibold">
                  {(email || "G").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left text-xs leading-tight">
                <span className="truncate font-medium">{email || "Compte Gando"}</span>
                <span className="truncate text-[10px] text-sidebar-foreground/60">KPI business</span>
              </span>
              <span onClick={event => event.stopPropagation()}>
                <ThemeToggle />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
