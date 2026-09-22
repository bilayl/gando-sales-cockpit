"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
} from "@/components/ui/sidebar";
import { CockpitSidebarHeader, CockpitSidebarUser, type CockpitRole } from "@/components/cockpit-sidebar-shared";

const items = [
  { id: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
  { id: "growth", label: "Croissance", icon: TrendingUp },
  { id: "economics", label: "Économie & risque", icon: BadgeEuro },
  { id: "forecast", label: "Prévisions", icon: ChartSpline },
  { id: "acquisition", label: "Acquisition", icon: Target },
  { id: "cash", label: "Cash & coûts", icon: WalletCards },
  { id: "remuneration", label: "Redevances", icon: HandCoins },
  { id: "history", label: "Historique", icon: History },
  { id: "data", label: "Données", icon: Database },
] as const;

export function KpiSidebar({
  email,
  role,
}: {
  email?: string;
  role: CockpitRole;
}) {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const syncFromHash = () => setActive(window.location.hash.replace("#", "") || "overview");
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50 bg-sidebar">
      <SidebarHeader className="px-3 pb-2 pt-3">
        <CockpitSidebarHeader section="KPI" />
      </SidebarHeader>

      <SidebarContent className="gap-1 pt-1">
        <SidebarGroup className="px-2">
          <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40">
            Pilotage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map(item => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent/70 data-[active=true]:text-sidebar-foreground"
                    >
                      <Link href={`/kpi#${item.id}`} onClick={() => setActive(item.id)}>
                        <Icon className="size-[17px]" strokeWidth={1.8} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-3">
        <CockpitSidebarUser email={email} role={role} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
