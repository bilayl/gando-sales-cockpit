"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  CircleHelp,
  Clock3,
  Eye,
  History,
  ListChecks,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
  Workflow,
  Zap,
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
  type SDRoomAnalytics,
  type SDRoomComment,
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
  analytics?: SDRoomAnalytics;
  comments?: SDRoomComment[];
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

type EditorSection = "essential" | "context" | "decision";

const EMPTY_ANALYTICS: SDRoomAnalytics = { opens: 0, uniqueVisitors: 0, activeSeconds: 0, lastViewedAt: null, recentVisitors: [] };

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
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return `${seconds} s`;
}

function lines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

function textLines(values: string[]) {
  return values.join("\n");
}

function Area({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" />;
}

function Block({ icon, title, description, action, children }: { icon: ReactNode; title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <Card className="overflow-hidden p-0">
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
        <div className="min-w-0"><h2 className="font-black tracking-[-0.02em]">{title}</h2>{description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    <div className="p-5">{children}</div>
  </Card>;
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">{children}</div>;
}

export function SD01EnterpriseWorkspace({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [content, setContent] = useState<SD01Content>(() => createEmptySD01());
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const [manualTitle, setManualTitle] = useState("Note de réunion / compte rendu");
  const [manualTranscript, setManualTranscript] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [section, setSection] = useState<EditorSection>("essential");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

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
      setAllowlist(next.room?.allowed_emails?.join("\n") || "");
      await loadVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId, loadVersions]);

  useEffect(() => { void load(); }, [load]);

  const room = data?.room;
  const sd01 = data?.documents.find(document => document.code === "SD01");
  const companyName = room?.company_name || data?.deal.company?.name || "Client";
  const dealName = data?.deal.name || room?.title || "Deal entreprise";
  const analytics = data?.analytics || EMPTY_ANALYTICS;
  const comments = data?.comments || [];
  const confirmedMetrics = content.roi.valueLevers.filter(metric => metric.value.trim());
  const openActions = content.nextSteps.filter(step => step.status !== "done");
  const missingCore = useMemo(() => [
    !content.executiveSummary.trim() ? "Synthèse" : null,
    !content.painPoints.some(item => item.title.trim()) ? "Enjeux" : null,
    !content.solutionFit.some(item => item.need.trim() && item.response.trim()) ? "Solution fit" : null,
  ].filter(Boolean) as string[], [content.executiveSummary, content.painPoints, content.solutionFit]);
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
      setData(current => current ? {
        ...current,
        documents: current.documents.map(document => document.code === "SD01" ? payload.document : document),
        room: publish && current.room ? { ...current.room, status: "published", current_stage: "SD01", published_at: new Date().toISOString() } : current.room,
      } : current);
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
      toast.error("Sélectionne un échange ou ajoute une note.");
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
      setContent(cleanContent(payload.document?.content, companyName));
      setManualTranscript("");
      await load();
      toast.success(`SD01 mis à jour depuis ${payload.sourceCount} source(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    } finally {
      setWorking(null);
    }
  }

  async function saveAccess() {
    if (!room) return;
    setWorking("access");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "settings", accessMode: room.access_mode, allowedEmails: lines(allowlist) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Réglage impossible");
      setData(current => current ? { ...current, room: payload.room } : current);
      toast.success("Accès client mis à jour");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Réglage impossible");
    } finally {
      setWorking(null);
    }
  }

  async function resolveComment(commentId: string) {
    setWorking(`comment:${commentId}`);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resolve_comment", commentId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Traitement impossible");
      setData(current => current ? { ...current, comments: (current.comments || []).map(comment => comment.id === commentId ? payload.comment : comment) } : current);
      toast.success("Remarque traitée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Traitement impossible");
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
      await loadVersions();
      toast.success(`Version ${version} restaurée`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restauration impossible");
    } finally {
      setWorking(null);
    }
  }

  function addPainPoint() {
    update("painPoints", [...content.painPoints, { priority: content.painPoints.length + 1, title: "", details: [] }]);
  }

  function addSolutionFit() {
    update("solutionFit", [...content.solutionFit, { need: "", response: "" }]);
  }

  function addMetric() {
    update("roi", { ...content.roi, valueLevers: [...content.roi.valueLevers, { lever: "", mechanism: "", value: "" }] });
  }

  function addStakeholder() {
    update("stakeholders", [...content.stakeholders, { name: "", role: "", organization: "", notes: "" }]);
  }

  function addAction() {
    update("nextSteps", [...content.nextSteps, { owner: "", action: "", dueDate: null, status: "not_started" }]);
  }

  function patchAction(index: number, patch: Partial<SD01NextStep>) {
    update("nextSteps", content.nextSteps.map((step, position) => position === index ? { ...step, ...patch } : step));
  }

  if (loading && !data) return <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><div className="mt-3 text-sm text-muted-foreground">Chargement du SD01…</div></div></div>;
  if (!room || !data) return <div className="p-6"><Card className="mx-auto max-w-xl p-8 text-center"><div className="font-bold">SD01 indisponible</div><Button className="mt-4" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Réessayer</Button></Card></div>;

  const setAccessMode = (mode: "email" | "allowlist") => setData(current => current && current.room ? { ...current, room: { ...current.room, access_mode: mode } } : current);

  return <div className="page-shell min-h-screen p-5 lg:p-7">
    <div className="mx-auto max-w-[1500px] space-y-5">
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary/[0.08] via-background to-background p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">SD01 · Synthèse</div>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">{dealName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{companyName} · Toutes les anciennes thématiques, organisées en blocs simples.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">V{sd01?.version || 1}</Badge>
                <Badge variant="outline" className={readyForNext ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}>{readyForNext ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}{readyForNext ? "Synthèse exploitable" : `À compléter : ${missingCore.join(", ")}`}</Badge>
                {confirmedMetrics.length ? <Badge variant="outline">{confirmedMetrics.length} métrique(s) confirmée(s)</Badge> : null}
                {openActions.length ? <Badge variant="outline">{openActions.length} action(s) ouverte(s)</Badge> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void save(false)} disabled={Boolean(working)}>{working === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Enregistrer</Button>
              <Button onClick={() => void save(true)} disabled={Boolean(working) || !content.executiveSummary.trim()}>{working === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Publier</Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-border px-5 py-3">
          {([
            ["essential", "Essentiel"],
            ["context", "Contexte entreprise"],
            ["decision", "Décision & suite"],
          ] as Array<[EditorSection, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setSection(value)} className={cn("shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition", section === value ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground")}>{label}</button>)}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-5">
          {section === "essential" ? <>
            <Block icon={<Target className="h-4 w-4" />} title="Synthèse exécutive" description="Le contexte et l’enjeu principal en quelques lignes.">
              <Area value={content.executiveSummary} onChange={value => update("executiveSummary", value)} rows={5} placeholder="Contexte, enjeu principal, valeur attendue et décision à prendre…" />
            </Block>

            <Block icon={<Zap className="h-4 w-4" />} title="Pain points" description="Les problèmes réellement exprimés par le client." action={<Button variant="outline" size="sm" onClick={addPainPoint}><Plus className="mr-1 h-3.5 w-3.5" /> Ajouter</Button>}>
              <div className="space-y-3">
                {content.painPoints.map((item, index) => <div key={index} className="rounded-xl border border-border bg-muted/15 p-4">
                  <div className="flex items-start gap-3"><div className="min-w-0 flex-1 space-y-2"><Input value={item.title} onChange={event => update("painPoints", content.painPoints.map((point, position) => position === index ? { ...point, title: event.target.value } : point))} placeholder="Problème / enjeu" /><Area value={textLines(item.details)} onChange={value => update("painPoints", content.painPoints.map((point, position) => position === index ? { ...point, details: lines(value) } : point))} rows={2} placeholder="Précisions — une ligne par élément" /></div><Button variant="ghost" size="sm" onClick={() => update("painPoints", content.painPoints.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button></div>
                </div>)}
                {!content.painPoints.length ? <EmptyLine>Ajoute uniquement les enjeux réellement identifiés.</EmptyLine> : null}
              </div>
            </Block>

            <Block icon={<Sparkles className="h-4 w-4" />} title="Correspondance solution / Solution fit" description="Mini-propal : besoin client → réponse Gando." action={<Button variant="outline" size="sm" onClick={addSolutionFit}><Plus className="mr-1 h-3.5 w-3.5" /> Ajouter</Button>}>
              <div className="space-y-3">
                {content.solutionFit.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-border bg-muted/15 p-4 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-start">
                  <div><Label className="text-[11px] text-muted-foreground">Besoin client</Label><Area value={item.need} onChange={value => update("solutionFit", content.solutionFit.map((fit, position) => position === index ? { ...fit, need: value } : fit))} rows={3} placeholder="Ce que le client cherche à résoudre" /></div>
                  <div className="hidden pt-8 text-primary lg:block">→</div>
                  <div><Label className="text-[11px] text-muted-foreground">Proposition Gando</Label><Area value={item.response} onChange={value => update("solutionFit", content.solutionFit.map((fit, position) => position === index ? { ...fit, response: value } : fit))} rows={3} placeholder="La réponse proposée" /></div>
                  <Button variant="ghost" size="sm" className="mt-5" onClick={() => update("solutionFit", content.solutionFit.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button>
                </div>)}
                {!content.solutionFit.length ? <EmptyLine>Ajoute un besoin et la réponse Gando correspondante.</EmptyLine> : null}
              </div>
            </Block>

            <Block icon={<CircleDollarSign className="h-4 w-4" />} title="Leviers de valeur / ROI" description="Facultatif. Ne renseigne une métrique que si une valeur est confirmée." action={<Button variant="outline" size="sm" onClick={addMetric}><Plus className="mr-1 h-3.5 w-3.5" /> Ajouter une métrique</Button>}>
              <div className="space-y-3">
                {content.roi.valueLevers.map((metric, index) => <div key={index} className="grid gap-3 rounded-xl border border-border bg-muted/15 p-4 md:grid-cols-[1fr_1.4fr_0.8fr_auto] md:items-end">
                  <div><Label className="text-[11px] text-muted-foreground">Levier</Label><Input value={metric.lever} onChange={event => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((item, position) => position === index ? { ...item, lever: event.target.value } : item) })} placeholder="Ex. conversion" /></div>
                  <div><Label className="text-[11px] text-muted-foreground">Mécanisme</Label><Input value={metric.mechanism} onChange={event => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((item, position) => position === index ? { ...item, mechanism: event.target.value } : item) })} placeholder="Pourquoi cela crée de la valeur" /></div>
                  <div><Label className="text-[11px] text-muted-foreground">Valeur confirmée</Label><Input value={metric.value} onChange={event => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((item, position) => position === index ? { ...item, value: event.target.value } : item) })} placeholder="Ex. 12 %" /></div>
                  <Button variant="ghost" size="sm" onClick={() => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.filter((_, position) => position !== index) })}><Trash2 className="h-4 w-4" /></Button>
                </div>)}
                {!content.roi.valueLevers.length ? <EmptyLine>Aucune métrique ? Laisse ce bloc vide. Cela ne bloque pas la suite.</EmptyLine> : null}
              </div>
            </Block>
          </> : null}

          {section === "context" ? <>
            <Block icon={<Building2 className="h-4 w-4" />} title="Présentation de l’entreprise" description="Secteur, activité et contexte du compte.">
              <div className="grid gap-4 md:grid-cols-2"><div><Label>Secteur</Label><Input className="mt-2" value={content.companyProfile.sector} onChange={event => update("companyProfile", { ...content.companyProfile, sector: event.target.value })} placeholder="Location automobile…" /></div><div><Label>Présentation</Label><Input className="mt-2" value={content.companyProfile.description} onChange={event => update("companyProfile", { ...content.companyProfile, description: event.target.value })} placeholder="Activité, taille, périmètre…" /></div></div>
              <div className="mt-4"><Label>Contexte</Label><Area value={content.companyProfile.context} onChange={value => update("companyProfile", { ...content.companyProfile, context: value })} rows={3} placeholder="Contexte commercial actuel" /></div>
            </Block>

            <Block icon={<BriefcaseBusiness className="h-4 w-4" />} title="Contexte Gando" description="Pourquoi cette discussion existe et où Gando intervient."><Area value={content.gandoContext} onChange={value => update("gandoContext", value)} rows={4} placeholder="Origine de l’échange, attente vis-à-vis de Gando…" /></Block>

            <Block icon={<Users className="h-4 w-4" />} title="Personnes clés" description="Décideurs, opérationnels et parties prenantes." action={<Button variant="outline" size="sm" onClick={addStakeholder}><Plus className="mr-1 h-3.5 w-3.5" /> Ajouter</Button>}>
              <div className="space-y-3">{content.stakeholders.map((person, index) => <div key={index} className="grid gap-3 rounded-xl border border-border bg-muted/15 p-4 md:grid-cols-2">
                <Input value={person.name} onChange={event => update("stakeholders", content.stakeholders.map((item, position) => position === index ? { ...item, name: event.target.value } : item))} placeholder="Nom" />
                <Input value={person.role} onChange={event => update("stakeholders", content.stakeholders.map((item, position) => position === index ? { ...item, role: event.target.value } : item))} placeholder="Fonction" />
                <Input value={person.organization} onChange={event => update("stakeholders", content.stakeholders.map((item, position) => position === index ? { ...item, organization: event.target.value } : item))} placeholder="Organisation" />
                <div className="flex gap-2"><Input value={person.notes} onChange={event => update("stakeholders", content.stakeholders.map((item, position) => position === index ? { ...item, notes: event.target.value } : item))} placeholder="Rôle dans la décision / note" /><Button variant="ghost" size="sm" onClick={() => update("stakeholders", content.stakeholders.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button></div>
              </div>)}{!content.stakeholders.length ? <EmptyLine>Aucune personne clé ajoutée.</EmptyLine> : null}</div>
            </Block>

            <div className="grid gap-5 lg:grid-cols-2">
              <Block icon={<Workflow className="h-4 w-4" />} title="Processus actuel" description="Une étape par ligne."><Area value={textLines(content.currentProcess)} onChange={value => update("currentProcess", lines(value))} rows={6} placeholder="Réservation reçue\nCaution demandée\nRemise du véhicule…" /></Block>
              <Block icon={<Package className="h-4 w-4" />} title="Produits et offres" description="Produits, catégories ou offres concernées."><Area value={textLines(content.productsAndOffers)} onChange={value => update("productsAndOffers", lines(value))} rows={6} placeholder="Une offre par ligne" /></Block>
            </div>

            <Block icon={<CircleDollarSign className="h-4 w-4" />} title="Business model" description="Tarification, volumes ou logique économique connue."><Area value={textLines(content.businessModel)} onChange={value => update("businessModel", lines(value))} rows={5} placeholder="Un élément par ligne" /></Block>
          </> : null}

          {section === "decision" ? <>
            <div className="grid gap-5 lg:grid-cols-2">
              <Block icon={<Clock3 className="h-4 w-4" />} title="Pourquoi maintenant ?" description="Urgence, échéance ou déclencheur."><Area value={textLines(content.urgency)} onChange={value => update("urgency", lines(value))} rows={5} placeholder="Un facteur par ligne" /></Block>
              <Block icon={<CheckCircle2 className="h-4 w-4" />} title="Décisions prises" description="Ce qui est déjà acté."><Area value={textLines(content.decisions)} onChange={value => update("decisions", lines(value))} rows={5} placeholder="Une décision par ligne" /></Block>
            </div>

            <Block icon={<CircleHelp className="h-4 w-4" />} title="Questions ouvertes" description="Points manquants, désaccords ou sujets à confirmer."><Area value={textLines(content.openQuestions)} onChange={value => update("openQuestions", lines(value))} rows={5} placeholder="Une question par ligne" /></Block>

            <Block icon={<ListChecks className="h-4 w-4" />} title="Prochaines étapes" description="Qui fait quoi et pour quand." action={<Button variant="outline" size="sm" onClick={addAction}><Plus className="mr-1 h-3.5 w-3.5" /> Ajouter</Button>}>
              <div className="space-y-3">{content.nextSteps.map((step, index) => <div key={index} className="grid gap-3 rounded-xl border border-border bg-muted/15 p-4 md:grid-cols-[0.8fr_1.7fr_0.8fr_0.8fr_auto] md:items-end">
                <div><Label className="text-[11px] text-muted-foreground">Responsable</Label><Input value={step.owner} onChange={event => patchAction(index, { owner: event.target.value })} placeholder="Gando / Client" /></div>
                <div><Label className="text-[11px] text-muted-foreground">Action</Label><Input value={step.action} onChange={event => patchAction(index, { action: event.target.value })} placeholder="Action à réaliser" /></div>
                <div><Label className="text-[11px] text-muted-foreground">Date</Label><Input type="date" value={step.dueDate || ""} onChange={event => patchAction(index, { dueDate: event.target.value || null })} /></div>
                <div><Label className="text-[11px] text-muted-foreground">Statut</Label><select value={step.status} onChange={event => patchAction(index, { status: event.target.value as SD01NextStep["status"] })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="not_started">À faire</option><option value="in_progress">En cours</option><option value="done">Fait</option></select></div>
                <Button variant="ghost" size="sm" onClick={() => update("nextSteps", content.nextSteps.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button>
              </div>)}{!content.nextSteps.length ? <EmptyLine>Aucune prochaine étape ajoutée.</EmptyLine> : null}</div>
            </Block>

            {content.evidence.length ? <Block icon={<LockKeyhole className="h-4 w-4" />} title="Preuves de l’agent" description="Interne uniquement. Ces citations ne sont pas exposées au client."><div className="grid gap-2 lg:grid-cols-2">{content.evidence.slice(0, 16).map((item, index) => <div key={`${item.sourceId}-${index}`} className="rounded-xl border border-border bg-muted/20 p-3 text-xs"><div className="font-bold text-primary">{item.field}</div><p className="mt-1 leading-5 text-muted-foreground">« {item.quote} »</p></div>)}</div></Block> : null}
          </> : null}
        </main>

        <aside className="space-y-5 xl:sticky xl:top-[118px] xl:self-start">
          <Card className="p-5">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-black">Accès client</h3></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><Button variant={room.access_mode === "email" ? "default" : "outline"} size="sm" onClick={() => setAccessMode("email")}>Email identifié</Button><Button variant={room.access_mode === "allowlist" ? "default" : "outline"} size="sm" onClick={() => setAccessMode("allowlist")}>Liste autorisée</Button></div>
            {room.access_mode === "allowlist" ? <div className="mt-3"><Area value={allowlist} onChange={setAllowlist} rows={4} placeholder="direction@client.com\nboard@client.com" /></div> : <p className="mt-3 text-xs leading-5 text-muted-foreground">Toute personne ayant le lien renseigne son email avant accès. Chaque visite est attribuée.</p>}
            <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => void saveAccess()} disabled={working === "access"}>{working === "access" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />} Enregistrer l’accès</Button>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-primary" /><h3 className="font-black">Remarques du board</h3><Badge variant="outline">{comments.filter(comment => comment.status === "open").length}</Badge></div>
            <div className="mt-3 space-y-2">{comments.slice(0, 8).map(comment => <article key={comment.id} className={cn("rounded-xl border p-3 text-xs", comment.status === "open" ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-muted/20 opacity-65")}><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{comment.author_email}</span><Badge variant="outline" className="shrink-0">{comment.document_code}</Badge></div><p className="mt-2 whitespace-pre-line leading-5 text-muted-foreground">{comment.body}</p><div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{formatDate(comment.created_at)}</span>{comment.status === "open" ? <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled={working === `comment:${comment.id}`} onClick={() => void resolveComment(comment.id)}>{working === `comment:${comment.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />} Traité</Button> : <span>Traitée</span>}</div></article>)}{!comments.length ? <p className="text-xs text-muted-foreground">Les suggestions envoyées depuis la room apparaîtront ici.</p> : null}</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><h3 className="font-black">Dernières consultations</h3></div>
            <p className="mt-1 text-xs text-muted-foreground">Dernière activité : {formatDate(analytics.lastViewedAt)}</p>
            <div className="mt-3 space-y-2">{analytics.recentVisitors.slice(0, 6).map(visitor => { const fullName = [visitor.firstName, visitor.lastName].filter(Boolean).join(" "); return <div key={`${visitor.email}-${visitor.lastSeenAt}`} className="flex items-center justify-between gap-3 rounded-xl bg-muted/35 p-3 text-xs"><div className="min-w-0"><div className="truncate font-semibold">{fullName || visitor.email || "Visiteur"}</div>{fullName && visitor.email ? <div className="truncate text-[11px] text-muted-foreground">{visitor.email}</div> : null}<div className="text-[11px] text-muted-foreground">{formatDate(visitor.lastSeenAt)}</div></div><Badge variant="outline" className="shrink-0"><Clock3 className="mr-1 h-3 w-3" /> {formatDuration(visitor.activeSeconds)}</Badge></div>; })}{!analytics.recentVisitors.length ? <p className="text-xs text-muted-foreground">Aucune consultation pour le moment.</p> : null}</div>
          </Card>

          <details className="rounded-xl border border-border bg-card p-5">
            <summary className="cursor-pointer list-none"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span className="font-black">Mettre à jour depuis les échanges</span></div><p className="mt-1 text-xs text-muted-foreground">Réutilise les appels reliés au deal ou colle une note.</p></summary>
            <div className="mt-4 space-y-3">
              {(data.linkedConversations || []).slice(0, 10).map(call => <label key={call.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-xs"><input type="checkbox" className="mt-0.5" checked={selectedCalls.includes(call.id)} onChange={event => setSelectedCalls(current => event.target.checked ? Array.from(new Set([...current, call.id])) : current.filter(id => id !== call.id))} /><span className="min-w-0"><span className="block truncate font-semibold">{call.title}</span><span className="text-muted-foreground">{formatDate(call.occurredAt)}</span></span></label>)}
              {!(data.linkedConversations || []).length ? <p className="text-xs text-muted-foreground">Aucun appel relié au deal.</p> : null}
              <Input value={manualTitle} onChange={event => setManualTitle(event.target.value)} placeholder="Titre de la note" />
              <Area value={manualTranscript} onChange={setManualTranscript} rows={5} placeholder="Compte rendu ou transcription à intégrer…" />
              <Button className="w-full" onClick={() => void generateFromSources()} disabled={Boolean(working)}>{working === "generate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Mettre à jour le SD01</Button>
            </div>
          </details>

          <details className="rounded-xl border border-border bg-card p-5">
            <summary className="cursor-pointer list-none"><div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><span className="font-black">Historique des versions</span><Badge variant="outline">{versions.length}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Chaque sauvegarde reste restaurable.</p></summary>
            <div className="mt-4 space-y-2">{versions.slice(0, 12).map(version => <div key={version.id} className="rounded-xl border border-border p-3 text-xs"><div className="flex items-start justify-between gap-3"><div><div className="font-bold">Version {version.version}</div><div className="mt-1 text-muted-foreground">{formatDate(version.created_at)}</div>{version.change_summary ? <div className="mt-1 text-muted-foreground">{version.change_summary}</div> : null}</div><Button variant="ghost" size="sm" disabled={working === `restore-${version.version}`} onClick={() => void restoreVersion(version.version)}>{working === `restore-${version.version}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}</Button></div></div>)}{!versions.length ? <p className="text-xs text-muted-foreground">Aucune version enregistrée.</p> : null}</div>
          </details>
        </aside>
      </div>
    </div>
  </div>;
}
