"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, UsersRound } from "lucide-react";

type CrmSyncStatus = {
  configured: boolean;
  enabled: boolean;
  canSync: boolean;
  status: string;
  lastRunAt: string | null;
  lastError: string | null;
  contactsMapped: number;
  companiesMapped: number;
};
export function WithAlloCrmSyncPanel() {
  const [state, setState] = useState<CrmSyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/withallo/crm-sync", { cache: "no-store" });
      if (!response.ok) return;
      setState(await response.json());
    } catch { /* The call workspace remains usable when status cannot be read. */ }
  }
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function synchronize() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/withallo/crm-sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 40 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Synchronisation Allo impossible.");
      if (data.skipped) setMessage("Une synchronisation est déjà en cours.");
      else setMessage(`${data.changed ?? 0} fiches mises à jour · ${data.skipped ?? 0} ignorées · ${data.failed ?? 0} erreurs`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Synchronisation indisponible.");
    } finally {
      setBusy(false);
    }
  }
  if (!state) return null;
  return (
    <section aria-label="Synchronisation des fiches CRM vers Allo" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-semibold"><UsersRound size={14}/> Répertoire Gando → Allo</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {state.contactsMapped.toLocaleString("fr-FR")} contacts · {state.companiesMapped.toLocaleString("fr-FR")} entreprises synchronisés
          {state.lastRunAt ? ` · Dernier passage : ${new Date(state.lastRunAt).toLocaleString("fr-FR")}` : ""}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {!state.configured ? "Clé API Allo absente." :
            state.enabled ? "Synchronisation automatique activée" : "Synchronisation automatique à activer dans la configuration du serveur"}
        </p>
        {state.lastError ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{state.lastError}</p> : null}
        {error ? <p role="alert" className="mt-1 text-xs text-destructive">{error}</p> : null}
        {message ? <p role="status" className="mt-1 text-xs text-foreground">{message}</p> : null}
      </div>
      {state.canSync ? (
        <button type="button" onClick={() => void synchronize()} disabled={busy || !state.configured}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin"/> : <RefreshCw size={13}/>}
          Synchroniser 40 fiches
        </button>
      ) : null}
    </section>
  );
}
