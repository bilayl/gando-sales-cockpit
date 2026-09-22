"use client";

import type { CSSProperties, ReactNode } from "react";
import { KpiSidebar } from "@/components/kpi/kpi-sidebar";
import { PageTransition } from "@/components/page-transition";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { CockpitRole } from "@/components/cockpit-sidebar-shared";

export function KpiLayoutShell({
  children,
  email,
  role,
}: {
  children: ReactNode;
  email?: string;
  role: CockpitRole;
}) {
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "15.5rem",
          "--sidebar-width-icon": "3.75rem",
        } as CSSProperties
      }
    >
      <KpiSidebar email={email} role={role} />
      <SidebarInset className="min-h-svh min-w-0 bg-background text-foreground">
        <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b border-border/45 bg-background/90 px-3 backdrop-blur-xl md:hidden">
          <SidebarTrigger className="-ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" />
          <div className="h-4 w-px bg-border/70" />
          <span className="text-[13px] font-medium text-muted-foreground">KPI</span>
        </header>
        <main className="min-h-0 min-w-0 flex-1"><PageTransition>{children}</PageTransition></main>
      </SidebarInset>
    </SidebarProvider>
  );
}
