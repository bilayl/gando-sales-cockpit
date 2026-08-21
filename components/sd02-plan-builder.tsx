"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ListChecks, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MutualActionItem, SD02Content } from "@/lib/sd-stage-content";
import { createEmptySD02 } from "@/lib/sd-stage-content";
import type { SDDocumentRecord } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type RoomResponse = { documents: SDDocumentRecord[]; room: { id: string; title: string } | null };

type StepStatus = "not_started" | "in_progress" | "done";
type StepWorkstream = "business" | "technical" | "legal" | "procurement" | "other";
type StepOrganization = "joint" | "client" | "gando";

const EMPTY_STEP: MutualActionItem = {
  milestone: "",
  workstream: "business",
  organization: "joint",
  owner: "",
  dueDate: "",
  status: "not_started",
  dependency: "",
};

function normalizeStep(item: Partial<MutualActionItem>): MutualActionItem {
  const status: StepStatus = item.status === "done" || item.status === "in_progress" ? item.status : "not_started";
  const workstream: StepWorkstream = item.workstream === "technical" || item.workstream === "legal" || item.workstream === "procurement" || item.workstream === "other" ? item.workstream : "business";
  const organization: StepOrganization = item.organization === "client" || item.organization === "gando" ? item.organization : "joint";
  return {
    milestone: item.milestone || "",
    workstream,
    organization,
    owner: item.owner || "",
    dueDate: item.dueDate || "",
    status,
    dependency: item.dependency || "",
  };
}

function SelectField({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">{children}</select>;
}

export function SD02PlanBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [steps, setSteps] = useState<MutualActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = payload.documents.find((item: SDDocumentRecord) => item.code === "SD02");
      const content = (document?.content || {}) as Partial<SD02Content>;
      setSteps(Array.isArray(content.milestones) ? content.milestones.map(normalizeStep) : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const sd01Validated = data?.documents.find(item => item.code === "SD01")?.status === "validated";
  const sd02 = data?.documents.find(item => item.code === "SD02");
  const completed = useMemo(() => steps.filter(step => step.status === "done").length, [steps]);

  const updateStep = <K extends keyof MutualActionItem>(index: number, key: K, value: MutualActionItem[K]) => {
    setSteps(current => current.map((step, currentIndex) => currentIndex === index ? { ...step, [key]: value } : step));
  };

  const addStep = () => setSteps(current => [...current, { ...EMPTY_STEP }]);
  const removeStep = (index: number) => setSteps(current => current.filter((_, currentIndex) => currentIndex !== index));
  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps(current => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async (publish: boolean) => {
    const cleaned = steps.map(normalizeStep).filter(step => step.milestone.trim());
    if (!cleaned.length) {
      toast.error("Ajoutez au moins une étape au plan d’action.");
      return;
    }
    setWorking(true);
    try {
      const content = createEmptySD02();
      content.milestones = cleaned;
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "SD02", content, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD02" ? payload.document : document) } : current);
      const saved = payload.document?.content as Partial<SD02Content> | undefined;
      setSteps(Array.isArray(saved?.milestones) ? saved.milestones.map(normalizeStep) : cleaned);
      toast.success(publish ? "Plan d’action publié" : "Plan d’action enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setWorking(false);
    }
  };

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7">
    <div className="mx-auto max-w-[1250px] space-y-5">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-border bg-primary/[0.04] p-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ListChecks className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">SD02 · Plan d’action</div>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Construire les étapes du plan</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Le SD02 contient uniquement les étapes à franchir ensemble. Ajoutez-les dans l’ordre, attribuez un responsable, une échéance et un statut.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Badge variant="outline">{completed}/{steps.length} terminée{completed > 1 ? "s" : ""}</Badge>
            {sd02?.status === "validated" ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Validé client</Badge> : null}
            <Button variant="outline" onClick={() => void save(false)} disabled={working}><Save className="mr-2 h-4 w-4" /> Enregistrer</Button>
            <Button onClick={() => void save(true)} disabled={working || !sd01Validated}><Send className="mr-2 h-4 w-4" /> Publier</Button>
          </div>
        </div>
        {!sd01Validated ? <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-700">SD01 doit être validé avant de publier le plan d’action.</div> : null}
      </Card>

      <div className="space-y-3">
        {steps.map((step, index) => <Card key={index} className="p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{String(index + 1).padStart(2, "0")}</div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <div className="flex-1">
                  <Label>Étape</Label>
                  <Input className="mt-2" value={step.milestone} onChange={event => updateStep(index, "milestone", event.target.value)} placeholder="Ex. Valider le périmètre du pilote" />
                </div>
                <div className="flex shrink-0 items-center gap-1 pt-7">
                  <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(index, -1)} disabled={index === 0} title="Monter"><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} title="Descendre"><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(index)} title="Supprimer" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div><Label>Responsable</Label><Input className="mt-2" value={step.owner} onChange={event => updateStep(index, "owner", event.target.value)} placeholder="Nom / équipe" /></div>
                <div><Label>Échéance</Label><Input className="mt-2" type="date" value={step.dueDate} onChange={event => updateStep(index, "dueDate", event.target.value)} /></div>
                <div><Label>Statut</Label><div className="mt-2"><SelectField value={step.status} onChange={next => updateStep(index, "status", next as StepStatus)}><option value="not_started">À faire</option><option value="in_progress">En cours</option><option value="done">Terminé</option></SelectField></div></div>
                <div><Label>Chantier</Label><div className="mt-2"><SelectField value={step.workstream} onChange={next => updateStep(index, "workstream", next as StepWorkstream)}><option value="business">Business</option><option value="technical">Technique</option><option value="legal">Juridique</option><option value="procurement">Achats</option><option value="other">Autre</option></SelectField></div></div>
                <div><Label>Porté par</Label><div className="mt-2"><SelectField value={step.organization} onChange={next => updateStep(index, "organization", next as StepOrganization)}><option value="joint">Commun</option><option value="client">Client</option><option value="gando">Gando</option></SelectField></div></div>
              </div>

              <div>
                <Label>Dépendance <span className="font-normal text-muted-foreground">(optionnel)</span></Label>
                <Input className="mt-2" value={step.dependency} onChange={event => updateStep(index, "dependency", event.target.value)} placeholder="Ex. Accès sandbox reçu" />
              </div>
            </div>
          </div>
        </Card>)}

        {!steps.length ? <Card className="grid min-h-52 place-items-center p-8 text-center"><div><ListChecks className="mx-auto h-8 w-8 text-primary/60" /><h2 className="mt-3 text-lg font-bold">Aucune étape pour le moment</h2><p className="mt-1 text-sm text-muted-foreground">Commencez par la première action nécessaire pour faire avancer le deal.</p><Button className="mt-4" onClick={addStep}><Plus className="mr-2 h-4 w-4" /> Ajouter la première étape</Button></div></Card> : null}
      </div>

      {steps.length ? <Button variant="outline" className="w-full border-dashed py-6" onClick={addStep}><Plus className="mr-2 h-4 w-4" /> Ajouter une étape</Button> : null}

      <div className={cn("rounded-xl border px-4 py-3 text-xs", sd01Validated ? "border-border bg-card text-muted-foreground" : "border-amber-500/20 bg-amber-500/[0.05] text-amber-700")}>Le plan sera affiché côté client comme une roadmap verticale, dans exactement le même ordre que les étapes ci-dessus.</div>
    </div>
  </div>;
}
