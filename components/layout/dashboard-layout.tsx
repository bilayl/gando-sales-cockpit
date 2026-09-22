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
}: {
  children: ReactNode;
  email?: string;
  role: CockpitRole;
}) {
  const sidebarOpen = useUIStore(state => state.sidebarOpen);
  const setSidebarOpen = useUIStore(state => state.setSidebarOpen);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={
        {
          "--sidebar-width": "15.5rem",
          "--sidebar-width-icon": "3.75rem",
        } as CSSProperties
      }
    >
      <AppSidebar email={email} role={role} />
      <SidebarInset className="min-h-svh min-w-0 bg-background text-foreground">
        <DashboardHeader />
        <main className="min-h-0 min-w-0 flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
        <GlobalPhoneDialer />
      </SidebarInset>
    </SidebarProvider>
  );
}
