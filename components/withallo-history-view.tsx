"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, PhoneIncoming, PhoneOutgoing, RefreshCw, Sparkles } from "lucide-react";
import { WithAlloCallButton } from "@/components/withallo-call-button";
import Link from "next/link";
import { WithAlloRecordingPlayer } from "@/components/withallo-recording-player";

type Call = {
  id: string;
  startedAt: string | null;
  direction: string | null;
  status: string | null;
  from: string | null;
  to: string | null;
  externalNumber: string | null;
  durationSeconds: number | null;
  ownerEmail: string | null;
  summary: string | null;
  transcript: string | null;
  recordingAvailable: boolean;
};

function dateText(value: string | null) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "Date inconnue" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function duration(value: number | null) {
  const seconds = Math.max(0, Number(value || 0));
  return Math.floor(seconds / 60) + " min " + String(seconds % 60).padStart(2, "0") + " s";
}

export function WithAlloHistoryView({ compact = false, phone, limit = 80 }: { compact?: boolean; phone?: string; limit?: number }) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordingsOnly, setRecordingsOnly] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (phone) params.set("phone", phone);
      const response = await fetch("/api/withallo/history?" + params.toString(), { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Historique Allo indisponible");
      setCalls(Array.isArray(body.items) ? body.items : []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de consulter les appels Allo.");
    } finally {
      setLoading(false);
    }
  }, [phone, limit]);

  useEffect(() => {
    void reload();
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const onCallEnded = () => {
      // Allo may publish AI summaries a short time after hang-up.
      timeouts.push(setTimeout(() => void reload(), 7000));
      timeouts.push(setTimeout(() => void reload(), 35000));
    };
    window.addEventListener("gando:withallo-call-ended", onCallEnded);
    return () => {
      window.removeEventListener("gando:withallo-call-ended", onCallEnded);
      timeouts.forEach(clearTimeout);
    };
  }, [reload]);

  const filteredCalls = useMemo(() => recordingsOnly ? calls.filter(call => call.recordingAvailable || (call.status === "ANSWERED" && /^cll[-_]/.test(call.id))) : calls, [calls, recordingsOnly]);

  const stats = useMemo(() => ({
    total: calls.length,
    outbound: calls.filter(call => /outbound|outgoing|sortant/i.test(call.direction || "")).length,
    duration: calls.reduce((sum, call) => sum + Number(call.durationSeconds || 0), 0),
  }), [calls]);

  return (
    <section className={compact ? "" : "page-content"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Allo · CRM Gando</div>
          <h2 className="mt-1 text-lg font-semibold">{phone ? "Appels Allo du contact" : "Historique des appels Allo"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Appels, enregistrements, synthèses et transcriptions récupérés directement depuis Allo. Les fichiers audio ne sont pas rendus publics.</p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs hover:bg-muted disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser</button>
      </div>
      {!phone ? <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Appels affichés</div><div className="mt-2 text-xl font-semibold">{stats.total}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Sortants</div><div className="mt-2 text-xl font-semibold">{stats.outbound}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">Durée cumulée</div><div className="mt-2 text-xl font-semibold">{duration(stats.duration)}</div></div>
      </div> : null}
      <div className="mb-3 flex items-center justify-between gap-2"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium"><input type="checkbox" checked={recordingsOnly} onChange={event => setRecordingsOnly(event.target.checked)} /> Afficher les appels enregistrés</label><span className="text-[11px] text-muted-foreground">{filteredCalls.length} appel(s) affiché(s)</span></div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {error ? <div className="border-b border-destructive/30 px-4 py-4 text-sm text-destructive">{error}</div> : null}
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Chargement de l’historique Allo…</div> :
          !filteredCalls.length ? <div className="p-8 text-center text-sm text-muted-foreground">Aucun appel correspondant. Actualisez après la fin de l’appel, ou vérifiez les permissions de lecture Allo.</div> :
          <div className="divide-y divide-border">
            {filteredCalls.map(call => {
              const outgoing = /outbound|outgoing|sortant/i.test(call.direction || "");
              const Icon = outgoing ? PhoneOutgoing : PhoneIncoming;
              return <div key={call.id} className="flex flex-wrap items-start gap-3 px-4 py-4">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><Icon size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{call.externalNumber || call.to || call.from || "Numéro masqué"}</span><span className="text-[10px] text-muted-foreground">{outgoing ? "Sortant" : "Entrant"} · {call.status || "Appel"}</span></div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{dateText(call.startedAt)}</span><Clock3 size={11}/><span>{duration(call.durationSeconds)}</span>{call.ownerEmail ? <span>· {call.ownerEmail}</span> : null}</div>
                  {call.summary ? <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5"><div className="mb-1 flex items-center gap-1 font-semibold"><Sparkles size={12} /> Résumé IA Allo</div><div className="whitespace-pre-wrap">{call.summary}</div></div> : null}
                  {call.transcript ? <details className="mt-2 rounded-lg border border-border"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold">Lire la transcription</summary><div className="max-h-72 overflow-auto border-t border-border p-3 whitespace-pre-wrap text-xs leading-5">{call.transcript}</div></details> : null}
                  {(call.recordingAvailable || (call.status === "ANSWERED" && /^cll[-_]/.test(call.id))) ? <WithAlloRecordingPlayer callId={call.id} /> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2"><Link href={"/phone?call=" + encodeURIComponent(call.id)} className="inline-flex h-8 items-center rounded-lg border border-border px-2 text-xs font-semibold hover:bg-muted">Détails</Link>{call.externalNumber ? <WithAlloCallButton phone={call.externalNumber} label="Rappeler" className="h-8 bg-muted text-foreground hover:bg-accent" /> : null}</div>
              </div>;
            })}
          </div>
        }
      </div>
    </section>
  );
}
