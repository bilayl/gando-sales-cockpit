"use client"

import { ChartNoAxesCombined, Gauge, History, Infinity, MoonStar } from "lucide-react"
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

const sections: Array<{ id: KpiView; label: string; description: string; icon: typeof Gauge }> = [
  { id: "lifetime", label: "Vue d’ensemble", description: "Depuis le début", icon: Infinity },
  { id: "overview", label: "Dernier mois", description: "Performance actuelle", icon: Gauge },
  { id: "funnel", label: "Funnel & économie", description: "Acquisition → marge", icon: ChartNoAxesCombined },
  { id: "history", label: "Mensuel & projection", description: "Historique et simulation", icon: History },
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
    <Sidebar variant="inset" collapsible="icon" className="border-none">
      <SidebarHeader className="px-2.5 pb-2 pt-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Gando KPI"
              className="h-10 rounded-md px-1.5 hover:bg-sidebar-accent/70"
              onClick={() => onViewChange("lifetime")}
            >
              <GandoMark className="size-6" />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-semibold">Gando</span>
                <span className="truncate text-[10px] text-sidebar-foreground/45">KPI workspace</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-1">
        <SidebarGroup className="px-1 py-2">
          <SidebarGroupLabel className="h-7 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/40">
            Dashboards
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {sections.map(item => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={view === item.id}
                      tooltip={item.label}
                      onClick={() => onViewChange(item.id)}
                      className="h-8 rounded-md px-2 text-[13px] font-normal data-[active=true]:bg-white data-[active=true]:font-medium data-[active=true]:shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
                    >
                      <Icon className="size-3.5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-2">
        <div className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 group-data-[collapsible=icon]:justify-center">
          <Avatar className="size-7 shrink-0 rounded-md border border-sidebar-border bg-white">
            <AvatarFallback className="rounded-md bg-white text-[10px] font-semibold text-sidebar-foreground">
              {(email || "G").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-[11px] font-medium">{email || "Compte Gando"}</div>
            <div className="text-[10px] text-sidebar-foreground/45">{ROLE_LABEL[role]}</div>
          </div>
          <div className="group-data-[collapsible=icon]:hidden" title="Apparence">
            <span className="sr-only"><MoonStar className="size-3.5" /></span>
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
