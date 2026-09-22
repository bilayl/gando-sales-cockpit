"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import {
  CockpitSidebarHeader,
  CockpitSidebarUser,
  type CockpitRole,
} from "@/components/cockpit-sidebar-shared";

const items = [
  { href: "/kpi", label: "Vue d’ensemble", icon: LayoutDashboard },
  { href: "/kpi/growth", label: "Croissance", icon: TrendingUp },
  { href: "/kpi/economics", label: "Économie & risque", icon: BadgeEuro },
  { href: "/kpi/forecast", label: "Prévisions", icon: ChartSpline },
  { href: "/kpi/acquisition", label: "Acquisition", icon: Target },
  { href: "/kpi/cash", label: "Cash & coûts", icon: WalletCards },
  { href: "/kpi/remuneration", label: "Redevances", icon: HandCoins },
  { href: "/kpi/history", label: "Historique", icon: History },
  { href: "/kpi/data", label: "Données", icon: Database },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/kpi") return pathname === "/kpi";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function KpiSidebar({
  email,
  role,
}: {
  email?: string;
  role: CockpitRole;
}) {
  const pathname = usePathname();

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
                const active = isActive(pathname, item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent/70 data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-none"
                    >
                      <Link href={item.href}>
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
