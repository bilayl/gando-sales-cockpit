"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KpiWorkspace } from "@/components/kpi-workspace";
import { PageHeader } from "@/components/cockpit/page-header";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/query/query-keys";

const AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
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
];

type SyncStatus = "idle" | "syncing" | "fresh" | "error";

function syncLabel(status: SyncStatus, lastSyncedAt: string | null) {
  if (status === "syncing") return "Synchronisation…";
  if (status === "error") return "Synchronisation à vérifier";
  if (!lastSyncedAt) return "Actualisation automatique";
  const date = new Date(lastSyncedAt);
  if (Number.isNaN(date.getTime())) return "Données à jour";
  return `À jour · ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date)}`;
}

export function KpiClientShell({
  role,
}: {
  email?: string;
  role: "admin" | "member" | "commercial";
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const lastRefreshAt = useRef(0);
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (role !== "admin") return { completedAt: new Date().toISOString() };
      const response = await fetch("/api/system/supabase-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: CONTINUOUS_TABLES }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Synchronisation Gando incomplète");
      }
      return body;
    },
    onMutate: () => setSyncStatus("syncing"),
    onSuccess: body => {
      setLastSyncedAt(body?.completedAt || new Date().toISOString());
      setSyncStatus("fresh");
      setRefreshKey(value => value + 1);
      void queryClient.invalidateQueries({ queryKey: queryKeys.kpi.all });
    },
    onError: () => setSyncStatus("error"),
  });

  function refresh() {
    lastRefreshAt.current = Date.now();
    syncMutation.mutate();
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAt.current >= AUTO_REFRESH_INTERVAL_MS) {
        refresh();
      }
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // Initialisation de la synchronisation automatique uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="KPI"
        title="Pilotage"
        description="Tous les indicateurs Gando réunis sur une seule page, du pilotage opérationnel aux prévisions et à la qualité des données."
        actions={
          <>
            <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              {syncStatus === "fresh" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
              {syncStatus === "error" ? <TriangleAlert className="h-3.5 w-3.5 text-amber-600" /> : null}
              {syncStatus === "syncing" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              {syncLabel(syncStatus, lastSyncedAt)}
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={refresh} disabled={syncMutation.isPending}>
              <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </>
        }
      />

      <div className="mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
        <KpiWorkspace key={refreshKey} canEdit={role !== "commercial"} />
      </div>
    </div>
  );
}
