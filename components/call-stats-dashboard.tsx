"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, BarChart3, Download, Headphones, Loader2, PhoneCall, RefreshCw, Users } from "lucide-react";
import type { CallAnalyticsResponse, CallAnalyticsSource, CallAnalyticsView, CallAnalyticsBreakdown, CallMetric, CallMetricKey } from "@/lib/call-analytics-types";

type Period = "today" | "yesterday" | "week" | "last_week" | "last7" | "last30" | "month" | "custom";

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  {id:"today",label:"Aujourd’hui"},
  {id:"yesterday",label:"Hier"},
  {id:"week",label:"Cette semaine"},
  {id:"last_week",label:"Semaine dernière"},
  {id:"last7",label:"7 derniers jours"},
  {id:"last30",label:"30 derniers jours"},
  {id:"month",label:"Ce mois"},
  {id:"custom",label:"Dates personnalisées"},
];
const VIEWS: {id:CallAnalyticsView;label:string}[]=[
  {id:"overview",label:"Overview"},
  {id:"outbound",label:"Outbound"},
  {id:"inbound",label:"Inbound"},
  {id:"power",label:"Power dialer"},
];
const METRICS: {key:CallMetricKey;label:string;short:string}[]=[
  {key:"calls",label:"Total des appels",short:"Appels"},
  {key:"talkSeconds",label:"Temps de conversation",short:"Conversation"},
  {key:"longCalls",label:"Appels de plus d’1 min",short:"> 1 min"},
  {key:"answerRate",label:"Taux de réponse",short:"Réponse"},
];
const integer=new Intl.NumberFormat("fr-FR");
const decimal=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1});
function number(n:number){return integer.format(Math.round(n));}
function prettyDuration(n:number){
  const sec=Math.max(0,Math.round(n));
  if(sec>=3600) return Math.floor(sec/3600)+"h "+String(Math.floor((sec%3600)/60)).padStart(2,"0")+"m";
  if(sec>=60) return Math.floor(sec/60)+"m"+(sec%60 ? " "+String(sec%60).padStart(2,"0")+"s" : "");
  return sec+"s";
}
function value(key:CallMetricKey,n:number){
  if(key==="talkSeconds")return prettyDuration(n);
  if(key==="answerRate")return decimal.format(n*100)+" %";
  return number(n);
}
function changeLabel(metric:CallMetric){
  if(metric.change==null){
    if(metric.previous===0&&metric.value>0)return "Nouveau";
    return "—";
  }
  const n=metric.change*100;
  return (n>0?"+":"")+decimal.format(n)+" %";
}
function percentClass(metric:CallMetric){
  if(metric.change==null)return "text-muted-foreground/65";
  if(metric.change>0)return "text-emerald-600 dark:text-emerald-400";
  if(metric.change<0)return "text-rose-500";
  return "text-muted-foreground/70";
}
function rangeLabel(from:string,to:string){
  const start=new Date(from+"T12:00:00Z"),end=new Date(to+"T12:00:00Z");
  const fmt=new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
  return from===to?fmt.format(start):fmt.format(start)+" – "+fmt.format(end);
}
function dateInParis(){
  const d=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const v=Object.fromEntries(d.map(p=>[p.type,p.value]));
  return v.year+"-"+v.month+"-"+v.day;
}
function csvCell(value:unknown){
  let input=String(value??"").replace(/\u0000/g,"");
  if(/^[=+\-@\t\r]/.test(input))input="'"+input;
  return '"'+input.replace(/"/g,'""')+'"';
}
function exportCsv(data:CallAnalyticsResponse){
  const header=["Source","Vue","Regroupement","Date début","Date fin","Période précédente début","Période précédente fin","Utilisateur / ligne","Email / téléphone","Appels","Appels période précédente","Temps de conversation (s)","Appels >1min","Taux de réponse (%)","Variation appels (%)"];
  const rows=data.rows.map(row=>[
    data.source,data.view,data.breakdown,data.period.from,data.period.to,data.period.previousFrom,data.period.previousTo,
    row.name,row.subtitle||"",row.metrics.calls.value,row.metrics.calls.previous??"",row.metrics.talkSeconds.value,
    row.metrics.longCalls.value,(row.metrics.answerRate.value*100).toFixed(2),
    row.metrics.calls.change==null?"":(row.metrics.calls.change*100).toFixed(2),
  ]);
  const content="\ufeff"+[header,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n");
  const blob=new Blob([content],{type:"text/csv;charset=utf-8;"});
  const uri=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=uri;
  anchor.download="gando-appels-"+data.source+"-"+data.period.from+"-"+data.period.to+".csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(uri),500);
}

function MetricCard({label,metricValue,metricKey}:{label:string;metricValue:CallMetric;metricKey:CallMetricKey}){
  return <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:p-5">
    <div className="text-xs font-semibold text-foreground/80 sm:text-sm">{label}</div>
    <div className="mt-3 flex flex-wrap items-baseline gap-2.5"><span className="text-2xl font-semibold tracking-[-0.04em] sm:text-[29px]">{value(metricKey,metricValue.value)}</span>
      <span className={"text-xs font-semibold "+percentClass(metricValue)}>{changeLabel(metricValue)}</span>
    </div>
    <p className="mt-1 text-[11px] text-muted-foreground">vs. {metricValue.previous==null?"période précédente":value(metricKey,metricValue.previous)} période précédente</p>
  </div>;
}

export function CallStatsDashboard() {
  const [source,setSource]=useState<CallAnalyticsSource>("allo");
  const [view,setView]=useState<CallAnalyticsView>("overview");
  const [period,setPeriod]=useState<Period>("week");
  const [breakdown,setBreakdown]=useState<CallAnalyticsBreakdown>("user");
  const [selected,setSelected]=useState("");
  const [customFrom,setCustomFrom]=useState(dateInParis());
  const [customTo,setCustomTo]=useState(dateInParis());
  const [highlight,setHighlight]=useState<CallMetricKey>("calls");
  const [refresh,setRefresh]=useState(0);
  const [data,setData]=useState<CallAnalyticsResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [loadedAt,setLoadedAt]=useState("");

  useEffect(()=>{
    let active=true;
    const abort=new AbortController();
    if(period==="custom" && (!customFrom||!customTo))return;
    const params=new URLSearchParams({
      source,view,period,breakdown,...(selected?{filter:selected}:{}),
      ...(period==="custom"?{from:customFrom,to:customTo}:{}),
    });
    setLoading(true);
    setError("");
    void fetch("/api/call-analytics?"+params.toString(),{cache:"no-store",signal:abort.signal})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body.error||"Impossible de charger les statistiques.");
        if(!active)return;
        setData(body as CallAnalyticsResponse);
        setLoadedAt(new Date().toISOString());
      }).catch(cause=>{
        if(!active||abort.signal.aborted)return;
        setError(cause instanceof Error?cause.message:"Statistiques indisponibles.");
        setData(null);
      }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;abort.abort();};
  },[source,view,period,breakdown,selected,customFrom,customTo,refresh]);

  const options=useMemo(()=>breakdown==="user"?data?.userOptions||[]:data?.phoneOptions||[],[data,breakdown]);
  const max=useMemo(()=>Math.max(1,...(data?.rows||[]).map(r=>r.metrics[highlight].value)),[data,highlight]);
  const setSourceMode=(newSource:CallAnalyticsSource)=>{setSource(newSource);setSelected("");setBreakdown("user");};
  const setMode=(next:CallAnalyticsView)=>{setView(next);setSelected("");};
  const setGrouping=(next:CallAnalyticsBreakdown)=>{setBreakdown(next);setSelected("");};

  return <div className="page-shell">
    <div className="page-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/phone" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={13}/> Retour aux appels</Link>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Téléphonie · CRM Gando</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Statistiques d’appels</h1>
          <p className="mt-1 text-sm text-muted-foreground">Performance commerciale, conversations et comparaison avec la période précédente.</p>
        </div>
        <Link href="/phone" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><Headphones size={14}/> Enregistrements et transcriptions</Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div role="tablist" aria-label="Type d’appels" className="flex max-w-full gap-1 overflow-x-auto">
          {VIEWS.map(tab=><button type="button" role="tab" aria-selected={view===tab.id} key={tab.id} onClick={()=>setMode(tab.id)}
            className={"shrink-0 border-b-2 px-3 py-3 text-xs font-semibold transition-colors "+(view===tab.id?"border-primary text-foreground":"border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</button>)}
        </div>
        <div className="mb-2 inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <button type="button" onClick={()=>setSourceMode("allo")} aria-pressed={source==="allo"} className={"rounded-md px-3 py-1.5 text-xs font-medium "+(source==="allo"?"bg-card text-foreground shadow-sm":"text-muted-foreground")}>Allo</button>
          <button type="button" onClick={()=>setSourceMode("hubspot")} aria-pressed={source==="hubspot"} className={"rounded-md px-3 py-1.5 text-xs font-medium "+(source==="hubspot"?"bg-card text-foreground shadow-sm":"text-muted-foreground")}>HubSpot CRM</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="call-stats-period">Période</label>
          <select id="call-stats-period" value={period} onChange={event=>{setPeriod(event.target.value as Period);setSelected("");}} className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold">
            {PERIOD_OPTIONS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {period==="custom"?<div className="flex flex-wrap items-center gap-2"><input aria-label="Date de début" type="date" value={customFrom} max={customTo} onChange={e=>setCustomFrom(e.target.value)} className="h-9 rounded-lg border border-border bg-card px-2 text-xs"/><span className="text-xs text-muted-foreground">au</span><input aria-label="Date de fin" type="date" min={customFrom} value={customTo} onChange={e=>setCustomTo(e.target.value)} className="h-9 rounded-lg border border-border bg-card px-2 text-xs"/></div>:null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            <button type="button" aria-pressed={breakdown==="user"} onClick={()=>setGrouping("user")} className={"rounded-md px-3 py-1.5 text-xs font-semibold "+(breakdown==="user"?"bg-card text-foreground shadow-sm":"text-muted-foreground")}>By User</button>
            <button type="button" aria-pressed={breakdown==="phone"} disabled={source==="allo"&&data?.canCompareTeam===false} onClick={()=>setGrouping("phone")} title={source==="allo"&&data?.canCompareTeam===false?"Comparaison réservée aux administrateurs":undefined} className={"rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-35 "+(breakdown==="phone"?"bg-card text-foreground shadow-sm":"text-muted-foreground")}>By Phone</button>
          </div>
          <select aria-label={breakdown==="user"?"Filtrer par commercial":"Filtrer par ligne"} value={selected} onChange={e=>setSelected(e.target.value)} className="h-9 min-w-32 max-w-56 rounded-lg border border-border bg-card px-2 text-xs font-medium">
            <option value="">Toute l’équipe</option>
            {options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <button type="button" onClick={()=>setRefresh(v=>v+1)} disabled={loading} aria-label="Actualiser les statistiques" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"><RefreshCw size={14} className={loading?"animate-spin":""}/></button>
        </div>
      </div>

      {data ? <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-1.5"><span className="font-semibold text-foreground">{source==="allo"?"Source : Allo (Analytics)":"Source : activités HubSpot CRM"}</span><span>·</span><span>{rangeLabel(data.period.from,data.period.to)}</span><span>vs.</span><span>{rangeLabel(data.period.previousFrom,data.period.previousTo)}</span></div>
        <span>Mis à jour {data.updatedAt?new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short"}).format(new Date(data.updatedAt)):"au chargement"} · Consultation {loadedAt?new Intl.DateTimeFormat("fr-FR",{timeStyle:"short"}).format(new Date(loadedAt)):"—"}</span>
      </div>:null}

      {loading&&!data?<div className="grid min-h-[350px] place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"><div className="flex items-center gap-2"><Loader2 size={18} className="animate-spin"/>Calcul des statistiques réelles…</div></div>:null}
      {error?<p role="alert" className="rounded-xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">{error}</p>:null}

      {data ? <>
        {loading?<div role="status" className="text-xs text-muted-foreground"><Loader2 size={12} className="mr-1 inline animate-spin"/>Actualisation…</div>:null}
        {view==="power" ? <div className="rounded-2xl border border-border bg-card p-6"><h2 className="text-base font-semibold">Power Dialer</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Les sources disponibles ne distinguent pas encore de manière fiable l’historique des appels lancés spécifiquement par Power Dialer. Ce rapport reste volontairement vide pour éviter des statistiques trompeuses.</p><a href="https://web.withallo.com/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Ouvrir les rapports Allo <ArrowUpRight size={13}/></a></div> :
        <>
          <section>
            <h2 className="mb-3 text-base font-semibold">Résumé de l’équipe</h2>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {METRICS.map(item=><MetricCard key={item.key} label={item.label} metricKey={item.key} metricValue={data.metrics[item.key]}/>)}
            </div>
          </section>

          {view==="outbound"&&data.funnel.length ? <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4"><h2 className="text-base font-semibold">Entonnoir des appels sortants</h2><p className="mt-1 text-xs text-muted-foreground">Étapes fournies directement par l’API Allo · tous les appels sortants de la sélection.</p></div>
            <div className="grid gap-3 sm:grid-cols-4">{data.funnel.map(item=><div key={item.key} className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{item.name}</p><p className="mt-1 text-2xl font-semibold">{number(item.metric.value)}</p><p className={"mt-1 text-xs "+percentClass(item.metric)}>{changeLabel(item.metric)}</p></div>)}</div>
          </section>:null}

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-base font-semibold">Comparaison de l’équipe</h2><p className="mt-1 text-[11px] text-muted-foreground">Résultats réels par {breakdown==="user"?"commercial":"ligne téléphonique"} sur la période sélectionnée.</p></div>
              <div className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
                {METRICS.map(item=><button type="button" key={item.key} onClick={()=>setHighlight(item.key)} aria-pressed={highlight===item.key} className={"rounded-md px-2.5 py-1.5 text-[11px] font-semibold "+(highlight===item.key?"bg-card text-foreground shadow-sm":"text-muted-foreground")}>{item.short}</button>)}
              </div>
            </div>
            {!data.rows.length?<p className="mt-5 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucune donnée par {breakdown==="user"?"commercial":"numéro"} pour cette sélection. Vérifiez les droits de lecture et les filtres.</p>:
              <div className="mt-5 space-y-3">
                {data.rows.slice(0,30).map(row=><div key={row.id} className="grid items-center gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-[170px_minmax(0,1fr)_95px]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-bold">{row.name.slice(0,2).toUpperCase()}</span>
                    <div className="min-w-0"><p className="truncate text-xs font-semibold" title={row.name}>{row.name}</p>{row.subtitle?<p className="truncate text-[10px] text-muted-foreground">{row.subtitle}</p>:null}</div>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-muted/60"><div className="flex h-full items-center justify-end rounded-lg bg-primary/75 pr-2 text-[11px] font-semibold text-primary-foreground transition-all" style={{width:Math.max(row.metrics[highlight].value?3:0,Math.min(100,(row.metrics[highlight].value/max)*100))+"%"}}>
                    {row.metrics[highlight].value>0?value(highlight,row.metrics[highlight].value):null}</div></div>
                  <div className="text-right"><span className={"text-[11px] font-semibold "+percentClass(row.metrics[highlight])}>{changeLabel(row.metrics[highlight])}</span></div>
                </div>)}
              </div>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 sm:px-5">
              <div><h2 className="text-base font-semibold">Détail par {breakdown==="user"?"utilisateur":"téléphone"}</h2><p className="mt-1 text-[11px] text-muted-foreground">Données pour la période sélectionnée · variation vs. période précédente.</p></div>
              <button type="button" onClick={()=>exportCsv(data)} disabled={!data.rows.length} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-40"><Download size={14}/> Exporter CSV</button>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>
                <th className="px-5 py-4 font-medium">{breakdown==="user"?"Utilisateur":"Numéro"}</th>
                <th className="px-4 py-4 text-right font-medium">Appels</th>
                <th className="px-4 py-4 text-right font-medium">Temps de conversation</th>
                <th className="px-4 py-4 text-right font-medium">Appels de plus d’1 min</th>
                <th className="px-5 py-4 text-right font-medium">Taux de réponse</th>
              </tr></thead>
              <tbody className="divide-y divide-border">{data.rows.map(row=><tr key={row.id} className="hover:bg-muted/20">
                <td className="px-5 py-3.5"><div className="font-semibold">{row.name}</div>{row.subtitle?<div className="mt-1 max-w-60 truncate text-[11px] text-muted-foreground">{row.subtitle}</div>:null}</td>
                {METRICS.map(item=><td key={item.key} className="px-4 py-3.5 text-right"><span className="font-semibold">{value(item.key,row.metrics[item.key].value)}</span><span className={"ml-2 text-[11px] "+percentClass(row.metrics[item.key])}>{changeLabel(row.metrics[item.key])}</span></td>)}
              </tr>)}</tbody>
            </table>
            {!data.rows.length?<div className="p-6 text-center text-sm text-muted-foreground">Aucun résultat pour cette période.</div>:null}
            </div>
          </section>
        </>}
        <div className="space-y-2 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
          {data.partial?<p className="font-semibold text-amber-700 dark:text-amber-300">Données partielles : le volume dépasse la limite de consultation ou certaines lignes sont indisponibles.</p>:null}
          {data.notes.map((note,i)=><p key={i}>{note}</p>)}
          <p className="inline-flex items-center gap-1"><Activity size={12}/> Les deux sources ne sont pas cumulées : cela évite de compter deux fois les appels synchronisés.</p>
        </div>
      </>:null}
    </div>
  </div>;
}
