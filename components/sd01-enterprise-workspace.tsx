"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Clock3, Eye, History, Loader2, MessageSquareText, Plus, RefreshCw, RotateCcw, Save, Sparkles, Target, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DealRoomDetail } from "@/lib/deal-room-types";
import { createEmptySD01, type LinkedConversation, type SD01Content, type SDDocumentRecord, type SDRoomAnalytics, type SDRoomComment, type SDRoomRecord } from "@/lib/sd-room-types";

type SourceSummary = { id: string; external_id?: string | null; title: string; source_type: string; characterCount: number; occurred_at: string | null };
type RoomResponse = { deal: DealRoomDetail; room: SDRoomRecord | null; documents: SDDocumentRecord[]; sources: SourceSummary[]; linkedConversations: LinkedConversation[]; analytics?: SDRoomAnalytics; comments?: SDRoomComment[] };
type VersionRow = { id: string; version: number; content: SD01Content; source_refs: unknown[]; model_name: string | null; prompt_version: string | null; created_by_email: string | null; change_summary: string | null; created_at: string };

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
    roi: { valueLevers: Array.isArray(source.roi?.valueLevers) ? source.roi.valueLevers : [], metricsRequired: [] },
    urgency: Array.isArray(source.urgency) ? source.urgency : [],
    decisions: Array.isArray(source.decisions) ? source.decisions : [],
    openQuestions: Array.isArray(source.openQuestions) ? source.openQuestions : [],
    nextSteps: Array.isArray(source.nextSteps) ? source.nextSteps : [],
    evidence: Array.isArray(source.evidence) ? source.evidence : [],
  };
}

function lines(value: string) { return value.split("\n").map(item => item.trim()).filter(Boolean); }
function textLines(value: string[]) { return value.join("\n"); }
function formatDate(value?: string | null) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date inconnue" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function FreeTextarea({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0" />;
}

function DocBlock({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="border-b border-border/70 px-6 py-6 last:border-0 sm:px-9 sm:py-7">
    <div className="mb-4 flex items-start justify-between gap-4">
      <div><h2 className="text-[17px] font-bold tracking-[-0.02em]">{title}</h2>{hint ? <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{hint}</p> : null}</div>
      {action}
    </div>
    {children}
  </section>;
}

function MiniInput({ value, onChange, placeholder, className = "" }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return <Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={`h-9 text-sm ${className}`} />;
}

export function SD01EnterpriseWorkspace({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [content, setContent] = useState<SD01Content>(() => createEmptySD01());
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const [manualTitle, setManualTitle] = useState("Note de réunion / compte rendu");
  const [manualTranscript, setManualTranscript] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/versions`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Historique indisponible");
      setVersions(payload.versions || []);
    } catch { setVersions([]); }
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
    } finally { setLoading(false); }
  }, [dealId, loadVersions]);

  useEffect(() => { void load(); }, [load]);

  const room = data?.room;
  const sd01 = data?.documents.find(document => document.code === "SD01");
  const companyName = room?.company_name || data?.deal.company?.name || "Client";
  const dealName = data?.deal.name || room?.title || "Deal entreprise";
  const confirmedMetrics = useMemo(() => content.roi.valueLevers.filter(metric => metric.value.trim()), [content.roi.valueLevers]);
  const openComments = (data?.comments || []).filter(comment => comment.status === "open");
  const update = <K extends keyof SD01Content>(key: K, value: SD01Content[K]) => setContent(current => ({ ...current, [key]: value }));

  async function save(publish = false) {
    setWorking(publish ? "publish" : "save");
    try {
      const cleaned: SD01Content = { ...content, roi: { valueLevers: content.roi.valueLevers.filter(metric => metric.lever.trim() || metric.value.trim()), metricsRequired: [] } };
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: publish ? "publish_sd01" : "save_sd01", content: cleaned }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setContent(cleanContent(payload.document?.content, companyName));
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD01" ? payload.document : document), room: publish && current.room ? { ...current.room, status: "published" } : current.room } : current);
      await loadVersions();
      toast.success(publish ? "SD01 publié" : "SD01 enregistré");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); }
    finally { setWorking(null); }
  }

  async function generateFromSources() {
    if (!selectedCalls.length && !manualTranscript.trim()) { toast.error("Sélectionne un enregistrement ou ajoute une note."); return; }
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
    } catch (error) { toast.error(error instanceof Error ? error.message : "Mise à jour impossible"); }
    finally { setWorking(null); }
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
      toast.success(`Version ${version} restaurée`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Restauration impossible"); }
    finally { setWorking(null); }
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
      toast.success("Accès mis à jour");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Réglage impossible"); }
    finally { setWorking(null); }
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
    } catch (error) { toast.error(error instanceof Error ? error.message : "Traitement impossible"); }
    finally { setWorking(null); }
  }

  if (loading && !data) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data?.room) return <div className="p-6"><Card className="mx-auto max-w-xl p-8 text-center"><div className="font-bold">SD01 indisponible</div><Button className="mt-4" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Réessayer</Button></Card></div>;

  const safeRoom = data.room;
  const analytics = data.analytics;
  const recentVisitors = analytics?.recentVisitors || [];
  const addStakeholder = () => update("stakeholders", [...content.stakeholders, { name: "", role: "", organization: companyName, notes: "" }]);
  const addPain = () => update("painPoints", [...content.painPoints, { priority: content.painPoints.length + 1, title: "", details: [] }]);
  const addFit = () => update("solutionFit", [...content.solutionFit, { need: "", response: "" }]);
  const addMetric = () => update("roi", { ...content.roi, valueLevers: [...content.roi.valueLevers, { lever: "", mechanism: "", value: "" }] });

  return <div className="min-h-screen bg-muted/20 px-4 py-6 lg:px-7 lg:py-8">
    <div className="mx-auto max-w-[1320px] space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">SD01 · Synthèse</div><h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">{dealName}</h1><p className="mt-1 text-sm text-muted-foreground">Un document de compréhension commune. Les décisions et actions sont maintenant dans SD02.</p></div>
        <div className="flex flex-wrap gap-2"><Badge variant="outline">V{sd01?.version || 1}</Badge>{confirmedMetrics.length ? <Badge variant="outline">{confirmedMetrics.length} métrique{confirmedMetrics.length > 1 ? "s" : ""}</Badge> : null}<Button variant="outline" onClick={() => void save(false)} disabled={Boolean(working)}><Save className="mr-2 h-4 w-4" />Enregistrer</Button><Button onClick={() => void save(true)} disabled={Boolean(working) || !content.executiveSummary.trim()}>{working === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Publier</Button></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,900px)_340px] xl:items-start">
        <Card className="overflow-hidden border-border/80 bg-card p-0 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border bg-muted/25 px-6 py-4 sm:px-9"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Target className="h-4 w-4" /></div><div><div className="text-sm font-bold">Document de travail</div><div className="text-[11px] text-muted-foreground">Clique, écris, réorganise le fond. Pas de formulaire à remplir dans un ordre imposé.</div></div></div>

          <DocBlock title="Synthèse exécutive" hint="Le contexte et l’enjeu en quelques lignes. C’est le premier bloc lu côté client."><FreeTextarea value={content.executiveSummary} onChange={value => update("executiveSummary", value)} rows={6} placeholder="Contexte, problème principal, valeur recherchée…" /></DocBlock>

          <DocBlock title="Entreprise & contexte" hint="Les informations historiques du SD01 restent ici, dans un seul bloc.">
            <div className="grid gap-3 sm:grid-cols-2"><MiniInput value={content.companyProfile.sector} onChange={value => update("companyProfile", { ...content.companyProfile, sector: value })} placeholder="Secteur" /><MiniInput value={content.companyProfile.description} onChange={value => update("companyProfile", { ...content.companyProfile, description: value })} placeholder="Présentation de l’entreprise" /></div>
            <div className="mt-4"><FreeTextarea value={content.companyProfile.context} onChange={value => update("companyProfile", { ...content.companyProfile, context: value })} rows={3} placeholder="Contexte de l’entreprise / du projet…" /></div>
            <div className="mt-4 border-t border-border/60 pt-4"><FreeTextarea value={content.gandoContext} onChange={value => update("gandoContext", value)} rows={3} placeholder="Pourquoi Gando intervient dans cette discussion…" /></div>
          </DocBlock>

          <DocBlock title="Personnes clés" hint="Ajoute uniquement les personnes utiles à la décision." action={<Button variant="outline" size="sm" onClick={addStakeholder}><Plus className="mr-1 h-3.5 w-3.5" />Ajouter</Button>}>
            <div className="space-y-2">{content.stakeholders.map((item, index) => <div key={index} className="group grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><MiniInput value={item.name} onChange={value => update("stakeholders", content.stakeholders.map((row, position) => position === index ? { ...row, name: value } : row))} placeholder="Nom" /><MiniInput value={item.role} onChange={value => update("stakeholders", content.stakeholders.map((row, position) => position === index ? { ...row, role: value } : row))} placeholder="Fonction" /><MiniInput value={item.organization} onChange={value => update("stakeholders", content.stakeholders.map((row, position) => position === index ? { ...row, organization: value } : row))} placeholder="Organisation" /><Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-60 group-hover:opacity-100" onClick={() => update("stakeholders", content.stakeholders.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button>{item.notes ? <div className="sm:col-span-4"><FreeTextarea value={item.notes} onChange={value => update("stakeholders", content.stakeholders.map((row, position) => position === index ? { ...row, notes: value } : row))} rows={2} placeholder="Note…" /></div> : null}</div>)}{!content.stakeholders.length ? <p className="text-sm italic text-muted-foreground">Aucune personne clé ajoutée.</p> : null}</div>
          </DocBlock>

          <DocBlock title="Processus actuel" hint="Une étape par ligne. L’objectif est de comprendre comment le client fonctionne aujourd’hui."><FreeTextarea value={textLines(content.currentProcess)} onChange={value => update("currentProcess", lines(value))} rows={5} placeholder={"Réservation créée\nPréautorisation de caution\nRemise du véhicule"} /></DocBlock>

          <DocBlock title="Produits, offres & business model" hint="Conserve ici le contexte commercial nécessaire, sans en faire une fiche CRM."><div className="grid gap-6 md:grid-cols-2"><div><div className="mb-2 text-xs font-bold text-muted-foreground">Produits / offres</div><FreeTextarea value={textLines(content.productsAndOffers)} onChange={value => update("productsAndOffers", lines(value))} rows={4} placeholder="Une offre par ligne…" /></div><div><div className="mb-2 text-xs font-bold text-muted-foreground">Business model</div><FreeTextarea value={textLines(content.businessModel)} onChange={value => update("businessModel", lines(value))} rows={4} placeholder="Les éléments économiques utiles…" /></div></div></DocBlock>

          <DocBlock title="Enjeux prioritaires" hint="Ce qui justifie réellement le projet." action={<Button variant="outline" size="sm" onClick={addPain}><Plus className="mr-1 h-3.5 w-3.5" />Ajouter</Button>}>
            <div className="space-y-3">{content.painPoints.map((pain, index) => <div key={index} className="group rounded-xl border border-border bg-background p-4"><div className="flex gap-2"><Input value={pain.title} onChange={event => update("painPoints", content.painPoints.map((row, position) => position === index ? { ...row, title: event.target.value } : row))} placeholder="Enjeu" className="h-auto border-0 bg-transparent p-0 font-semibold shadow-none focus-visible:ring-0" /><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive opacity-60 group-hover:opacity-100" onClick={() => update("painPoints", content.painPoints.filter((_, position) => position !== index).map((row, position) => ({ ...row, priority: position + 1 })))}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-2"><FreeTextarea value={textLines(pain.details)} onChange={value => update("painPoints", content.painPoints.map((row, position) => position === index ? { ...row, details: lines(value) } : row))} rows={3} placeholder="Détail, preuve, conséquence…" /></div></div>)}{!content.painPoints.length ? <p className="text-sm italic text-muted-foreground">Aucun enjeu renseigné.</p> : null}</div>
          </DocBlock>

          <DocBlock title="Solution fit" hint="Mini-propal de cadrage : besoin client à gauche, réponse Gando à droite." action={<Button variant="outline" size="sm" onClick={addFit}><Plus className="mr-1 h-3.5 w-3.5" />Ajouter</Button>}>
            <div className="space-y-3">{content.solutionFit.map((item, index) => <div key={index} className="group grid gap-3 rounded-xl border border-border bg-background p-4 md:grid-cols-[1fr_1fr_auto]"><FreeTextarea value={item.need} onChange={value => update("solutionFit", content.solutionFit.map((row, position) => position === index ? { ...row, need: value } : row))} rows={3} placeholder="Besoin / problème client…" /><FreeTextarea value={item.response} onChange={value => update("solutionFit", content.solutionFit.map((row, position) => position === index ? { ...row, response: value } : row))} rows={3} placeholder="Réponse Gando proposée…" /><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-60 group-hover:opacity-100" onClick={() => update("solutionFit", content.solutionFit.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}{!content.solutionFit.length ? <p className="text-sm italic text-muted-foreground">Ajoute une correspondance besoin → réponse pour construire la mini-propal.</p> : null}</div>
          </DocBlock>

          <DocBlock title="Métriques confirmées" hint="Entièrement facultatif. Si nous n’avons pas une donnée fiable, nous n’affichons rien." action={<Button variant="outline" size="sm" onClick={addMetric}><Plus className="mr-1 h-3.5 w-3.5" />Ajouter</Button>}>
            <div className="space-y-2">{content.roi.valueLevers.map((metric, index) => <div key={index} className="group grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[1fr_1.4fr_1fr_auto]"><MiniInput value={metric.lever} onChange={value => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((row, position) => position === index ? { ...row, lever: value } : row) })} placeholder="Métrique" /><MiniInput value={metric.mechanism} onChange={value => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((row, position) => position === index ? { ...row, mechanism: value } : row) })} placeholder="Pourquoi elle compte" /><MiniInput value={metric.value} onChange={value => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.map((row, position) => position === index ? { ...row, value } : row) })} placeholder="Valeur confirmée" /><Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => update("roi", { ...content.roi, valueLevers: content.roi.valueLevers.filter((_, position) => position !== index) })}><Trash2 className="h-4 w-4" /></Button></div>)}{!content.roi.valueLevers.length ? <p className="text-sm italic text-muted-foreground">Aucune métrique confirmée — ce bloc ne sera pas affiché côté client.</p> : null}</div>
          </DocBlock>

          <DocBlock title="Pourquoi maintenant ?" hint="Contexte d’urgence ou événement déclencheur, si pertinent."><FreeTextarea value={textLines(content.urgency)} onChange={value => update("urgency", lines(value))} rows={4} placeholder="Un facteur par ligne…" /></DocBlock>
        </Card>

        <aside className="space-y-4 xl:sticky xl:top-32">
          <Card className="p-5">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-bold">Accès client</h3></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><Button variant={safeRoom.access_mode === "email" ? "default" : "outline"} size="sm" onClick={() => setData(current => current && current.room ? { ...current, room: { ...current.room, access_mode: "email" } } : current)}>Email identifié</Button><Button variant={safeRoom.access_mode === "allowlist" ? "default" : "outline"} size="sm" onClick={() => setData(current => current && current.room ? { ...current, room: { ...current.room, access_mode: "allowlist" } } : current)}>Liste autorisée</Button></div>
            {safeRoom.access_mode === "allowlist" ? <textarea value={allowlist} onChange={event => setAllowlist(event.target.value)} rows={4} placeholder="direction@client.com" className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-xs outline-none" /> : <p className="mt-3 text-xs leading-5 text-muted-foreground">Chaque visiteur renseigne son identité avant d’accéder à la Room.</p>}
            <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => void saveAccess()} disabled={working === "access"}>Enregistrer l’accès</Button>
          </Card>

          <Card className="p-5"><div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-primary" /><h3 className="font-bold">Remarques</h3><Badge variant="outline">{openComments.length}</Badge></div><div className="mt-3 space-y-2">{openComments.slice(0, 6).map(comment => <div key={comment.id} className="rounded-lg border border-border bg-muted/20 p-3 text-xs"><div className="font-semibold">{comment.author_email}</div><p className="mt-1 whitespace-pre-line leading-5 text-muted-foreground">{comment.body}</p><div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-muted-foreground">{comment.document_code} · {formatDate(comment.created_at)}</span><Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => void resolveComment(comment.id)} disabled={working === `comment:${comment.id}`}><Check className="mr-1 h-3 w-3" />Traité</Button></div></div>)}{!openComments.length ? <p className="text-xs text-muted-foreground">Aucune remarque ouverte.</p> : null}</div></Card>

          <Card className="rounded-[22px] border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3"><Eye className="h-5 w-5 text-primary" /><h3 className="text-lg font-black tracking-[-0.025em]">Dernières consultations</h3></div>
            <p className="mt-2 text-sm text-muted-foreground">Dernière activité : {analytics?.lastViewedAt ? formatDate(analytics.lastViewedAt) : "Jamais"}</p>
            {recentVisitors.length ? <div className="mt-4 divide-y divide-border">{recentVisitors.slice(0, 5).map(visitor => {
              const name = [visitor.firstName, visitor.lastName].filter(Boolean).join(" ") || visitor.email || "Visiteur";
              return <div key={visitor.email || `${visitor.firstName}-${visitor.lastName}`} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{name}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{visitor.email || "Email inconnu"}</div></div><div className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"><Clock3 className="mr-1 inline h-3 w-3" />{formatDuration(visitor.activeSeconds)}</div></div>
                <div className="mt-2 text-[11px] text-muted-foreground">Consulté le {formatDate(visitor.lastSeenAt)}</div>
              </div>;
            })}</div> : <p className="mt-5 text-sm text-muted-foreground">Aucune consultation pour le moment.</p>}
            <Link href="?tab=visitors" className="mt-4 inline-flex text-xs font-bold text-primary hover:underline">Voir tout l’historique</Link>
          </Card>

          <details className="group overflow-hidden rounded-xl border border-border bg-card"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span className="text-sm font-bold">Sources & mise à jour</span></div><ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" /></summary><div className="border-t border-border p-5"><div className="space-y-2">{(data.linkedConversations || []).slice(0, 10).map(call => <label key={call.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-xs"><input type="checkbox" className="mt-0.5" checked={selectedCalls.includes(call.id)} onChange={event => setSelectedCalls(current => event.target.checked ? [...new Set([...current, call.id])] : current.filter(id => id !== call.id))} /><span><span className="font-semibold">{call.title}</span><span className="mt-0.5 block text-muted-foreground">{formatDate(call.occurredAt)}</span></span></label>)}</div><Input className="mt-4" value={manualTitle} onChange={event => setManualTitle(event.target.value)} placeholder="Titre de la note" /><textarea className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-xs outline-none" rows={4} value={manualTranscript} onChange={event => setManualTranscript(event.target.value)} placeholder="Colle un compte rendu ou une note…" /><Button className="mt-3 w-full" variant="outline" onClick={() => void generateFromSources()} disabled={working === "generate"}>{working === "generate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Mettre à jour le SD01</Button></div></details>

          <details className="group overflow-hidden rounded-xl border border-border bg-card"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden"><div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><span className="text-sm font-bold">Historique</span><Badge variant="outline">{versions.length}</Badge></div><ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" /></summary><div className="max-h-[420px] space-y-2 overflow-y-auto border-t border-border p-4">{versions.map(version => <div key={version.id} className="rounded-lg border border-border p-3 text-xs"><div className="flex items-center justify-between gap-2"><div><div className="font-semibold">Version {version.version}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(version.created_at)}</div></div><Button variant="ghost" size="sm" className="h-8" onClick={() => void restoreVersion(version.version)} disabled={working === `restore-${version.version}`}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restaurer</Button></div>{version.change_summary ? <p className="mt-2 text-muted-foreground">{version.change_summary}</p> : null}</div>)}{!versions.length ? <p className="text-xs text-muted-foreground">Aucune version enregistrée.</p> : null}</div></details>

          <Card className="p-4 text-xs text-muted-foreground"><div className="flex items-center gap-2 font-semibold text-foreground"><Clock3 className="h-4 w-4 text-primary" />Règle SD01</div><p className="mt-2 leading-5">On comprend le client ici. On décide et on organise la suite dans <strong>SD02 · Prochaines étapes</strong>.</p></Card>
        </aside>
      </div>
    </div>
  </div>;
}