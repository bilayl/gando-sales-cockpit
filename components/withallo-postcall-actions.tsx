"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Loader2, ListTodo, Sparkles } from "lucide-react";
import type { AlloCallDetailView } from "@/lib/withallo-call-detail";

function defaultTime(){
  const d=new Date();
  d.setDate(d.getDate()+1);
  d.setHours(10,0,0,0);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")+"T10:00";
}

export function WithAlloPostCallActions({call}:{call:AlloCallDetailView}){
  const [selected,setSelected]=useState("0");
  const [manualText,setManualText]=useState("");
  const [type,setType]=useState("CALL");
  const [when,setWhen]=useState(defaultTime);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState<{id:string;text:string;linked:string|null}|null>(null);

  async function submit(){
    if(busy)return;
    const actionIndex=selected==="manual"?-1:Number(selected);
    if(actionIndex<0 && manualText.trim().length<5){
      setError("Écris une action à effectuer (au moins cinq caractères).");return;
    }
    const date=new Date(when);
    if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now()){
      setError("Choisis une date future.");return;
    }
    setBusy(true);setError("");setCreated(null);
    try{
      const res=await fetch("/api/withallo/calls/"+encodeURIComponent(call.id)+"/follow-up",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          actionIndex,
          manualText:actionIndex===-1?manualText.trim():undefined,
          dueAt:date.toISOString(),
          taskType:type,
        }),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(body.error||"La création de la tâche a échoué.");
      setCreated({id:String(body.hubspotTaskId),text:String(body.action||""),linked:body.contactLinked||null});
      window.dispatchEvent(new Event("gando:sdr-tasks-updated"));
    }catch(cause){setError(cause instanceof Error?cause.message:"Impossible de créer la tâche HubSpot.");}
    finally{setBusy(false);}
  }
  return <section className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
    <div className="flex items-center gap-2"><Sparkles size={16} className="text-primary"/><h4 className="text-sm font-semibold">Transformer le compte rendu en action</h4></div>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">Sélectionne une recommandation Allo, choisis une échéance, puis confirme la création de la tâche dans HubSpot. Aucun e-mail n’est envoyé automatiquement.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><label htmlFor="allo-followup-choice" className="text-xs font-semibold">Action à effectuer</label>
        <select id="allo-followup-choice" value={selected} onChange={e=>{setSelected(e.target.value);setCreated(null);}} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-xs">
          {call.actions.map((a,i)=><option key={i} value={i}>{i+1}. {a.text.slice(0,125)}</option>)}
          <option value="manual">Saisir une action manuellement</option>
        </select>
        {!call.actions.length?<p className="mt-1 text-xs text-muted-foreground">Aucune action explicite dans le résumé Allo : saisis une action manuellement.</p>:null}
      </div>
      {selected==="manual"||!call.actions.length?<div className="sm:col-span-2"><label htmlFor="allo-followup-manual" className="text-xs font-semibold">Détail de l’action</label>
        <textarea id="allo-followup-manual" value={manualText} onChange={e=>setManualText(e.target.value)} maxLength={1000} rows={2} placeholder="Par exemple : rappeler le décideur après réception des documents" className="mt-1.5 w-full rounded-lg border border-border bg-card p-3 text-sm"/>
      </div>:null}
      <div><label htmlFor="allo-followup-date" className="text-xs font-semibold">Date de rappel</label><input id="allo-followup-date" type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-2 text-xs"/></div>
      <div><label htmlFor="allo-followup-type" className="text-xs font-semibold">Type de tâche</label><select id="allo-followup-type" value={type} onChange={e=>setType(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-xs"><option value="CALL">Rappel téléphonique</option><option value="EMAIL">Envoyer un e-mail</option><option value="MEETING">Préparer un RDV</option><option value="TODO">Autre action</option></select></div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={()=>void submit()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">{busy?<Loader2 size={14} className="animate-spin"/>:<ListTodo size={14}/>} {busy?"Création…":"Créer la tâche HubSpot"}</button>
      <Link href="/sdr" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"><CalendarClock size={14}/> Ma journée SDR</Link>
    </div>
    {created?<p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>Tâche créée dans HubSpot : « {created.text} ». {created.linked?"Contact CRM associé : "+created.linked+".": "Contact non associé automatiquement (aucune correspondance CRM unique)."} Elle apparaîtra dans la file SDR à son échéance.</p>:null}
    {error?<p role="alert" className="mt-3 rounded-lg border border-destructive/30 p-3 text-xs text-destructive">{error}</p>:null}
  </section>;
}
