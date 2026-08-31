"use client"

import { ChartNoAxesCombined, Database, Gauge, History, Infinity } from "lucide-react"
import { GandoMark } from "@/components/gando-mark"
import { Avatar, AvatarFallback } from "@/components/kpi-shadcn/ui/avatar"
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
import type { KpiView } from "@/lib/kpi-views"

const sections: Array<{ id: KpiView; label: string; icon: typeof Gauge }> = [
  { id: "lifetime", label: "Depuis le début", icon: Infinity },
  { id: "overview", label: "Dernier mois", icon: Gauge },
  { id: "funnel", label: "Funnel & économie", icon: ChartNoAxesCombined },
  { id: "history", label: "Mensuel & simulation", icon: History },
]

const ROLE_LABEL: Record<"admin" | "member" | "commercial", string> = {
  admin: "Admin",
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
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/70 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Gando KPI"
              className="h-11 px-1"
              onClick={() => onViewChange("lifetime")}
            >
              <GandoMark className="size-8" />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Gando KPI</span>
                <span className="truncate text-[11px] text-sidebar-foreground/55">Business dashboard</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pilotage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map(item => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={view === item.id}
                      tooltip={item.label}
                      onClick={() => onViewChange(item.id)}
                    >
                      <Icon />
                      <span>{item.label}</span>
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
            <div className="mx-2 rounded-lg border border-sidebar-border bg-sidebar-accent/45 p-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Database className="size-3.5 text-sidebar-primary" />
                Calcul automatique
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-sidebar-foreground/55">
                Les ratios sont recalculés depuis les données business renseignées.
              </p>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-3">
        <div className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 group-data-[collapsible=icon]:justify-center">
          <Avatar className="size-8 shrink-0 rounded-lg">
            <AvatarFallback className="rounded-lg text-xs font-semibold">
              {(email || "G").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs font-medium">{email || "Compte Gando"}</div>
            <div className="text-[10px] text-sidebar-foreground/55">{ROLE_LABEL[role]}</div>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
