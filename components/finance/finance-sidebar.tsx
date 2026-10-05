"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  Calculator,
  ChartSpline,
  LayoutDashboard,
  PiggyBank,
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
  { href: "/finance#overview", label: "Vue d’ensemble", icon: LayoutDashboard },
  { href: "/finance#hypotheses", label: "Hypothèses BP", icon: Calculator },
  { href: "/finance#treasury", label: "Trésorerie", icon: PiggyBank },
  { href: "/finance#recruitment", label: "Recrutement", icon: BriefcaseBusiness },
  { href: "/finance#forecast", label: "Prévisionnel", icon: ChartSpline },
] as const;

export function FinanceSidebar({
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
        <CockpitSidebarHeader section="FINANCE" />
      </SidebarHeader>

      <SidebarContent className="gap-1 pt-1">
        <SidebarGroup className="px-2">
          <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40">
            Pilotage financier
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map(item => {
                const Icon = item.icon;
                const active = pathname === "/finance";
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active && item.href.endsWith("#overview")}
                      tooltip={item.label}
                      className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent/70 data-[active=true]:text-sidebar-foreground"
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
