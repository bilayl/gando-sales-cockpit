"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, PhoneCall, PhoneIncoming, PhoneOutgoing, RefreshCw, ExternalLink } from "lucide-react";
import { AircallCallButton } from "@/components/aircall-call-button";

type AircallCall = {
  call_id: number;
  direction: string | null;
  external_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string | null;
  recording_url: string | null;
  agent_email: string | null;
  tags: string[];
};

function callDate(value: string | null) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date inconnue" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function duration(value: number | null) {
  const seconds = Math.max(0, Number(value || 0));
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}

export function AircallHistoryView({ compact = false, phone, limit = 80 }: { compact?: boolean; phone?: string; limit?: number }) {
  const [calls, setCalls] = useState<AircallCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (phone) params.set("phone", phone);
      const res = await fetch(`/api/aircall/history?${params.toString()}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Impossible de charger l’historique Aircall");
      setCalls(Array.isArray(body.items) ? body.items : []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Historique indisponible");
    } finally {
      setLoading(false);
    }
  }, [phone, limit]);

  useEffect(() => {
    void reload();
    const refresh = () => { void reload(); };
    window.addEventListener("gando:aircall-updated", refresh);
    return () => window.removeEventListener("gando:aircall-updated", refresh);
  }, [reload]);

  const stats = useMemo(() => ({
    total: calls.length,
    outbound: calls.filter(call => call.direction?.toLowerCase() === "outbound").length,
    duration: calls.reduce((sum, call) => sum + Number(call.duration_seconds || 0), 0),
  }), [calls]);

  return (
    <section className={compact ? "" : "page-content"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Aircall · CRM</div>
          <h2 className="mt-1 text-lg font-semibold">{phone ? "Historique Aircall du contact" : "Historique des appels Aircall"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Appels enregistrés à réception des événements Aircall. Les appels en cours ne sont pas encore comptabilisés.</p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs hover:bg-muted disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>
      {!phone && <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Appels synchronisés</div><div className="mt-2 text-xl font-semibold">{stats.total}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Appels sortants</div><div className="mt-2 text-xl font-semibold">{stats.outbound}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Durée totale</div><div className="mt-2 text-xl font-semibold">{duration(stats.duration)}</div></div>
      </div>}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {error ? <div className="border-b border-border px-4 py-4 text-sm text-destructive">{error}</div> : null}
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Chargement des appels Aircall…</div>
          : !calls.length ? <div className="p-8 text-center text-sm text-muted-foreground">Aucun appel Aircall synchronisé pour cette sélection.</div>
          : <div className="divide-y divide-border">
            {calls.map(call => {
              const outgoing = call.direction?.toLowerCase() === "outbound";
              const Icon = outgoing ? PhoneOutgoing : PhoneIncoming;
              return <div key={call.call_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><Icon size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{call.external_number || "Numéro masqué"}</span><span className="text-[10px] text-muted-foreground">{outgoing ? "Sortant" : "Entrant"} · {call.status || "Terminé"}</span></div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{callDate(call.started_at)}</span><Clock3 size={11} /><span>{duration(call.duration_seconds)}</span>{call.agent_email ? <span>· {call.agent_email}</span> : null}</div>
                  {call.tags?.length ? <div className="mt-1 text-[11px] text-muted-foreground">{call.tags.join(" · ")}</div> : null}
                </div>
                {call.external_number ? <AircallCallButton phone={call.external_number} label="Rappeler" className="h-8 bg-muted text-foreground hover:bg-accent" /> : null}
                {call.recording_url ? <a href={`/api/aircall/calls/${call.call_id}/recording`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs hover:bg-muted"><PhoneCall size={12} /> Écouter <ExternalLink size={11} /></a> : null}
              </div>;
            })}
          </div>}
      </div>
    </section>
  );
}
