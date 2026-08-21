"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Presentation, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEmptySD04, type SD04Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord } from "@/lib/sd-room-types";

type RoomResponse = { documents: SDDocumentRecord[]; room: { id: string; title: string } | null };

function lines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}
function textLines(value?: string[]) {
  return (value || []).join("\n");
}
function Area({ value, onChange, rows = 5, placeholder }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><div><Label>{label}</Label>{hint ? <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{hint}</p> : null}</div>{children}</div>;
}

export function SD04OfferBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [value, setValue] = useState<SD04Content>(createEmptySD04());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = payload.documents.find((item: SDDocumentRecord) => item.code === "SD04");
      setValue({ ...createEmptySD04(), ...((document?.content || {}) as Partial<SD04Content>) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof SD04Content>(key: K, next: SD04Content[K]) => setValue(current => ({ ...current, [key]: next }));
  const sd02Validated = data?.documents.find(item => item.code === "SD02")?.status === "validated";
  const sd04 = data?.documents.find(item => item.code === "SD04");

  const save = async (publish: boolean) => {
    setWorking(true);
    try {
      const content: SD04Content = {
        ...value,
        offerSummary: value.executiveMessage || value.offerSummary || "",
        assumptions: value.problem || [],
        commercialTerms: [...(value.differentiators || []), ...(value.proofPoints || [])],
        procurementSteps: [...(value.rolloutPlan || []), ...(value.callToAction ? [`Décision attendue — ${value.callToAction}`] : [])],
      };
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "SD04", content, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD04" ? payload.document : document) } : current);
      setValue({ ...createEmptySD04(), ...(payload.document?.content || {}) });
      toast.success(publish ? "SD04 publié dans la Room" : "SD04 enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setWorking(false);
    }
  };

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1250px] space-y-5">
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border bg-primary/[0.04] p-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Presentation className="h-5 w-5" /></div><div><div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">SD04 · Offre commerciale</div><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Construire l’offre et le business case</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Présentez le problème, la réponse Gando, les preuves, le ROI et l’offre finale à faire valider.</p></div></div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{sd04?.status === "validated" ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Validé client</Badge> : null}<Button variant="outline" onClick={() => void save(false)} disabled={working}><Save className="mr-2 h-4 w-4" /> Enregistrer</Button><Button onClick={() => void save(true)} disabled={working || !sd02Validated}><Send className="mr-2 h-4 w-4" /> Publier</Button></div>
      </div>
      {!sd02Validated ? <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-700">SD02 doit être validé avant de publier SD04.</div> : null}
    </Card>

    <Card className="space-y-4 p-5">
      <div className="grid gap-4 lg:grid-cols-2"><Field label="Titre de l’offre"><Input value={value.deckTitle} onChange={event => set("deckTitle", event.target.value)} placeholder="Gando × Client — proposition commerciale" /></Field><Field label="Sous-titre / promesse"><Input value={value.deckSubtitle} onChange={event => set("deckSubtitle", event.target.value)} /></Field></div>
      <Field label="Message exécutif" hint="La phrase que le décideur doit retenir."><Area value={value.executiveMessage || value.offerSummary} onChange={next => { setValue(current => ({ ...current, executiveMessage: next, offerSummary: next })); }} rows={4} /></Field>
    </Card>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5"><Field label="Problème / enjeux client"><Area value={textLines(value.problem)} onChange={next => set("problem", lines(next))} rows={6} placeholder="Une idée forte par ligne" /></Field><Field label="Solution Gando"><Area value={textLines(value.solution)} onChange={next => set("solution", lines(next))} rows={6} /></Field><Field label="Différenciation"><Area value={textLines(value.differentiators)} onChange={next => set("differentiators", lines(next))} rows={5} /></Field></Card>
      <Card className="space-y-4 p-5"><Field label="Preuves / références"><Area value={textLines(value.proofPoints)} onChange={next => set("proofPoints", lines(next))} rows={5} /></Field><Field label="Impact / ROI" hint="Une ligne : métrique | actuel | cible | valeur"><Area value={(value.businessCase || []).map(item => `${item.metric} | ${item.baseline} | ${item.target} | ${item.value}`).join("\n")} onChange={next => set("businessCase", lines(next).map(row => { const [metric="", baseline="", target="", metricValue=""] = row.split("|").map(item => item.trim()); return { metric, baseline, target, value: metricValue }; }).filter(item => item.metric))} rows={7} /></Field></Card>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5"><Field label="Tarification" hint="Une ligne : produit / offre | modèle | prix | notes"><Area value={(value.pricing || []).map(item => `${item.item} | ${item.model} | ${item.price} | ${item.notes}`).join("\n")} onChange={next => set("pricing", lines(next).map(row => { const [item="", model="", price="", notes=""] = row.split("|").map(part => part.trim()); return { item, model, price, notes }; }).filter(item => item.item))} rows={8} /></Field><Field label="Validité de l’offre"><Input type="date" value={value.validityDate} onChange={event => set("validityDate", event.target.value)} /></Field></Card>
      <Card className="space-y-4 p-5"><Field label="Plan de déploiement"><Area value={textLines(value.rolloutPlan)} onChange={next => set("rolloutPlan", lines(next))} rows={6} /></Field><Field label="Décision attendue / call-to-action"><Area value={value.callToAction} onChange={next => set("callToAction", next)} rows={4} placeholder="Ex. Valider l’offre et lancer le pilote." /></Field></Card>
    </div>
  </div></div>;
}
