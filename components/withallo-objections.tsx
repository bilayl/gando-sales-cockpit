"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { OBJECTION_LABELS, type ObjectionReport, type ObjectionCategory, type Objection } from "@/lib/allo-objection-types";

const outcomeLabels = { overcome: "Surmontée selon l’IA", not_overcome: "Non surmontée selon l’IA", unknown: "Issue indéterminée" };
function Evidence({ item }: { item: Objection }) {
  return <div className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{OBJECTION_LABELS[item.category]}</h4><span className="rounded-md bg-muted px-2 py-1 text-xs">{outcomeLabels[item.outcome]}</span></div>
    <div><p className="text-xs font-medium text-muted-foreground">Ce qu’a dit le prospect (verbatim)</p><blockquote className="mt-1 whitespace-pre-wrap break-words border-l-2 border-primary/50 pl-3 text-sm">« {item.quote} »</blockquote></div>
    <div><p className="text-xs font-medium text-muted-foreground">Réponse du commercial</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.reply ? "« " + item.reply + " »" : "Aucune réponse identifiable dans l’extrait."}</p></div>
    <div><p className="text-xs font-medium text-muted-foreground">Analyse IA</p><p className="mt-1 break-words text-sm">{item.assessment}</p></div>
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-primary"><Sparkles size={14}/> Comment rebondir</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.suggestion}</p></div>
  </div>;
}
export function WithAlloObjections({ callId }: { callId?: string }) {
  const [report, setReport] = useState<ObjectionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState<ObjectionCategory | "all">("all");
  const [member, setMember] = useState("all");
  const [reportDays, setReportDays] = useState(30);
  const members = useMemo(() => [...new Set(report?.calls.flatMap(c => c.member ? [c.member] : []) || [])].sort(), [report]);
  const calls = (report?.calls || []).filter(c => member === "all" || c.member === member);
  const items = calls.flatMap(c => c.objections);
  const known = items.filter(o => o.outcome !== "unknown");
  const resolved = known.filter(o => o.outcome === "overcome").length;
  const groups = Object.entries(OBJECTION_LABELS).map(([key, label]) => {
    const matching = items.filter(o => o.category === key);
    return { key: key as ObjectionCategory, label, count: matching.length, calls: calls.filter(c => c.objections.some(o => o.category === key)).length };
  }).filter(x => x.count > 0).sort((a,b) => b.count - a.count);
  async function run() {
    setLoading(true); setError(""); setReport(null); setCategory("all"); setMember("all");
    try {
      const response = await fetch("/api/withallo/objections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(callId ? { callId } : { days }), cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Analyse indisponible.");
      setReport(body as ObjectionReport); setReportDays(days);
    } catch (e) { setError(e instanceof Error ? e.message : "Analyse indisponible."); }
    finally { setLoading(false); }
  }
  return <section className={callId ? "space-y-4" : "space-y-4 rounded-2xl border border-border bg-card p-5"}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-base font-semibold"><Sparkles size={17} className="text-primary"/>{callId ? "Objections et rebonds" : "Intelligence commerciale · Objections"}</h3><p className="mt-1 text-xs text-muted-foreground">{callId ? "Analyse de la transcription réelle et propositions de réponse." : "Comprendre les freins des prospects à partir des transcriptions Allo disponibles."}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {!callId && <select aria-label="Période" value={days} disabled={loading} onChange={e => { setDays(Number(e.target.value)); setReport(null); setError(""); }} className="h-9 rounded-lg border border-border bg-background px-2 text-xs"><option value={7}>7 derniers jours</option><option value={30}>30 derniers jours</option></select>}
        <button type="button" disabled={loading} onClick={() => void run()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">{loading && <Loader2 size={14} className="animate-spin"/>}{loading ? "Analyse en cours…" : report ? "Relancer l’analyse" : "Analyser les objections"}</button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {!report && !loading && !error && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{callId ? "Lancez l’analyse de cet appel." : "Lancez une analyse IA des 12 dernières transcriptions accessibles dans la période. Les appels sans transcription sont exclus."}</p>}
    {report && <>
      {!callId && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        ["Appels analysés", String(calls.length)],
        ["Appels avec objections", String(calls.filter(c => c.objections.length > 0).length)],
        ["Objections détectées", String(items.length)],
        ["Taux de rebond (issues connues)", known.length ? Math.round(100 * resolved / known.length) + " %" : "—"],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>}
      <p className="text-xs leading-5 text-muted-foreground">{!callId && <>Échantillon : {report.calls.length}/{report.selected} transcriptions sélectionnées, sur {report.accessible} appels visibles dans les {reportDays} derniers jours. {report.unavailable} sans transcription dans l’historique. {Math.max(0,report.accessible-report.unavailable-report.selected)} autres appels transcrits non analysés. {report.historyLimited && "Historique limité aux 100 derniers appels. "}</>}{report.invalid > 0 && <>{report.invalid} analyse(s) non validée(s), exclue(s). </>}{report.calls.some(c=>c.truncated) && "Certaines transcriptions sont tronquées. "}{!callId && <>Taux estimé sur {known.length} objection(s) à issue connue ; {items.length-known.length} indéterminée(s). </>}Les verbatims sont vérifiés dans la transcription ; l’interprétation et les conseils IA restent à valider.</p>
      {!callId && report.calls.length > 0 && <div className="space-y-3">
        <div className="flex flex-wrap gap-2"><select aria-label="Commercial" value={member} onChange={e=>{setMember(e.target.value);setCategory("all");}} className="h-9 max-w-full rounded-lg border border-border bg-background px-2 text-xs"><option value="all">Tous les commerciaux accessibles</option>{members.map(m=><option key={m} value={m}>{m}</option>)}</select><select aria-label="Type d’objection" value={category} onChange={e=>setCategory(e.target.value as ObjectionCategory | "all")} className="h-9 max-w-full rounded-lg border border-border bg-background px-2 text-xs"><option value="all">Toutes les objections</option>{groups.map(g=><option key={g.key} value={g.key}>{g.label}</option>)}</select></div>
        {groups.map(g => <button type="button" key={g.key} onClick={()=>setCategory(category === g.key ? "all" : g.key)} aria-pressed={category===g.key} className="block w-full rounded-lg p-2 text-left hover:bg-muted"><div className="mb-1 flex justify-between gap-2 text-xs"><span className="font-medium">{g.label}</span><span>{g.count} objection(s) · {g.calls} appel(s)</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width: (100*g.count/Math.max(1,items.length))+"%"}}/></div></button>)}
      </div>}
      {report.calls.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{report.invalid ? "Aucune analyse validée. Réessayez ou analysez les appels individuellement." : "Aucune transcription exploitable disponible."}</p> : !items.length ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Aucune objection explicite détectée dans les extraits analysés.</p> : null}
      <div className="space-y-3">{calls.filter(c=>c.objections.some(o=>category==="all"||o.category===category)).map(c=><div key={c.id} className="space-y-2">
        {!callId && <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{c.title} · {c.objections.filter(o=>category==="all"||o.category===category).length} objection(s)</summary><div className="mt-3 space-y-2"><Link href={"/phone?call="+encodeURIComponent(c.id)} className="text-xs font-semibold text-primary hover:underline">Ouvrir la conversation Allo</Link>{c.objections.filter(o=>category==="all"||o.category===category).map((o,i)=><Evidence key={i} item={o}/>)}</div></details>}
        {callId && c.objections.map((o,i)=><Evidence key={i} item={o}/>)}
      </div>)}</div>
    </>}
  </section>;
}
