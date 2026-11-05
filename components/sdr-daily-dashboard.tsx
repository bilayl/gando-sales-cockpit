"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, Check, Clock3, ExternalLink, Headphones, ListTodo, Loader2, PhoneCall, RefreshCw, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { WithAlloCallButton } from "@/components/withallo-call-button";

type Task = {
  id:string;subject:string;body:string;dueAt:string;priority:string;type:string;assignee:string;
  companyId:string|null;companyName:string|null;contactId:string|null;contactName:string|null;
  phone:string|null;overdue:boolean;
};
type Response = {
  tasks:Task[];stats:{overdue:number;today:number};
  canViewTeam:boolean;scope:"mine"|"team";partial:boolean;notice:string|null;source:string;
};
function when(value:string){
  const d=new Date(value);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short"}).format(d):"Date inconnue";
}
export function SdrDailyDashboard(){
  const [data,setData]=useState<Response|null>(null);
  const [scope,setScope]=useState<"mine"|"team">("mine");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const [done,setDone]=useState<Set<string>>(new Set());
  const reload=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch("/api/sdr/workday?scope="+scope,{cache:"no-store"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"File SDR indisponible.");
      setData(body);
      setError("");
      setDone(new Set());
    }catch(cause){setError(cause instanceof Error?cause.message:"Impossible de charger les rappels.");}
    finally{setLoading(false);}
  },[scope]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{
    const onUpdate=()=>void reload();
    window.addEventListener("gando:sdr-tasks-updated",onUpdate);
    const onVisibility=()=>{if(document.visibilityState==="visible")void reload();};
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{window.removeEventListener("gando:sdr-tasks-updated",onUpdate);document.removeEventListener("visibilitychange",onVisibility);};
  },[reload]);

  const visible=useMemo(()=>data?.tasks.filter(t=>!done.has(t.id))||[],[data,done]);
  const overdue=visible.filter(t=>t.overdue);
  const today=visible.filter(t=>!t.overdue);
  async function complete(task:Task){
    if(busy)return;
    setBusy(task.id);
    try{
      const res=await fetch("/api/sdr/tasks/"+encodeURIComponent(task.id)+"/complete",{
        method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({}),
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(result.error||"Modification refusée par HubSpot.");
      setDone(curr=>new Set([...curr,task.id]));
      toast.success("Tâche terminée et synchronisée dans HubSpot.");
    }catch(cause){toast.error(cause instanceof Error?cause.message:"Impossible de terminer la tâche.");}
    finally{setBusy("");}
  }
  function TaskRow({task}:{task:Task}){
    const href=task.companyId?"/companies/"+encodeURIComponent(task.companyId):task.contactId?"/contacts/"+encodeURIComponent(task.contactId):"/tasks";
    return <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3.5 last:border-0">
      <div className={"grid size-9 shrink-0 place-items-center rounded-lg "+(task.overdue?"bg-rose-500/10 text-rose-600":"bg-primary/10 text-primary")}>{task.type==="CALL"?<PhoneCall size={17}/>:<ListTodo size={17}/>}</div>
      <div className="min-w-[150px] flex-1">
        <p className="break-words text-sm font-semibold">{task.subject}</p>
        <p className="mt-1 text-xs text-muted-foreground">{[task.companyName,task.contactName].filter(Boolean).join(" · ")||"Prospect non associé"} · {when(task.dueAt)}</p>
        {task.body?<p className="mt-1 line-clamp-2 max-w-[720px] text-[11px] text-muted-foreground">{task.body}</p>:null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {task.phone?<WithAlloCallButton phone={task.phone} label="Appeler" className="h-8 px-3 text-xs"/>:null}
        <Link href={href} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">Fiche <ExternalLink size={12}/></Link>
        <button type="button" onClick={()=>void complete(task)} disabled={Boolean(busy)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50">{busy===task.id?<Loader2 size={13} className="animate-spin"/>:<Check size={13}/>} Terminer</button>
      </div>
    </div>;
  }

  return <div className="page-shell"><div className="page-content space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Gando · Commercial</p><h1 className="mt-1 text-2xl font-semibold">Ma journée SDR</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rappels HubSpot, appels Allo et actions de suivi au même endroit.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {data?.canViewTeam?<div className="inline-flex rounded-lg border border-border bg-muted p-1">{(["mine","team"] as const).map(v=><button type="button" key={v} onClick={()=>setScope(v)} className={"rounded-md px-3 py-1.5 text-xs font-semibold "+(scope===v?"bg-card shadow-sm":"text-muted-foreground")}>{v==="mine"?"Mes tâches":"L’équipe"}</button>)}</div>:null}
        <button type="button" aria-label="Actualiser la file SDR" onClick={()=>void reload()} disabled={loading} className="grid size-9 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-50"><RefreshCw size={15} className={loading?"animate-spin":""}/></button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Rappels en retard</p><p className="mt-2 text-2xl font-semibold">{overdue.length}</p></div>
      <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">À faire aujourd’hui</p><p className="mt-2 text-2xl font-semibold">{today.length}</p></div>
      <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Actions restantes</p><p className="mt-2 text-2xl font-semibold">{visible.length}</p></div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/prospection" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90"><PhoneCall size={15}/> Démarrer la session de prospection</Link>
      <Link href="/phone" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold hover:bg-muted"><Headphones size={15}/> Analyser les appels Allo</Link>
      <Link href="/phone/stats" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold hover:bg-muted"><Target size={15}/> Statistiques d’appels</Link>
    </div>
    {error?<p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">{error}</p>:null}
    {data?.notice?<p className="rounded-xl border border-amber-500/30 p-3 text-xs text-amber-700">{data.notice}</p>:null}
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3"><Clock3 size={16} className="text-rose-500"/><h2 className="font-semibold">Rappels prioritaires en retard</h2><span className="ml-auto text-xs text-muted-foreground">{overdue.length}</span></div>
      {overdue.length?overdue.map(task=><TaskRow key={task.id} task={task}/>):<div className="p-5 text-sm text-muted-foreground">{loading?"Chargement des tâches…":"Aucune tâche en retard."}</div>}
    </section>
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3"><CalendarCheck2 size={16} className="text-primary"/><h2 className="font-semibold">À traiter aujourd’hui</h2><span className="ml-auto text-xs text-muted-foreground">{today.length}</span></div>
      {today.length?today.map(task=><TaskRow key={task.id} task={task}/>):<div className="p-5 text-sm text-muted-foreground">{loading?"Chargement des tâches…":"Aucune autre tâche prévue aujourd’hui."}</div>}
    </section>
    <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Sparkles size={15} className="mt-0.5 shrink-0 text-primary"/>Après chaque appel, ouvre la fiche Allo pour consulter la transcription et confirmer les actions proposées comme tâches HubSpot. Les tâches sont ensuite ajoutées automatiquement à cette file lorsqu’elles arrivent à échéance.</div>
  </div></div>;
}
