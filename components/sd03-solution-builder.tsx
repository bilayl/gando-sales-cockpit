"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEmptySD03, type SD03Content } from "@/lib/sd-stage-content";
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

export function SD03SolutionBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [value, setValue] = useState<SD03Content>(createEmptySD03());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = payload.documents.find((item: SDDocumentRecord) => item.code === "SD03");
      const raw = (document?.content || {}) as Partial<SD03Content>;
      const empty = createEmptySD03();
      setValue({ ...empty, ...raw, pilot: { ...empty.pilot, ...(raw.pilot || {}) } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof SD03Content>(key: K, next: SD03Content[K]) => setValue(current => ({ ...current, [key]: next }));
  const sd02Validated = data?.documents.find(item => item.code === "SD02")?.status === "validated";
  const sd03 = data?.documents.find(item => item.code === "SD03");

  const save = async (publish: boolean) => {
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "SD03", content: value, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD03" ? payload.document : document) } : current);
      const raw = payload.document?.content as Partial<SD03Content> | undefined;
      const empty = createEmptySD03();
      setValue({ ...empty, ...(raw || {}), pilot: { ...empty.pilot, ...(raw?.pilot || {}) } });
      toast.success(publish ? "SD03 publié dans la Room" : "SD03 enregistré");
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
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Settings2 className="h-5 w-5" /></div><div><div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">SD03 · Solution & intégration</div><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Cadrer la solution et le pilote</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Décrivez ce qui sera mis en place, les intégrations nécessaires et la manière dont le pilote sera validé.</p></div></div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{sd03?.status === "validated" ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Validé client</Badge> : null}<Button variant="outline" onClick={() => void save(false)} disabled={working}><Save className="mr-2 h-4 w-4" /> Enregistrer</Button><Button onClick={() => void save(true)} disabled={working || !sd02Validated}><Send className="mr-2 h-4 w-4" /> Publier</Button></div>
      </div>
      {!sd02Validated ? <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-700">SD02 doit être validé avant de publier SD03.</div> : null}
    </Card>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5">
        <Field label="Synthèse de la solution"><Area value={value.solutionSummary} onChange={next => set("solutionSummary", next)} rows={5} placeholder="Expliquez simplement la solution retenue pour ce client." /></Field>
        <Field label="Dans le périmètre" hint="Une ligne par élément"><Area value={textLines(value.scopeIn)} onChange={next => set("scopeIn", lines(next))} placeholder="Activation Gando\nFlux paiement + caution\nReporting" /></Field>
        <Field label="Hors périmètre"><Area value={textLines(value.scopeOut)} onChange={next => set("scopeOut", lines(next))} /></Field>
        <Field label="Intégrations"><Area value={textLines(value.integrations)} onChange={next => set("integrations", lines(next))} placeholder="ERP\nAPI\nWebhook\nSSO" /></Field>
        <Field label="Données requises"><Area value={textLines(value.dataRequirements)} onChange={next => set("dataRequirements", lines(next))} /></Field>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Périmètre du pilote"><Input value={value.pilot.perimeter} onChange={event => set("pilot", { ...value.pilot, perimeter: event.target.value })} placeholder="3 agences / 100 dossiers" /></Field><Field label="Durée du pilote"><Input value={value.pilot.duration} onChange={event => set("pilot", { ...value.pilot, duration: event.target.value })} placeholder="30 jours" /></Field></div>
        <Field label="Métriques de succès du pilote"><Area value={textLines(value.pilot.successMetrics)} onChange={next => set("pilot", { ...value.pilot, successMetrics: lines(next) })} placeholder="Taux d’activation\nConversion\nTemps gagné\nSatisfaction" /></Field>
        <Field label="Sécurité & conformité"><Area value={textLines(value.securityAndCompliance)} onChange={next => set("securityAndCompliance", lines(next))} /></Field>
        <Field label="Plan de déploiement"><Area value={textLines(value.deploymentPlan)} onChange={next => set("deploymentPlan", lines(next))} placeholder="Pilote\nValidation\nDéploiement réseau" /></Field>
        <Field label="Responsables techniques"><Area value={textLines(value.technicalOwners)} onChange={next => set("technicalOwners", lines(next))} /></Field>
      </Card>
    </div>
  </div></div>;
}
