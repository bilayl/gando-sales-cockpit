"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, FileText, ListChecks, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MutualActionItem, SD02Content } from "@/lib/sd-stage-content";
import { createEmptySD02 } from "@/lib/sd-stage-content";
import type { SD01Content, SDDocumentRecord } from "@/lib/sd-room-types";

type RoomResponse = { documents: SDDocumentRecord[]; room: { id: string; title: string } | null };
type StepStatus = "not_started" | "in_progress" | "done";
type StepWorkstream = "business" | "technical" | "legal" | "procurement" | "other";
type StepOrganization = "joint" | "client" | "gando";

const EMPTY_STEP: MutualActionItem = { milestone: "", workstream: "business", organization: "joint", owner: "", dueDate: "", status: "not_started", dependency: "" };

function textLines(value: string[]) { return value.join("\n"); }
function lines(value: string) { return value.split("\n").map(item => item.trim()).filter(Boolean); }

function normalizeStep(item: Partial<MutualActionItem>): MutualActionItem {
  const status: StepStatus = item.status === "done" || item.status === "in_progress" ? item.status : "not_started";
  const workstream: StepWorkstream = item.workstream === "technical" || item.workstream === "legal" || item.workstream === "procurement" || item.workstream === "other" ? item.workstream : "business";
  const organization: StepOrganization = item.organization === "client" || item.organization === "gando" ? item.organization : "joint";
  return { milestone: item.milestone || "", workstream, organization, owner: item.owner || "", dueDate: item.dueDate || "", status, dependency: item.dependency || "" };
}

function isEmptySD02(content: Partial<SD02Content>) {
  return !content.objective?.trim() && !content.workingNotes?.trim() && !content.decisionProcess?.length && !content.blockers?.length && !content.milestones?.length;
}

function fromLegacySD01(content: SD01Content | undefined): Partial<SD02Content> | null {
  if (!content) return null;
  const decisions = Array.isArray(content.decisions) ? content.decisions.filter(Boolean) : [];
  const blockers = Array.isArray(content.openQuestions) ? content.openQuestions.filter(Boolean) : [];
  const milestones = Array.isArray(content.nextSteps) ? content.nextSteps.filter(step => step.action?.trim()).map(step => normalizeStep({
    milestone: step.action,
    owner: step.owner,
    dueDate: step.dueDate || "",
    status: step.status,
    workstream: "business",
    organization: "joint",
  })) : [];
  if (!decisions.length && !blockers.length && !milestones.length) return null;
  return { decisionProcess: decisions, blockers, milestones };
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium outline-none focus:border-primary">{children}</select>;
}

function FreeTextarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (value: string) => void; placeholder: string; rows?: number }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-0" />;
}

function DocumentBlock({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="border-b border-border/70 px-6 py-6 last:border-0 sm:px-9">
    <div className="mb-4"><h2 className="text-[17px] font-bold tracking-[-0.02em]">{title}</h2>{description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}</div>
    {children}
  </section>;
}

export function SD02PlanBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [content, setContent] = useState<SD02Content>(() => createEmptySD02());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [legacyImported, setLegacyImported] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = payload.documents.find((item: SDDocumentRecord) => item.code === "SD02");
      const stored = (document?.content || {}) as Partial<SD02Content>;
      const next = { ...createEmptySD02(), ...stored, milestones: Array.isArray(stored.milestones) ? stored.milestones.map(normalizeStep) : [] };
      const sd01 = payload.documents.find((item: SDDocumentRecord) => item.code === "SD01");
      const legacy = isEmptySD02(next) ? fromLegacySD01(sd01?.content as SD01Content | undefined) : null;
      if (legacy) {
        setContent({ ...next, ...legacy, milestones: legacy.milestones || [] });
        setLegacyImported(true);
      } else {
        setContent(next);
        setLegacyImported(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const sd02 = data?.documents.find(item => item.code === "SD02");
  const completed = useMemo(() => content.milestones.filter(step => step.status === "done").length, [content.milestones]);
  const update = <K extends keyof SD02Content>(key: K, value: SD02Content[K]) => setContent(current => ({ ...current, [key]: value }));
  const updateStep = <K extends keyof MutualActionItem>(index: number, key: K, value: MutualActionItem[K]) => update("milestones", content.milestones.map((step, currentIndex) => currentIndex === index ? { ...step, [key]: value } : step));
  const addStep = () => update("milestones", [...content.milestones, { ...EMPTY_STEP }]);
  const removeStep = (index: number) => update("milestones", content.milestones.filter((_, currentIndex) => currentIndex !== index));
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= content.milestones.length) return;
    const next = [...content.milestones];
    [next[index], next[target]] = [next[target], next[index]];
    update("milestones", next);
  };

  const save = async (publish: boolean) => {
    const cleaned = { ...content, milestones: content.milestones.map(normalizeStep).filter(step => step.milestone.trim()) };
    if (!cleaned.objective.trim() && !cleaned.decisionProcess.length && !cleaned.blockers.length && !cleaned.milestones.length) {
      toast.error("Ajoute au moins un objectif, une décision ou une prochaine étape.");
      return;
    }
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "SD02", content: cleaned, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD02" ? payload.document : document) } : current);
      const saved = payload.document?.content as Partial<SD02Content> | undefined;
      setContent({ ...createEmptySD02(), ...saved, milestones: Array.isArray(saved?.milestones) ? saved.milestones.map(normalizeStep) : cleaned.milestones });
      setLegacyImported(false);
      toast.success(publish ? "Prochaines étapes publiées" : "Document enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally { setWorking(false); }
  };

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="min-h-screen bg-muted/20 px-4 py-6 lg:px-7 lg:py-8">
    <div className="mx-auto max-w-[1040px] space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">SD02 · Prochaines étapes</div><h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">Décisions & plan d’action</h1><p className="mt-1 text-sm text-muted-foreground">Un document vivant : écris librement, puis transforme ce qui compte en étapes concrètes.</p></div>
        <div className="flex flex-wrap gap-2"><Badge variant="outline">{completed}/{content.milestones.length} terminé{completed > 1 ? "s" : ""}</Badge>{legacyImported ? <Badge variant="outline" className="border-primary/30 text-primary">Anciennes données SD01 reprises</Badge> : null}{sd02?.status === "validated" ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Validé client</Badge> : null}<Button variant="outline" onClick={() => void save(false)} disabled={working}><Save className="mr-2 h-4 w-4" />Enregistrer</Button><Button onClick={() => void save(true)} disabled={working}><Send className="mr-2 h-4 w-4" />Publier</Button></div>
      </div>

      <Card className="overflow-hidden border-border/80 bg-card p-0 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-muted/25 px-6 py-4 sm:px-9"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div><div><div className="text-sm font-bold">Document de travail</div><div className="text-[11px] text-muted-foreground">Même logique qu’un document partagé : peu de structure, beaucoup de liberté.</div></div></div>

        <DocumentBlock title="Objectif partagé" description="Une phrase suffit. Quel résultat concret cherchez-vous à atteindre ensemble ?">
          <FreeTextarea value={content.objective} onChange={value => update("objective", value)} rows={3} placeholder="Ex. Valider un pilote opérationnel sur 3 agences avant le 15 octobre…" />
        </DocumentBlock>

        <DocumentBlock title="Notes de travail" description="Zone libre pour conserver du contexte, des hypothèses ou un compte rendu sans devoir le ranger immédiatement.">
          <FreeTextarea value={content.workingNotes} onChange={value => update("workingNotes", value)} rows={6} placeholder="Écris librement ici, comme dans un Google Doc…" />
        </DocumentBlock>

        <DocumentBlock title="Décisions actées" description="Une décision par ligne. Elles n’apparaissent plus dans SD01.">
          <FreeTextarea value={textLines(content.decisionProcess)} onChange={value => update("decisionProcess", lines(value))} rows={4} placeholder={"Pilote validé sur Marseille\nCaution cible : 1 000 €"} />
        </DocumentBlock>

        <DocumentBlock title="Points à trancher" description="Questions encore ouvertes ou éléments nécessaires avant la prochaine décision.">
          <FreeTextarea value={textLines(content.blockers)} onChange={value => update("blockers", lines(value))} rows={4} placeholder={"Valider le volume mensuel cible\nConfirmer le périmètre juridique"} />
        </DocumentBlock>

        <DocumentBlock title="Prochaines étapes" description="Chaque bloc représente une vraie action. Les détails sont facultatifs : titre, responsable et statut suffisent pour démarrer.">
          <div className="space-y-3">
            {content.milestones.map((step, index) => <div key={index} className="group rounded-xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <Input value={step.milestone} onChange={event => updateStep(index, "milestone", event.target.value)} placeholder="Décrire la prochaine étape…" className="h-auto border-0 bg-transparent p-0 text-[15px] font-semibold shadow-none focus-visible:ring-0" />
                  <textarea value={step.dependency} onChange={event => updateStep(index, "dependency", event.target.value)} rows={2} placeholder="Détail ou dépendance éventuelle…" className="mt-2 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground/50" />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input value={step.owner} onChange={event => updateStep(index, "owner", event.target.value)} placeholder="Responsable" className="h-9 w-36 text-xs" />
                    <Input type="date" value={step.dueDate} onChange={event => updateStep(index, "dueDate", event.target.value)} className="h-9 w-40 text-xs" />
                    <Select value={step.status} onChange={value => updateStep(index, "status", value as StepStatus)}><option value="not_started">À faire</option><option value="in_progress">En cours</option><option value="done">Terminé</option></Select>
                    <Select value={step.organization} onChange={value => updateStep(index, "organization", value as StepOrganization)}><option value="joint">Commun</option><option value="client">Client</option><option value="gando">Gando</option></Select>
                    <Select value={step.workstream} onChange={value => updateStep(index, "workstream", value as StepWorkstream)}><option value="business">Business</option><option value="technical">Technique</option><option value="legal">Juridique</option><option value="procurement">Achats</option><option value="other">Autre</option></Select>
                  </div>
                </div>
                <div className="flex shrink-0 items-center opacity-60 transition group-hover:opacity-100"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStep(index, -1)} disabled={index === 0}><ChevronUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStep(index, 1)} disabled={index === content.milestones.length - 1}><ChevronDown className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeStep(index)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            </div>)}
            <Button variant="outline" className="w-full border-dashed" onClick={addStep}><Plus className="mr-2 h-4 w-4" />Ajouter une prochaine étape</Button>
          </div>
        </DocumentBlock>
      </Card>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground"><ListChecks className="h-4 w-4 text-primary" />Côté client, les décisions et points à trancher apparaissent au-dessus de la roadmap. Le SD01 reste uniquement la compréhension commune.</div>
    </div>
  </div>;
}
