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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  CockpitSidebarHeader,
  CockpitSidebarUser,
  type CockpitRole,
} from "@/components/cockpit-sidebar-shared";
import type { KpiView } from "@/lib/kpi-views";

type Section = { id: KpiView; label: string; icon: typeof LayoutDashboard };
type Group = { label: string; items: Section[] };

const groups: Group[] = [
  {
    label: "Pilotage CEO",
    items: [
      { id: "ceo", label: "CEO Cockpit", icon: LayoutDashboard },
      { id: "growth", label: "Croissance & usage", icon: TrendingUp },
      { id: "economics", label: "Économie & risque", icon: BadgeEuro },
    ],
  },
  {
    label: "Planification",
    items: [{ id: "forecast", label: "Prévisions & scénarios", icon: ChartSpline }],
  },
  {
    label: "Go-to-market",
    items: [{ id: "acquisition", label: "Acquisition & CAC", icon: Target }],
  },
  {
    label: "Finance",
    items: [
      { id: "cash", label: "Cash & coûts", icon: WalletCards },
      { id: "remuneration", label: "Redevances partenaires", icon: HandCoins },
    ],
  },
  {
    label: "Contrôle",
    items: [
      { id: "history", label: "Historique réel", icon: History },
      { id: "data", label: "Qualité des données", icon: Database },
    ],
  },
];

export function KpiAppSidebar({
  email,
  role,
  view,
  onViewChange,
}: {
  email?: string;
  role: CockpitRole;
  view: KpiView;
  onViewChange: (view: KpiView) => void;
}) {
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <CockpitSidebarHeader section="KPI & pilotage" canAccessKpi />
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      type="button"
                      isActive={view === id}
                      tooltip={label}
                      onClick={() => onViewChange(id)}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <CockpitSidebarUser email={email} role={role} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
