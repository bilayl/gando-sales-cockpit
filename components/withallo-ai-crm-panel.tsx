"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Clipboard, ExternalLink, FileText, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Kind = "contact" | "company";
type Action = { text: string; dueAt: string | null };
type Insight = {
  id: string;
  title: string;
  startedAt: string | null;
  contactName: string | null;
  contactNumber: string;
  memberEmail: string | null;
  summary: string | null;
  transcriptText: string | null;
  actions: Action[];
};
type Payload = { calls: Insight[]; scanned: number; linkedPhones: number; limited: boolean };

function dateLabel(raw: string | null) {
  if (!raw || Number.isNaN(Date.parse(raw))) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw));
}
function nextDayAtTen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}
function dateInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") +
    "T" + [pad(date.getHours()), pad(date.getMinutes())].join(":");
}

function followupHref(kind: Kind, recordId: string, call: Insight, action: Action, index: number, team: "AE" | "CSM") {
  const params = new URLSearchParams();
  params.set(kind === "contact" ? "contactId" : "companyId", recordId);
  params.set("team", team);
  // Keep the AI summary and conversation contents out of browser URLs.
  // The follow-up screen retrieves the authorized action from Allo by call ID.
  params.set("alloCall", call.id);
  params.set("actionIndex", String(index));
  const sourceDue = action.dueAt ? new Date(action.dueAt) : null;
  const due = sourceDue && Number.isFinite(sourceDue.getTime()) && sourceDue.getTime() > Date.now()
    ? sourceDue : nextDayAtTen();
  params.set("due", dateInput(due));
  return "/relances?" + params.toString();
}

export function WithAlloAiCrmPanel({
  kind, recordId, compact = false, preferredTeam = "AE", onExpand,
}: {
  kind: Kind;
  recordId: string;
  compact?: boolean;
  preferredTeam?: "AE" | "CSM";
  onExpand?: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState<"AE" | "CSM">(preferredTeam);
  const [copied, setCopied] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ kind, id: recordId });
      const response = await fetch("/api/withallo/ai/crm?" + params.toString(), { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Analyses Allo indisponibles.");
      setData(payload as Payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les analyses Allo.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [kind, recordId]);

  useEffect(() => {
    void reload();
    // Allo may produce summaries after hang-up.
    const callbacks: ReturnType<typeof setTimeout>[] = [];
    const onEnd = () => {
      callbacks.push(setTimeout(() => void reload(), 8_000));
      callbacks.push(setTimeout(() => void reload(), 35_000));
    };
    window.addEventListener("gando:withallo-call-ended", onEnd);
    return () => { window.removeEventListener("gando:withallo-call-ended", onEnd); callbacks.forEach(clearTimeout); };
  }, [reload]);

  useEffect(() => { setTeam(preferredTeam); }, [preferredTeam]);

  const rows = useMemo(() => {
    const items = data?.calls || [];
    const matching = query.trim().toLowerCase();
    const filtered = matching ? items.filter(call =>
      [call.title, call.contactName, call.summary, call.transcriptText,
        ...call.actions.map(action => action.text)].filter(Boolean).join(" ").toLowerCase().includes(matching),
    ) : items;
    return compact ? filtered.slice(0, 1) : filtered;
  }, [data, compact, query]);

  async function copyText(key: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(key);
    } catch { setCopied(""); }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-primary"/> IA Allo · Synthèses d'appels</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Analyses réelles fournies par Allo, rapprochées des numéros de cette fiche CRM.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""}/> Actualiser
          </Button>
          {compact && onExpand ? <button type="button" onClick={onExpand} className="text-xs font-semibold text-primary hover:underline">Détails</button> : null}
        </div>
      </header>
      {!compact ? <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground"/>
          <input aria-label="Rechercher dans les résumés et transcriptions Allo" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Rechercher dans les appels…" className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"/>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Relances proposées pour
          <select aria-label="Équipe pour les relances proposées" value={team} onChange={event => setTeam(event.target.value as "AE" | "CSM")}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground">
            <option value="AE">AE</option><option value="CSM">CSM</option>
          </select>
        </label>
      </div> : null}
      {error ? <p role="alert" className="m-4 rounded-lg border border-destructive/30 p-3 text-xs text-destructive">{error}</p> : null}
      {loading ? <div className="flex items-center justify-center gap-2 p-8 text-xs text-muted-foreground"><Loader2 className="animate-spin" size={16}/> Recherche des analyses Allo…</div> :
        !data?.linkedPhones ? <div className="p-6 text-xs text-muted-foreground">Aucun numéro de téléphone exploitable sur cette fiche ou ses contacts associés. Ajoutez un numéro au CRM pour associer les analyses Allo.</div> :
        !rows.length ? <div className="p-6 text-xs text-muted-foreground">{query ? "Aucun résultat pour cette recherche." : "Aucun appel Allo correspondant dans l'historique consulté. Les analyses apparaissent une fois l'appel traité par Allo."}</div> : (
          <div className="divide-y divide-border/70">
            {rows.map(call => (
              <article key={call.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold">{call.title}</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">{dateLabel(call.startedAt)} · {call.contactName || call.contactNumber}{call.memberEmail ? " · " + call.memberEmail : ""}</p>
                  </div>
                  <Link href={"/phone?call=" + encodeURIComponent(call.id)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Appel complet <ExternalLink size={12}/>
                  </Link>
                </div>
                {call.summary ? (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles size={13}/> Compte rendu IA Allo</span>
                      <button type="button" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => void copyText(call.id, call.summary || "")}>
                        {copied === call.id ? <Check size={12}/> : <Clipboard size={12}/>}
                        {copied === call.id ? "Copié" : "Copier"}
                      </button>
                    </div>
                    <p className={"mt-2 whitespace-pre-wrap break-words text-xs leading-6 " + (compact ? "line-clamp-6" : "")}>{call.summary}</p>
                  </div>
                ) : <p className="text-xs text-muted-foreground">Compte rendu IA non encore disponible pour cet appel.</p>}
                {call.actions.length ? <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><CalendarClock size={13}/> Prochaines actions identifiées par Allo</p>
                  <div className="space-y-2">
                    {call.actions.slice(0, compact ? 2 : 12).map((action, index) => (
                      <div key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 p-2.5">
                        <span className="min-w-0 flex-1 break-words text-xs leading-5">{action.text}</span>
                        <Link href={followupHref(kind, recordId, call, action, index, compact ? preferredTeam : team)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/25 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/5">
                          <CalendarClock size={12}/> Préparer une relance
                        </Link>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">Aucune tâche n'est créée sans validation dans Relances.</p>
                </div> : null}
                {!compact && call.transcriptText ? <details className="rounded-lg border border-border">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold"><FileText size={13}/> Lire la transcription Allo</summary>
                  <div className="max-h-80 overflow-auto border-t border-border px-3 py-3 whitespace-pre-wrap break-words text-xs leading-6">{call.transcriptText}</div>
                </details> : null}
              </article>
            ))}
          </div>
        )}
      {data?.limited ? <p className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground">Historique limité aux 100 derniers appels disponibles : les échanges plus anciens peuvent ne pas apparaître ici.</p> : null}
      {!compact && data && !loading ? <div className="border-t border-border px-4 py-2.5 text-[10px] text-muted-foreground">
        {data.calls.length} appel(s) trouvé(s) · {data.linkedPhones} numéro(s) rapproché(s) · {data.scanned} appel(s) examinés.
        Les transcriptions ne sont pas une analyse nouvelle du Cockpit ; elles proviennent d'Allo.
      </div> : null}
    </section>
  );
}
