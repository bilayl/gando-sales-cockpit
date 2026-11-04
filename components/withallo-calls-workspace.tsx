"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarClock, Check, ClipboardList, Clock3, Copy, Headphones, Loader2, PhoneCall, PhoneIncoming, PhoneOutgoing, RefreshCw, Search, Sparkles, UserRound, Users, X } from "lucide-react";
import { WithAlloRecordingPlayer } from "@/components/withallo-recording-player";
import { WithAlloCallButton } from "@/components/withallo-call-button";
import type { AlloCallDetailView } from "@/lib/withallo-call-detail";

type ListCall = {
  id: string;
  startedAt: string | null;
  direction: string | null;
  status: string | null;
  contactName?: string | null;
  title?: string | null;
  from: string | null;
  to: string | null;
  externalNumber: string | null;
  durationSeconds: number | null;
  ownerEmail: string | null;
  summary: string | null;
  transcript?: string | null;
  recordingAvailable: boolean;
};

type Tab = "summary" | "transcript" | "actions" | "agents";

const dateFmt = (text: string | null) => {
  const d = new Date(text || "");
  return Number.isNaN(d.getTime()) ? "Date inconnue" : new Intl.DateTimeFormat("fr-FR", { dateStyle:"medium",timeStyle:"short" }).format(d);
};
const durationFmt = (raw: number | null) => {
  const n = Math.max(0, Number(raw || 0));
  return n >= 60 ? Math.floor(n / 60) + " min " + String(n % 60).padStart(2, "0") + " s" : Math.round(n) + " s";
};
const isOutbound = (v: string | null) => /outgoing|outbound|sortant/i.test(v || "");
const displayCall = (call: ListCall) => call.title || call.contactName || call.externalNumber || "Appel Allo";
const actionLine = (s: string) => s.trim().replace(/^\s*[-*•]\s*/, "");

function SummaryContent({ text }: { text: string }) {
  return (
    <div className="space-y-1 break-words text-sm leading-7 text-foreground/90">
      {text.split("\n").slice(0, 500).map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} className="h-2"/>;
        if (/^#{1,6}\s/.test(line)) return <h3 key={i} className="pt-3 text-base font-semibold">{line.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "")}</h3>;
        if (/^([-*•]|\d+\.)\s+/.test(line)) return <p key={i} className="pl-4 before:mr-2 before:content-['•']">{actionLine(line).replace(/^\d+\.\s*/, "").replace(/\*\*/g,"")}</p>;
        return <p key={i} className="whitespace-pre-wrap">{line.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

function CallDetails({ call, loading, error, onRefresh }: {
  call: AlloCallDetailView | null; loading: boolean; error: string; onRefresh: () => void;
}) {
  const [tab, setTab] = useState<Tab>("summary");
  const [copied, setCopied] = useState(false);

  useEffect(() => { setTab("summary"); setCopied(false); }, [call?.id]);

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(true); }
    catch { setCopied(false); }
  };

  if (loading) return <div className="grid min-h-[450px] place-items-center rounded-xl border border-border bg-card"><div className="text-center text-sm text-muted-foreground"><Loader2 size={24} className="mx-auto mb-3 animate-spin" />Chargement de la conversation Allo…</div></div>;
  if (error) return <div className="rounded-xl border border-destructive/25 bg-card p-6"><p role="alert" className="text-sm text-destructive">{error}</p><button type="button" onClick={onRefresh} className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Réessayer</button></div>;
  if (!call) return <div className="grid min-h-[450px] place-items-center rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Sélectionnez un appel pour consulter son résumé, son enregistrement et les actions.</div>;

  const tabDefs: { id: Tab; text: string; icon: typeof Sparkles; count?: number }[] = [
    { id:"summary", text:"Résumé", icon:Sparkles },
    { id:"transcript", text:"Transcription", icon:ClipboardList },
    { id:"actions", text:"Actions", icon:Check, count:call.actions.length },
    { id:"agents", text:"Agents", icon:Users, count:call.agents.length },
  ];
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-5 pb-5 pt-6 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2"><CalendarClock size={14}/>{dateFmt(call.startedAt)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 size={14}/>{durationFmt(call.durationSeconds)}</span>
        </div>
        <h2 className="mt-3 break-words text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl">{call.title}</h2>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-[105px_1fr]">
          <span className="flex items-center gap-2 text-muted-foreground"><UserRound size={16}/> Membre</span>
          <span className="font-medium">{call.memberName || call.memberEmail || "Non renseigné"}</span>
          <span className="flex items-center gap-2 text-muted-foreground"><PhoneCall size={16}/> Contact</span>
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{call.contactName || "Contact non identifié"}</span>
            {call.contactNumber ? <span className="text-xs text-muted-foreground">{call.contactNumber}</span> : null}
            {call.contactNumber ? <WithAlloCallButton phone={call.contactNumber} label="Rappeler" className="h-7 px-2 text-[11px]" /> : null}
          </div>
          <span className="text-muted-foreground">Tags</span>
          <div className="flex flex-wrap gap-1.5">{call.tags.length ? call.tags.map(tag => <span key={tag} className="rounded-lg bg-muted px-2.5 py-1 text-xs">{tag}</span>) : <span className="rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">Non défini</span>}</div>
        </div>
        <section className="mt-5 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between"><div className="inline-flex items-center gap-2 text-sm font-semibold"><Headphones size={16}/> Enregistrement Allo</div><span className="text-[11px] text-muted-foreground">Audio privé</span></div>
          <WithAlloRecordingPlayer callId={call.id}/>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">La lecture est sécurisée par votre session Gando. Si aucun audio n’a été enregistré par Allo, le lecteur vous l’indiquera.</p>
        </section>
      </header>
      <nav role="tablist" aria-label="Détails de l’appel" className="flex overflow-x-auto gap-1 border-b border-border px-4 pt-3 sm:px-6">
        {tabDefs.map(item => {
          const Icon = item.icon;
          return <button type="button" key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setCopied(false); }}
            className={"inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition " + (tab === item.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon size={14}/>{item.text}{typeof item.count==="number" ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">{item.count}</span> : null}
          </button>;
        })}
      </nav>
      <div className="min-h-[280px] px-5 py-6 sm:px-7">
        {tab === "summary" ? (
          <section role="tabpanel">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold">Résumé de l’appel</h3>{call.summary ? <button type="button" onClick={() => void copy(call.summary || "")} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copié" : "Copier"}</button> : null}</div>
            {call.summary ? <SummaryContent text={call.summary} /> : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Allo n’a pas encore fourni de résumé pour cet appel. Il peut arriver après la fin du traitement IA.</p>}
          </section>
        ) : null}
        {tab === "transcript" ? (
          <section role="tabpanel">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold">Transcription</h3>{call.transcriptText ? <button type="button" onClick={() => void copy(call.transcriptText || "")} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copié" : "Copier"}</button> : null}</div>
            {call.transcript.length ? <div className="space-y-3">{call.transcript.map((line, i) => <div key={i} className="rounded-xl border border-border/60 bg-background/60 p-3.5"><div className="mb-1 flex items-center justify-between gap-3 text-xs"><strong>{line.speaker || "Intervenant"}</strong>{line.at ? <span className="text-muted-foreground">{line.at}</span> : null}</div><p className="whitespace-pre-wrap break-words text-sm leading-6">{line.text}</p></div>)}</div> :
              call.transcriptText ? <p className="whitespace-pre-wrap break-words text-sm leading-7">{call.transcriptText}</p> :
              <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Transcription indisponible dans Allo pour cet appel.</p>}
          </section>
        ) : null}
        {tab === "actions" ? (
          <section role="tabpanel">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Actions identifiées par Allo</h3><p className="mt-1 text-xs text-muted-foreground">Éléments extraits du compte rendu Allo, sans création automatique de tâches.</p></div>
              {call.actions.length ? <button type="button" onClick={() => void copy(call.actions.map(a=>"- "+a.text).join("\n"))} className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground hover:text-foreground">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copié" : "Copier"}</button> : null}
            </div>
            {call.actions.length ? <ol className="space-y-2">{call.actions.map((a,i) => <li key={i} className="flex gap-3 rounded-xl border border-border bg-background/60 p-3.5"><span className="grid size-6 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">{i+1}</span><div className="min-w-0"><p className="break-words text-sm leading-6">{a.text}</p>{a.assignedTo || a.dueAt ? <div className="mt-1 text-[11px] text-muted-foreground">{[a.assignedTo, a.dueAt ? dateFmt(a.dueAt) : null].filter(Boolean).join(" · ")}</div> : null}</div></li>)}</ol> :
              <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Allo n’a identifié aucune action explicite dans ce compte rendu. Aucune action n’a été ajoutée artificiellement.</p>}
            <a href="/tasks" className="mt-5 inline-flex rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Voir les tâches HubSpot</a>
          </section>
        ) : null}
        {tab === "agents" ? (
          <section role="tabpanel">
            <h3 className="mb-4 font-semibold">Intervenants identifiés</h3>
            {call.agents.length ? <div className="grid gap-3 sm:grid-cols-2">{call.agents.map((agent,i)=><div key={i} className="flex gap-3 rounded-xl border border-border bg-background/60 p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-sm font-semibold">{agent.name.slice(0,1).toUpperCase()}</span><div className="min-w-0"><p className="break-words text-sm font-semibold">{agent.name}</p><p className="mt-1 break-words text-xs text-muted-foreground">{[agent.role,agent.email].filter(Boolean).join(" · ") || "Allo"}</p></div></div>)}</div> :
              <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucun agent supplémentaire n’est identifié dans les données fournies par Allo.</p>}
          </section>
        ) : null}
      </div>
    </article>
  );
}

export function WithAlloCallsWorkspace() {
  const [calls,setCalls] = useState<ListCall[]>([]);
  const [selectedId,setSelectedId] = useState<string | null>(null);
  const [detail,setDetail] = useState<AlloCallDetailView | null>(null);
  const [loading,setLoading] = useState(true);
  const [detailLoading,setDetailLoading] = useState(false);
  const [error,setError] = useState("");
  const [detailError,setDetailError] = useState("");
  const [query,setQuery] = useState("");
  const [direction,setDirection] = useState<"all"|"in"|"out">("all");
  const [recordingsOnly,setRecordingsOnly] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);setError("");
    try {
      const response = await fetch("/api/withallo/history?limit=100",{cache:"no-store"});
      const body = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(body.error || "Impossible de récupérer les appels Allo.");
      const rows = Array.isArray(body.items) ? body.items : [];
      setCalls(rows);
      setSelectedId(current => {
        const fromUrl = new URLSearchParams(window.location.search).get("call");
        if (fromUrl && /^cll[-_][a-zA-Z0-9_-]{3,120}$/.test(fromUrl)) return fromUrl;
        if (current && rows.some((c:ListCall)=>c.id===current)) return current;
        return rows[0]?.id || null;
      });
    } catch (reason) {setError(reason instanceof Error ? reason.message : "Historique indisponible.");}
    finally {setLoading(false);}
  }, []);

  const loadDetail = useCallback(async (id:string) => {
    setDetailLoading(true);setDetailError("");setDetail(null);
    try {
      const response = await fetch("/api/withallo/calls/"+encodeURIComponent(id),{cache:"no-store"});
      const body = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(body.error || "Fiche Allo indisponible.");
      setDetail(body.call || null);
    } catch(reason){setDetailError(reason instanceof Error ? reason.message : "Impossible d’ouvrir l’appel.");}
    finally {setDetailLoading(false);}
  }, []);

  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{if(selectedId)void loadDetail(selectedId);else setDetail(null);},[selectedId,loadDetail]);
  useEffect(()=>{
    const onEnd=()=>{window.setTimeout(()=>void reload(),8000);window.setTimeout(()=>void reload(),35000);};
    const onPop=()=>setSelectedId(new URLSearchParams(window.location.search).get("call"));
    window.addEventListener("gando:withallo-call-ended",onEnd);
    window.addEventListener("popstate",onPop);
    return()=>{window.removeEventListener("gando:withallo-call-ended",onEnd);window.removeEventListener("popstate",onPop);};
  },[reload]);

  const selected=(id:string)=>{setSelectedId(id);window.history.replaceState(null,"","/phone?call="+encodeURIComponent(id));};
  const filtered=useMemo(()=>calls.filter(call=>{
    if(direction==="out" && !isOutbound(call.direction))return false;
    if(direction==="in" && isOutbound(call.direction))return false;
    if(recordingsOnly && !call.recordingAvailable)return false;
    const hay=[call.contactName,call.title,call.externalNumber,call.from,call.to,call.ownerEmail,call.summary,call.transcript].filter(Boolean).join(" ").toLocaleLowerCase("fr-FR");
    return !query || hay.includes(query.toLocaleLowerCase("fr-FR"));
  }),[calls,direction,query,recordingsOnly]);
  const outbound=calls.filter(call=>isOutbound(call.direction)).length;

  return <div className="page-shell"><div className="page-content space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Gando · Téléphonie</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Appels</h1><p className="mt-1 text-sm text-muted-foreground">Enregistrements, résumés IA, transcriptions et prochaines actions de votre équipe, synchronisés avec Allo.</p></div>
      <div className="flex flex-wrap items-center gap-2"><Link href="/phone/stats" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"><BarChart3 size={14}/> Statistiques</Link><button type="button" onClick={()=>void reload()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw size={14} className={loading?"animate-spin":""}/> Actualiser</button></div>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-3.5"><p className="text-[11px] text-muted-foreground">Appels récupérés</p><div className="mt-1 text-xl font-semibold">{calls.length}</div></div>
      <div className="rounded-xl border border-border bg-card p-3.5"><p className="text-[11px] text-muted-foreground">Sortants</p><div className="mt-1 text-xl font-semibold">{outbound}</div></div>
      <div className="col-span-2 rounded-xl border border-border bg-card p-3.5 sm:col-span-1"><p className="text-[11px] text-muted-foreground">Avec enregistrement détecté</p><div className="mt-1 text-xl font-semibold">{calls.filter(c=>c.recordingAvailable).length}</div></div>
    </div>
    {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">{error}</p> : null}
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)]">
      <aside className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="space-y-3 border-b border-border p-4">
          <div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un appel…" aria-label="Rechercher un appel" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"/>{query ? <button type="button" onClick={()=>setQuery("")} aria-label="Effacer la recherche" className="absolute right-2.5 top-3 text-muted-foreground"><X size={15}/></button>:null}</div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={direction} onChange={e=>setDirection(e.target.value as "all"|"in"|"out")} aria-label="Direction des appels" className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-xs"><option value="all">Tous les appels</option><option value="in">Entrants</option><option value="out">Sortants</option></select>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" checked={recordingsOnly} onChange={e=>setRecordingsOnly(e.target.checked)}/> Audio</label>
          </div>
        </div>
        <div className="max-h-[70vh] min-h-[200px] divide-y divide-border overflow-y-auto">
          {loading && !calls.length ? <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 size={19} className="mx-auto mb-2 animate-spin"/>Chargement…</div> :
            !filtered.length ? <div className="p-6 text-center text-sm text-muted-foreground">Aucun appel dans cette sélection. Vérifiez la connexion Allo et les filtres.</div> :
            filtered.map(call => <button type="button" key={call.id} onClick={()=>selected(call.id)} aria-current={selectedId===call.id?"true":undefined}
              className={"w-full px-4 py-3.5 text-left transition hover:bg-muted/60 "+(selectedId===call.id?"bg-primary/[0.06] border-l-[3px] border-primary":"border-l-[3px] border-transparent")}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted">{isOutbound(call.direction)?<PhoneOutgoing size={14}/>:<PhoneIncoming size={14}/>}</span>
                <div className="min-w-0 flex-1"><p className="line-clamp-2 break-words text-xs font-semibold leading-5">{displayCall(call)}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{call.externalNumber || call.contactName || "Numéro non identifié"}</p><p className="mt-1 text-[10px] text-muted-foreground">{dateFmt(call.startedAt)} · {durationFmt(call.durationSeconds)}</p></div>
                {call.recordingAvailable ? <Headphones size={13} className="mt-1 shrink-0 text-primary"/>:null}
              </div>
            </button>)}
        </div>
      </aside>
      <div className="min-w-0">
        {selectedId ? <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><ArrowLeft size={13}/> Fiche d’appel</span><span>Source : Allo</span></div> : null}
        <CallDetails key={selectedId || "empty"} call={detail} loading={detailLoading} error={detailError} onRefresh={()=>{if(selectedId)void loadDetail(selectedId);}} />
      </div>
    </div>
  </div></div>;
}
