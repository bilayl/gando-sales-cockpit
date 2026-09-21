"use client";

import type { CSSProperties, ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { GlobalPhoneDialer } from "@/components/global-phone-dialer";
import { PageTransition } from "@/components/page-transition";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { CockpitRole } from "@/components/cockpit-sidebar-shared";
import { useUIStore } from "@/stores/ui-store";

export function DashboardLayout({
  children,
  email,
  role,
  canAccessKpi,
  canAccessDealRoom,
}: {
  children: ReactNode;
  email?: string;
  role: CockpitRole;
  canAccessKpi: boolean;
  canAccessDealRoom: boolean;
}) {
  const sidebarCollapsed = useUIStore(state => state.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore(state => state.setSidebarCollapsed);

  return (
    <SidebarProvider
      open={!sidebarCollapsed}
      onOpenChange={open => setSidebarCollapsed(!open)}
      style={
        {
          "--sidebar-width": "15.5rem",
          "--sidebar-width-icon": "3.75rem",
        } as CSSProperties
      }
    >
      <AppSidebar
        email={email}
        role={role}
        canAccessKpi={canAccessKpi}
        canAccessDealRoom={canAccessDealRoom}
      />
      <SidebarInset className="cockpit-shell min-h-svh min-w-0 bg-background text-foreground">
        <DashboardHeader />
        <PageTransition>{children}</PageTransition>
        <GlobalPhoneDialer />
      </SidebarInset>
    </SidebarProvider>
  );
}
