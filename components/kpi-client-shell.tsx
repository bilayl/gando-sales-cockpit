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
      className="bg-[#f5f5f6]"
      style={
        {
          "--sidebar-width": "14.75rem",
          "--header-height": "2.875rem",
          "--radius": "0.5rem",
          "--background": "#ffffff",
          "--foreground": "#25262a",
          "--card": "#ffffff",
          "--card-foreground": "#25262a",
          "--popover": "#ffffff",
          "--popover-foreground": "#25262a",
          "--primary": "#735DF3",
          "--primary-foreground": "#ffffff",
          "--secondary": "#f5f5f6",
          "--secondary-foreground": "#333438",
          "--muted": "#f6f6f7",
          "--muted-foreground": "#777981",
          "--accent": "#efeff1",
          "--accent-foreground": "#2c2d31",
          "--border": "#e6e6e8",
          "--input": "#dddddf",
          "--ring": "#735DF3",
          "--sidebar": "#f5f5f6",
          "--sidebar-foreground": "#37383d",
          "--sidebar-primary": "#735DF3",
          "--sidebar-primary-foreground": "#ffffff",
          "--sidebar-accent": "#eaeaed",
          "--sidebar-accent-foreground": "#222328",
          "--sidebar-border": "#e1e1e4",
          "--sidebar-ring": "#735DF3",
          "--chart-1": "#735DF3",
        } as React.CSSProperties
      }
    >
      <KpiAppSidebar email={email} role={role} view={view} onViewChange={setView} />
      <SidebarInset className="min-w-0 overflow-hidden bg-background shadow-none md:peer-data-[variant=inset]:m-1.5 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-[10px] md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-border md:peer-data-[variant=inset]:shadow-none">
        <KpiSiteHeader view={view} />
        <div className="@container/main flex min-w-0 flex-1 flex-col bg-background">
          <KpiWorkspace view={view} canEdit={role !== "commercial"} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
