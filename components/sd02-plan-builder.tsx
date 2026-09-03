"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, FileText, ListChecks, Loader2, Plus, Save, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MutualActionItem, SD02Content } from "@/lib/sd-stage-content";
import { createEmptySD02 } from "@/lib/sd-stage-content";
import type { SDDocumentRecord } from "@/lib/sd-room-types";

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

function lines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

function textLines(value: string[]) {
  return value.join("\n");
}

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

function normalizeContent(value: unknown): SD02Content {
  const stored = value && typeof value === "object" ? value as Partial<SD02Content> : {};
  return {
    ...createEmptySD02(),
    ...stored,
    decisionProcess: Array.isArray(stored.decisionProcess) ? stored.decisionProcess : [],
    blockers: Array.isArray(stored.blockers) ? stored.blockers : [],
    milestones: Array.isArray(stored.milestones) ? stored.milestones.map(normalizeStep) : [],
    clientCommitments: Array.isArray(stored.clientCommitments) ? stored.clientCommitments : [],
    gandoCommitments: Array.isArray(stored.gandoCommitments) ? stored.gandoCommitments : [],
    dependencies: Array.isArray(stored.dependencies) ? stored.dependencies : [],
    risks: Array.isArray(stored.risks) ? stored.risks : [],
    exitCriteria: Array.isArray(stored.exitCriteria) ? stored.exitCriteria : [],
  };
}

function hasWork(content: SD02Content) {
  return Boolean(
    content.objective.trim() ||
    content.workingNotes.trim() ||
    content.decisionProcess.length ||
    content.blockers.length ||
    content.milestones.length ||
    content.clientCommitments.length ||
    content.gandoCommitments.length ||
    content.dependencies.length ||
    content.risks.length ||
    content.exitCriteria.length
  );
}

function upsertDocument(documents: SDDocumentRecord[], next: SDDocumentRecord) {
  const exists = documents.some(document => document.code === next.code);
  return exists ? documents.map(document => document.code === next.code ? next : document) : [...documents, next];
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium outline-none focus:border-primary">{children}</select>;
}

function FreeTextarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (value: string) => void; placeholder: string; rows?: number }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-0" />;
}

function DocumentBlock({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="border-b border-border/70 px-6 py-6 last:border-0 sm:px-9">
    <div className="mb-4 flex items-start justify-between gap-4">
      <div><h2 className="text-[17px] font-bold tracking-[-0.02em]">{title}</h2>{description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}</div>
      {action}
    </div>
    {children}
  </section>;
}

export function SD02PlanBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [content, setContent] = useState<SD02Content>(() => createEmptySD02());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoGenerated, setAutoGenerated] = useState(false);

  const applyGeneratedDocument = useCallback((roomPayload: RoomResponse, document: SDDocumentRecord) => {
    setData({ ...roomPayload, documents: upsertDocument(roomPayload.documents, document) });
    setContent(normalizeContent(document.content));
    setAutoGenerated(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setAutoGenerated(false);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json() as RoomResponse & { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");

      const document = payload.documents.find(item => item.code === "SD02");
      const sd01 = payload.documents.find(item => item.code === "SD01");
      const next = normalizeContent(document?.content);
      setData(payload);
      setContent(next);

      if (!hasWork(next) && sd01 && document?.status !== "validated") {
        setGenerating(true);
        try {
          const generatedResponse = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/generate-sd02`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ force: false }),
          });
          const generatedPayload = await generatedResponse.json();
          if (generatedResponse.ok && generatedPayload.document) {
            applyGeneratedDocument(payload, generatedPayload.document as SDDocumentRecord);
          }
        } finally {
          setGenerating(false);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId, applyGeneratedDocument]);

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

  const regenerate = async () => {
    if (sd02?.status === "validated") return;
    if (content.milestones.length && !window.confirm("Remplacer les prochaines étapes actuelles par une nouvelle proposition générée depuis SD01 ?")) return;
    setGenerating(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/generate-sd02`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Génération impossible");
      if (!payload.document) throw new Error("Aucun SD02 généré.");
      const document = payload.document as SDDocumentRecord;
      setData(current => current ? { ...current, documents: upsertDocument(current.documents, document) } : current);
      setContent(normalizeContent(document.content));
      setAutoGenerated(true);
      toast.success(`${payload.count || document.content ? "Next steps générées depuis SD01" : "SD02 mis à jour"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Génération impossible");
    } finally {
      setGenerating(false);
    }
  };

  const save = async (publish: boolean) => {
    const cleaned: SD02Content = {
      ...content,
      milestones: content.milestones.map(normalizeStep).filter(step => step.milestone.trim()),
    };
    if (!hasWork(cleaned)) {
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
      const document = payload.document as SDDocumentRecord;
      setData(current => current ? { ...current, documents: upsertDocument(current.documents, document) } : current);
      setContent(normalizeContent(document.content));
      setAutoGenerated(false);
      toast.success(publish ? "Prochaines étapes publiées" : "Document enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setWorking(false);
    }
  };

  if (loading && !data) {
    return <div className="grid min-h-[50vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Chargement du plan d’action…</p></div></div>;
  }

  return <div className="min-h-screen bg-muted/20 px-4 py-6 lg:px-7 lg:py-8">
    <div className="mx-auto max-w-[1040px] space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">SD02 · Prochaines étapes</div>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">Décisions & plan d’action</h1>
          <p className="mt-1 text-sm text-muted-foreground">Les prochaines étapes sont proposées automatiquement depuis le SD01, puis restent entièrement modifiables.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{completed}/{content.milestones.length} terminé{completed > 1 ? "s" : ""}</Badge>
          {(autoGenerated || sd02?.source_mode === "agent" || sd02?.source_mode === "mixed") && content.milestones.length ? <Badge variant="outline" className="border-primary/30 text-primary"><Sparkles className="mr-1 h-3.5 w-3.5" />Généré depuis SD01</Badge> : null}
          {sd02?.status === "validated" ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Validé client</Badge> : null}
          <Button variant="outline" onClick={() => void regenerate()} disabled={working || generating || sd02?.status === "validated"}>{generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Régénérer</Button>
          <Button variant="outline" onClick={() => void save(false)} disabled={working || generating}><Save className="mr-2 h-4 w-4" />Enregistrer</Button>
          <Button onClick={() => void save(true)} disabled={working || generating}><Send className="mr-2 h-4 w-4" />Publier</Button>
        </div>
      </div>

      {generating ? <Card className="border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-3"><Loader2 className="h-4 w-4 animate-spin text-primary" /><div><div className="text-sm font-bold">Génération des prochaines étapes</div><div className="text-xs text-muted-foreground">Analyse du SD01 : métriques à confirmer, points ouverts, Solution Fit, processus et parties prenantes.</div></div></div></Card> : null}

      <Card className="overflow-hidden border-border/80 bg-card p-0 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-muted/25 px-6 py-4 sm:px-9">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div>
          <div><div className="text-sm font-bold">Document de travail</div><div className="text-[11px] text-muted-foreground">Les suggestions sont un brouillon : aucune date ni aucun responsable n’est inventé.</div></div>
        </div>

        <DocumentBlock title="Objectif partagé" description="Une phrase suffit. Quel résultat concret cherchez-vous à atteindre ensemble ?">
          <FreeTextarea value={content.objective} onChange={value => update("objective", value)} rows={3} placeholder="Ex. Valider un pilote opérationnel sur 3 agences…" />
        </DocumentBlock>

        <DocumentBlock title="Décisions actées" description="Une décision par ligne. Les décisions historiques du SD01 sont reprises lors de la première génération.">
          <FreeTextarea value={textLines(content.decisionProcess)} onChange={value => update("decisionProcess", lines(value))} rows={4} placeholder={"Pilote validé sur Marseille\nCaution cible : 1 000 €"} />
        </DocumentBlock>

        <DocumentBlock title="Points à trancher" description="Questions encore ouvertes ou éléments nécessaires avant la prochaine décision.">
          <FreeTextarea value={textLines(content.blockers)} onChange={value => update("blockers", lines(value))} rows={4} placeholder={"Valider le volume mensuel cible\nConfirmer le périmètre juridique"} />
        </DocumentBlock>

        <DocumentBlock
          title="Prochaines étapes"
          description="Générées automatiquement depuis le SD01 si le SD02 est vide. Tu peux modifier, supprimer, réordonner ou compléter chaque action."
          action={<Button type="button" size="sm" variant="outline" onClick={addStep}><Plus className="mr-1 h-3.5 w-3.5" />Ajouter</Button>}
        >
          <div className="space-y-3">
            {content.milestones.map((step, index) => <div key={index} className="group rounded-xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <Input value={step.milestone} onChange={event => updateStep(index, "milestone", event.target.value)} placeholder="Décrire la prochaine étape…" className="h-auto border-0 bg-transparent p-0 text-[15px] font-semibold shadow-none focus-visible:ring-0" />
                  <textarea value={step.dependency} onChange={event => updateStep(index, "dependency", event.target.value)} rows={2} placeholder="Pourquoi cette étape / dépendance éventuelle…" className="mt-2 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground/50" />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input value={step.owner} onChange={event => updateStep(index, "owner", event.target.value)} placeholder="Responsable" className="h-9 w-36 text-xs" />
                    <Input type="date" value={step.dueDate} onChange={event => updateStep(index, "dueDate", event.target.value)} className="h-9 w-40 text-xs" />
                    <Select value={step.status} onChange={value => updateStep(index, "status", value as StepStatus)}><option value="not_started">À faire</option><option value="in_progress">En cours</option><option value="done">Terminé</option></Select>
                    <Select value={step.organization} onChange={value => updateStep(index, "organization", value as StepOrganization)}><option value="joint">Commun</option><option value="client">Client</option><option value="gando">Gando</option></Select>
                    <Select value={step.workstream} onChange={value => updateStep(index, "workstream", value as StepWorkstream)}><option value="business">Business</option><option value="technical">Technique</option><option value="legal">Juridique</option><option value="procurement">Achats</option><option value="other">Autre</option></Select>
                  </div>
                </div>
                <div className="flex shrink-0 items-center opacity-60 transition group-hover:opacity-100">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStep(index, -1)} disabled={index === 0}><ChevronUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStep(index, 1)} disabled={index === content.milestones.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeStep(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>)}

            {!content.milestones.length && !generating ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><ListChecks className="mx-auto h-6 w-6 text-muted-foreground" /><div className="mt-3 text-sm font-bold">Aucune prochaine étape</div><p className="mt-1 text-xs text-muted-foreground">Complète le SD01 puis clique sur Régénérer, ou ajoute une étape manuellement.</p><Button className="mt-4" size="sm" variant="outline" onClick={() => void regenerate()}><Sparkles className="mr-2 h-4 w-4" />Générer depuis SD01</Button></div> : null}
          </div>
        </DocumentBlock>

        <DocumentBlock title="Notes de travail" description="Zone libre pour conserver du contexte ou un compte rendu sans devoir le ranger immédiatement.">
          <FreeTextarea value={content.workingNotes} onChange={value => update("workingNotes", value)} rows={6} placeholder="Écris librement ici, comme dans un document partagé…" />
        </DocumentBlock>
      </Card>
    </div>
  </div>;
}
