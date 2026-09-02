"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  History,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DealRoomDetail } from "@/lib/deal-room-types";
import {
  createEmptySD01,
  type LinkedConversation,
  type SD01Content,
  type SD01NextStep,
  type SDDocumentRecord,
  type SDRoomRecord,
} from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type SourceSummary = {
  id: string;
  external_id?: string | null;
  title: string;
  source_type: string;
  characterCount: number;
  occurred_at: string | null;
};

type RoomResponse = {
  deal: DealRoomDetail;
  room: SDRoomRecord | null;
  documents: SDDocumentRecord[];
  sources: SourceSummary[];
  linkedConversations: LinkedConversation[];
};

type VersionRow = {
  id: string;
  version: number;
  content: SD01Content;
  source_refs: unknown[];
  model_name: string | null;
  prompt_version: string | null;
  created_by_email: string | null;
  change_summary: string | null;
  created_at: string;
};

function cleanContent(value: unknown, companyName = ""): SD01Content {
  const empty = createEmptySD01(companyName);
  const source = value && typeof value === "object" ? value as Partial<SD01Content> : {};
  return {
    ...empty,
    ...source,
    companyProfile: { ...empty.companyProfile, ...(source.companyProfile || {}) },
    stakeholders: Array.isArray(source.stakeholders) ? source.stakeholders : [],
    currentProcess: Array.isArray(source.currentProcess) ? source.currentProcess : [],
    productsAndOffers: Array.isArray(source.productsAndOffers) ? source.productsAndOffers : [],
    businessModel: Array.isArray(source.businessModel) ? source.businessModel : [],
    painPoints: Array.isArray(source.painPoints) ? source.painPoints : [],
    solutionFit: Array.isArray(source.solutionFit) ? source.solutionFit : [],
    roi: {
      valueLevers: Array.isArray(source.roi?.valueLevers) ? source.roi.valueLevers : [],
      // Missing metrics are not part of the collaborative SD01. We only keep metrics when a real value is known.
      metricsRequired: [],
    },
    urgency: Array.isArray(source.urgency) ? source.urgency : [],
    decisions: Array.isArray(source.decisions) ? source.decisions : [],
    openQuestions: Array.isArray(source.openQuestions) ? source.openQuestions : [],
    nextSteps: Array.isArray(source.nextSteps) ? source.nextSteps : [],
    evidence: Array.isArray(source.evidence) ? source.evidence : [],
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function textLines(values: string[]) {
  return values.join("\n");
}

function lines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

function Area({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />;
}

function SectionTitle({ icon: Icon, title, description, right }: { icon: typeof Target; title: string; description: string; right?: React.ReactNode }) {
  return <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
    <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div><h2 className="font-black tracking-[-0.02em]">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>
    {right ? <div className="shrink-0">{right}</div> : null}
  </div>;
}

export function SD01EnterpriseWorkspace({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [content, setContent] = useState<SD01Content>(() => createEmptySD01());
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const [manualTitle, setManualTitle] = useState("Note de réunion / compte rendu");
  const [manualTranscript, setManualTranscript] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/versions`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Historique indisponible");
      setVersions(payload.versions || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Historique indisponible");
    }
  }, [dealId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      if (payload.room?.room_mode === "standard") throw new Error("Ce SD01 est réservé aux Deals entreprise.");
      const next = payload as RoomResponse;
      setData(next);
      const sd01 = next.documents.find(document => document.code === "SD01");
      setContent(cleanContent(sd01?.content, next.room?.company_name || next.deal.company?.name || ""));
      setSelectedCalls((next.linkedConversations || []).filter(call => call.imported).map(call => call.id));
      await loadVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId, loadVersions]);

  useEffect(() => { void load(); }, [load]);

  const sd01 = data?.documents.find(document => document.code === "SD01");
  const companyName = data?.room?.company_name || data?.deal.company?.name || "Client";
  const dealName = data?.deal.name || data?.room?.title || "Deal entreprise";
  const openActions = content.nextSteps.filter(step => step.status !== "done");
  const confirmedMetrics = content.roi.valueLevers.filter(metric => metric.value.trim());
  const missingCore = useMemo(() => [
    !content.executiveSummary.trim() ? "Synthèse du besoin" : null,
    !content.painPoints.length ? "Enjeu / problème client" : null,
    !content.solutionFit.length ? "Proposition Gando" : null,
  ].filter(Boolean) as string[], [content.executiveSummary, content.painPoints.length, content.solutionFit.length]);
  const readyForNext = missingCore.length === 0;

  const update = <K extends keyof SD01Content>(key: K, value: SD01Content[K]) => setContent(current => ({ ...current, [key]: value }));

  async function save(publish = false) {
    setWorking(publish ? "publish" : "save");
    try {
      const cleaned: SD01Content = {
        ...content,
        roi: {
          valueLevers: content.roi.valueLevers.filter(metric => metric.value.trim()),
          metricsRequired: [],
        },
      };
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: publish ? "publish_sd01" : "save_sd01", content: cleaned }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setContent(cleanContent(payload.document?.content, companyName));
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD01" ? payload.document : document) } : current);
      await loadVersions();
      toast.success(publish ? "SD01 publié dans la Deal Room" : "SD01 enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setWorking(null);
    }
  }

  async function generateFromSources() {
    if (!selectedCalls.length && !manualTranscript.trim()) {
      toast.error("Sélectionne un enregistrement ou ajoute un compte rendu.");
      return;
    }
    setWorking("generate");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callIds: selectedCalls, manualTitle, manualTranscript }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Mise à jour impossible");
      const nextContent = cleanContent(payload.document?.content, companyName);
      setContent(nextContent);
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD01" ? { ...payload.document, content: nextContent } : document) } : current);
      setManualTranscript("");
      await load();
      toast.success(`SD01 mis à jour depuis ${payload.sourceCount} source(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    } finally {
      setWorking(null);
    }
  }

  async function restoreVersion(version: number) {
    if (!window.confirm(`Restaurer la version ${version} dans un nouveau brouillon ?`)) return;
    setWorking(`restore-${version}`);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Restauration impossible");
      setContent(cleanContent(payload.document?.content, companyName));
      await load();
      toast.success(`Version ${version} restaurée dans un nouveau brouillon`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restauration impossible");
    } finally {
      setWorking(null);
    }
  }

  function addSolutionFit() {
    update("solutionFit", [...content.solutionFit, { need: "", response: "" }]);
  }

  function addMetric() {
    update("roi", { ...content.roi, valueLevers: [...content.roi.valueLevers, { lever: "", mechanism: "", value: "" }] });
  }

  function addAction() {
    update("nextSteps", [...content.nextSteps, { owner: "", action: "", dueDate: null, status: "not_started" }]);
  }

  function patchAction(index: number, patch: Partial<SD01NextStep>) {
    update("nextSteps", content.nextSteps.map((step, position) => position === index ? { ...step, ...patch } : step));
  }

  if (loading && !data) return <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><div className="mt-3 text-sm text-muted-foreground">Chargement du cadrage…</div></div></div>;
  if (!data?.room) return <div className="p-6"><Card className="mx-auto max-w-xl p-8 text-center"><div className="font-bold">SD01 indisponible</div><Button className="mt-4" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Réessayer</Button></Card></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1280px] space-y-5">
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-primary/[0.09] via-background to-background p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">SD01 · Cadrage collaboratif</div>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">{dealName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{companyName} · Le SD01 sert à obtenir ce qu’il faut pour construire la suite, pas à remplir un dossier.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">V{sd01?.version || 1}</Badge>
              <Badge variant="outline" className={readyForNext ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}>{readyForNext ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}{readyForNext ? "Cadrage exploitable" : `${missingCore.length} élément(s) structurant(s) manquant(s)`}</Badge>
              {openActions.length ? <Badge variant="outline">{openActions.length} action(s) ouverte(s)</Badge> : null}
              {confirmedMetrics.length ? <Badge variant="outline" className="border-primary/25 text-primary">{confirmedMetrics.length} métrique(s) confirmée(s)</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void save(false)} disabled={Boolean(working)}>{working === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Enregistrer</Button>
            <Button onClick={() => void save(true)} disabled={Boolean(working) || !content.executiveSummary.trim()}>{working === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Publier au client</Button>
          </div>
        </div>

        <div className={cn("mt-5 rounded-2xl border p-4", readyForNext ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-amber-500/20 bg-amber-500/[0.06]") }>
          <div className="flex items-start gap-3"><div className={cn("mt-0.5 rounded-full p-1", readyForNext ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700")}>{readyForNext ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="text-sm font-black">{readyForNext ? "Le cadrage permet d’avancer vers SD02" : "À compléter avant d’avoir un cadrage solide"}</div>{missingCore.length ? <div className="mt-2 flex flex-wrap gap-2">{missingCore.map(item => <span key={item} className="rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold">{item}</span>)}</div> : <p className="mt-1 text-xs text-muted-foreground">Les métriques restent facultatives : aucun chiffre n’est requis pour avancer s’il n’est pas confirmé.</p>}</div></div>
        </div>
      </div>
    </Card>

    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <Card className="overflow-hidden p-0">
        <SectionTitle icon={Target} title="1. Ce qu’on sait" description="Le minimum utile pour partager une compréhension commune du deal." />
        <div className="space-y-5 p-5 sm:p-6">
          <div><Label>Synthèse du besoin</Label><p className="mt-1 text-[11px] text-muted-foreground">Problème, enjeu, décision attendue. Lecture en moins d’une minute.</p><div className="mt-2"><Area value={content.executiveSummary} onChange={value => update("executiveSummary", value)} rows={6} placeholder="Aujourd’hui…, le client cherche à…, la décision attendue est…" /></div></div>
          <div><Label>Enjeux / irritants</Label><p className="mt-1 text-[11px] text-muted-foreground">Une ligne : enjeu | détail</p><div className="mt-2"><Area value={content.painPoints.map(item => `${item.title}${item.details.length ? ` | ${item.details.join(" ; ")}` : ""}`).join("\n")} onChange={value => update("painPoints", lines(value).map((row, index) => { const [title = "", detail = ""] = row.split("|").map(part => part.trim()); return { priority: index + 1, title, details: detail ? detail.split(";").map(part => part.trim()).filter(Boolean) : [] }; }))} rows={6} placeholder={'Préautorisation répétée | friction opérationnelle\nPouvoir d’achat immobilisé | impact expérience locataire'} /></div></div>
          <div><Label>Interlocuteurs clés</Label><p className="mt-1 text-[11px] text-muted-foreground">Une ligne : nom | fonction | organisation | note</p><div className="mt-2"><Area value={content.stakeholders.map(item => [item.name, item.role, item.organization, item.notes].join(" | ")).join("\n")} onChange={value => update("stakeholders", lines(value).map(row => { const [name = "", role = "", organization = "", notes = ""] = row.split("|").map(part => part.trim()); return { name, role, organization, notes }; }))} rows={5} /></div></div>

          <button type="button" onClick={() => setShowContext(value => !value)} className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 text-left text-sm font-bold hover:bg-muted/40"><span>Contexte secondaire</span><ChevronDown className={cn("h-4 w-4 transition-transform", showContext && "rotate-180")} /></button>
          {showContext ? <div className="space-y-4 rounded-xl border border-border bg-muted/10 p-4">
            <div className="grid gap-3 md:grid-cols-3"><div><Label>Secteur</Label><Input className="mt-2" value={content.companyProfile.sector} onChange={event => update("companyProfile", { ...content.companyProfile, sector: event.target.value })} /></div><div><Label>Présentation</Label><Input className="mt-2" value={content.companyProfile.description} onChange={event => update("companyProfile", { ...content.companyProfile, description: event.target.value })} /></div><div><Label>Contexte</Label><Input className="mt-2" value={content.companyProfile.context} onChange={event => update("companyProfile", { ...content.companyProfile, context: event.target.value })} /></div></div>
            <div><Label>Process actuel</Label><div className="mt-2"><Area value={textLines(content.currentProcess)} onChange={value => update("currentProcess", lines(value))} rows={4} /></div></div>
            <div className="grid gap-4 md:grid-cols-2"><div><Label>Décisions déjà prises</Label><div className="mt-2"><Area value={textLines(content.decisions)} onChange={value => update("decisions", lines(value))} rows={4} /></div></div><div><Label>Questions ouvertes</Label><div className="mt-2"><Area value={textLines(content.openQuestions)} onChange={value => update("openQuestions", lines(value))} rows={4} /></div></div></div>
          </div> : null}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <SectionTitle icon={Sparkles} title="2. Mini-propal · Solution fit" description="Transformer le besoin identifié en proposition Gando. Les chiffres ne sont affichés que s’ils sont réellement connus." right={<Button size="sm" variant="outline" onClick={addSolutionFit}><Plus className="mr-1.5 h-3.5 w-3.5" />Ajouter</Button>} />
        <div className="space-y-4 p-5 sm:p-6">
          {!content.solutionFit.length ? <div className="rounded-xl border border-dashed border-border bg-muted/15 p-6 text-center"><div className="text-sm font-bold">Aucune proposition structurée</div><p className="mt-1 text-xs text-muted-foreground">Ajoute un besoin client et la réponse Gando proposée.</p><Button className="mt-4" size="sm" onClick={addSolutionFit}><Plus className="mr-2 h-4 w-4" />Créer le premier bloc</Button></div> : null}
          {content.solutionFit.map((item, index) => <div key={index} className="rounded-2xl border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-primary">Proposition {index + 1}</span><Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => update("solutionFit", content.solutionFit.filter((_, position) => position !== index))}><Trash2 className="h-3.5 w-3.5" /></Button></div>
            <div className="space-y-3"><div><Label>Besoin / enjeu client</Label><Input className="mt-2" value={item.need} onChange={event => update("solutionFit", content.solutionFit.map((row, position) => position === index ? { ...row, need: event.target.value } : row))} placeholder="Ce que le client doit résoudre" /></div><div><Label>Proposition Gando</Label><div className="mt-2"><Area value={item.response} onChange={value => update("solutionFit", content.solutionFit.map((row, position) => position === index ? { ...row, response: value } : row))} rows={4} placeholder="Comment Gando répond concrètement à ce besoin…" /></div></div></div>
          </div>)}

          <div className="border-t border-border pt-4">
            <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black">Métriques confirmées <span className="font-medium text-muted-foreground">· optionnel</span></div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Si aucun chiffre fiable n’est disponible, cette partie reste vide. Aucune métrique n’est nécessaire pour passer à l’étape suivante.</p></div><Button size="sm" variant="outline" onClick={addMetric}><Plus className="mr-1.5 h-3.5 w-3.5" />Métrique</Button></div>
            <div className="mt-4 space-y-3">{content.roi.valueLevers.map((metric, index) => <div key={index} className="grid gap-2 rounded-xl border border-primary/15 bg-primary/[0.03] p-3 md:grid-cols-[1fr_150px_1.25fr_auto]"><Input value={metric.lever} onChange={event => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((row, position) => position === index ? { ...row, lever: event.target.value } : row) })} placeholder="Métrique / levier" /><Input value={metric.value} onChange={event => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((row, position) => position === index ? { ...row, value: event.target.value } : row) })} placeholder="Valeur confirmée" /><Input value={metric.mechanism} onChange={event => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((row, position) => position === index ? { ...row, mechanism: event.target.value } : row) })} placeholder="Pourquoi cela compte" /><Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.filter((_, position) => position !== index) })}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>
          </div>
        </div>
      </Card>
    </div>

    <Card className="overflow-hidden p-0">
      <SectionTitle icon={CheckCircle2} title="3. Éléments à obtenir / transmettre" description="Chaque élément a un responsable, une échéance et un statut. C’est ici que le deal avance réellement." right={<Button size="sm" variant="outline" onClick={addAction}><Plus className="mr-1.5 h-3.5 w-3.5" />Ajouter</Button>} />
      <div className="p-5 sm:p-6">
        {!content.nextSteps.length ? <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aucun élément ouvert. Ajoute les informations, validations ou documents nécessaires pour faire avancer le deal.</div> : <div className="space-y-2">{content.nextSteps.map((step, index) => <div key={index} className={cn("grid gap-2 rounded-xl border p-3 lg:grid-cols-[44px_minmax(260px,1fr)_180px_150px_auto] lg:items-center", step.status === "done" ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-border bg-background")}>
          <button type="button" onClick={() => patchAction(index, { status: step.status === "done" ? "not_started" : "done" })} className={cn("grid h-9 w-9 place-items-center rounded-full border", step.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}>{step.status === "done" ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</button>
          <Input value={step.action} onChange={event => patchAction(index, { action: event.target.value })} placeholder="Ex. transmettre le volume annuel de cautions" />
          <Input value={step.owner} onChange={event => patchAction(index, { owner: event.target.value })} placeholder="Responsable" />
          <Input type="date" value={step.dueDate || ""} onChange={event => patchAction(index, { dueDate: event.target.value || null })} />
          <div className="flex gap-1"><select value={step.status} onChange={event => patchAction(index, { status: event.target.value as SD01NextStep["status"] })} className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-semibold"><option value="not_started">À faire</option><option value="in_progress">En cours</option><option value="done">Fait</option></select><Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => update("nextSteps", content.nextSteps.filter((_, position) => position !== index))}><Trash2 className="h-3.5 w-3.5" /></Button></div>
        </div>)}</div>}
      </div>
    </Card>

    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <Card className="overflow-hidden p-0">
        <SectionTitle icon={MessageSquareText} title="4. Conversations & enregistrements" description="Reprends les anciens appels déjà utilisés ou ajoute un nouvel échange pour enrichir le SD01." />
        <div className="space-y-5 p-5 sm:p-6">
          {data.linkedConversations?.length ? <div><div className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Appels reliés au deal</div><div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">{data.linkedConversations.map(call => { const checked = selectedCalls.includes(call.id); return <button key={call.id} type="button" onClick={() => setSelectedCalls(current => checked ? current.filter(id => id !== call.id) : [...current, call.id])} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition", checked ? "border-primary bg-primary/[0.05]" : "border-border hover:border-primary/30")}><div className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border", checked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{checked ? <Check className="h-3.5 w-3.5" /> : null}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{call.title}</span>{call.imported ? <Badge variant="outline" className="text-[10px]">Déjà utilisé</Badge> : null}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{call.transcriptText || "Transcription disponible"}</div></div></button>; })}</div></div> : null}

          {data.sources?.length ? <div><div className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Sources déjà conservées</div><div className="flex flex-wrap gap-2">{data.sources.map(source => <Badge key={source.id} variant="outline">{source.title}</Badge>)}</div></div> : null}

          <div className="rounded-xl border border-border bg-muted/15 p-4"><Label>Ajouter une note ou un compte rendu</Label><Input className="mt-2" value={manualTitle} onChange={event => setManualTitle(event.target.value)} placeholder="Titre de la source" /><div className="mt-2"><Area value={manualTranscript} onChange={setManualTranscript} rows={6} placeholder="Colle ici un compte rendu, un extrait d’email ou une transcription…" /></div></div>
          <Button onClick={() => void generateFromSources()} disabled={Boolean(working) || (!selectedCalls.length && !manualTranscript.trim())}>{working === "generate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Mettre à jour SD01 depuis les sources</Button>
          <p className="text-[11px] leading-5 text-muted-foreground">La génération conserve une nouvelle version. Elle n’invente aucun chiffre : les métriques non confirmées sont retirées du workspace.</p>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <SectionTitle icon={History} title="5. Historique des versions" description="Consulte et restaure un ancien état du SD01 sans écraser l’historique." right={<Button size="sm" variant="ghost" onClick={() => void loadVersions()}><RefreshCw className="h-3.5 w-3.5" /></Button>} />
        <div className="max-h-[620px] space-y-2 overflow-y-auto p-5 sm:p-6">
          {!versions.length ? <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">L’historique apparaîtra après le premier enregistrement.</div> : versions.map(version => { const preview = previewVersion === version.version; const versionContent = cleanContent(version.content, companyName); return <div key={version.id} className="rounded-xl border border-border bg-background p-3"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-black">V{version.version}</div><div className="min-w-0 flex-1"><div className="text-sm font-bold">{version.change_summary || "Mise à jour SD01"}</div><div className="mt-1 text-[11px] text-muted-foreground">{formatDate(version.created_at)}{version.created_by_email ? ` · ${version.created_by_email}` : ""}</div></div><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setPreviewVersion(preview ? null : version.version)}>Voir</Button><Button size="sm" variant="outline" onClick={() => void restoreVersion(version.version)} disabled={Boolean(working)}>{working === `restore-${version.version}` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}Restaurer</Button></div></div>{preview ? <div className="mt-3 rounded-lg bg-muted/30 p-3"><div className="text-xs font-bold">Synthèse</div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{versionContent.executiveSummary || "—"}</p>{versionContent.solutionFit.length ? <div className="mt-3 space-y-1">{versionContent.solutionFit.slice(0, 4).map((fit, index) => <div key={index} className="text-xs"><span className="font-semibold">{fit.need || "Besoin"}</span><span className="text-muted-foreground"> → {fit.response || "—"}</span></div>)}</div> : null}</div> : null}</div>; })}
        </div>
      </Card>
    </div>
  </div></div>;
}
