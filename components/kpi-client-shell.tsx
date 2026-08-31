"use client"

import { useState } from "react"
import { KpiAppSidebar } from "@/components/kpi-app-sidebar"
import { KpiSiteHeader } from "@/components/kpi-site-header"
import { KpiWorkspace } from "@/components/kpi-workspace"
import { SidebarInset, SidebarProvider } from "@/components/kpi-shadcn/ui/sidebar"
import type { KpiView } from "@/lib/kpi-views"

export function KpiClientShell({
  email,
  role,
}: {
  email?: string
  role: "admin" | "member" | "commercial"
}) {
  const [view, setView] = useState<KpiView>("lifetime")

  return (
    <SidebarProvider
      className="bg-muted/40"
      style={
        {
          "--sidebar-width": "15.5rem",
          "--header-height": "3.5rem",
          "--primary": "#735DF3",
          "--ring": "#735DF3",
          "--sidebar-primary": "#735DF3",
          "--sidebar-primary-foreground": "#FFFFFF",
          "--chart-1": "#735DF3",
        } as React.CSSProperties
      }
    >
      <KpiAppSidebar email={email} role={role} view={view} onViewChange={setView} />
      <SidebarInset className="min-w-0 overflow-hidden border-border bg-background md:peer-data-[variant=inset]:border">
        <KpiSiteHeader view={view} />
        <div className="@container/main flex min-w-0 flex-1 flex-col">
          <KpiWorkspace view={view} canEdit={role !== "commercial"} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
