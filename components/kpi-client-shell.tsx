"use client"

import { useState } from "react"
import { KpiAppSidebar } from "@/components/kpi-app-sidebar"
import { KpiSiteHeader } from "@/components/kpi-site-header"
import { KpiWorkspace } from "@/components/kpi-workspace"
import type { KpiView } from "@/lib/kpi-views"

export function KpiClientShell({
  email,
  role,
}: {
  email?: string
  role: "admin" | "member" | "commercial"
}) {
  const [view, setView] = useState<KpiView>("ceo")

  return (
    <main className="app-bg min-h-screen pl-[72px] lg:pl-[224px]">
      <div className="animate-fade-in fixed inset-y-0 left-0 z-30">
        <KpiAppSidebar email={email} role={role} view={view} onViewChange={setView} />
      </div>
      <section className="page-shell min-h-screen bg-background">
        <KpiSiteHeader view={view} />
        <div className="min-w-0">
          <KpiWorkspace view={view} canEdit={role !== "commercial"} />
        </div>
      </section>
    </main>
  )
}
