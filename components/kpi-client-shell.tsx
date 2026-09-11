"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { KpiAppSidebar } from "@/components/kpi-app-sidebar"
import { KpiSiteHeader } from "@/components/kpi-site-header"
import { KpiWorkspace } from "@/components/kpi-workspace"
import type { KpiView } from "@/lib/kpi-views"

const AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000

const CONTINUOUS_TABLES = [
  "public.accounts",
  "public.clients",
  "public.users",
  "public.deposits",
  "public.client_operations",
  "public.fees",
  "public.captures",
  "public.guarantee_activations",
  "public.psp_transactions",
  "public.payments",
]

type SyncStatus = "idle" | "syncing" | "fresh" | "error"

export function KpiClientShell({
  email,
  role,
}: {
  email?: string
  role: "admin" | "member" | "commercial"
}) {
  const [view, setView] = useState<KpiView>("ceo")
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const syncInFlight = useRef(false)
  const lastRefreshAt = useRef(0)

  const refreshDashboard = useCallback(() => {
    setRefreshKey(value => value + 1)
  }, [])

  const syncNow = useCallback(async () => {
    if (role !== "admin") {
      refreshDashboard()
      return
    }
    if (syncInFlight.current) return

    syncInFlight.current = true
    setSyncStatus("syncing")
    try {
      const response = await fetch("/api/system/supabase-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: CONTINUOUS_TABLES }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Synchronisation Gando incomplète")
      }

      setLastSyncedAt(body?.completedAt || new Date().toISOString())
      setSyncStatus("fresh")
      refreshDashboard()
    } catch (error) {
      console.error("KPI automatic Gando sync failed", error)
      setSyncStatus("error")
    } finally {
      syncInFlight.current = false
    }
  }, [refreshDashboard, role])

  const runRefresh = useCallback(() => {
    lastRefreshAt.current = Date.now()
    void syncNow()
  }, [syncNow])

  useEffect(() => {
    runRefresh()

    const refreshTimer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefreshAt.current >= AUTO_REFRESH_INTERVAL_MS
      ) {
        runRefresh()
      }
    }, AUTO_REFRESH_INTERVAL_MS)

    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefreshAt.current >= AUTO_REFRESH_INTERVAL_MS
      ) {
        runRefresh()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      window.clearInterval(refreshTimer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [runRefresh])

  return (
    <main className="app-bg min-h-screen pl-[72px] lg:pl-[224px]">
      <div className="animate-fade-in fixed inset-y-0 left-0 z-30">
        <KpiAppSidebar email={email} role={role} view={view} onViewChange={setView} />
      </div>
      <section className="page-shell min-h-screen bg-background">
        <KpiSiteHeader
          view={view}
          syncStatus={syncStatus}
          lastSyncedAt={lastSyncedAt}
          onRefresh={runRefresh}
        />
        <div className="min-w-0">
          <KpiWorkspace key={refreshKey} view={view} canEdit={role !== "commercial"} />
        </div>
      </section>
    </main>
  )
}
