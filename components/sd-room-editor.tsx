"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bot,
  Check,
  Clock3,
  Copy,
  Eye,
  FileText,
  Link2,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
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
  SD_CODES,
  SD_STAGE_META,
  createEmptySD01,
  type LinkedConversation,
  type SD01Content,
  type SDCode,
  type SDDocumentRecord,
  type SDRoomAnalytics,
  type SDRoomComment,
  type SDRoomRecord,
} from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type RoomResponse = {
  deal: DealRoomDetail;
  room: SDRoomRecord | null;
  documents: SDDocumentRecord[];
  sources: Array<{ id: string; title: string; source_type: string; characterCount: number; occurred_at: string | null }>;
  analytics: SDRoomAnalytics;
  linkedConversations: LinkedConversation[];
  comments: SDRoomComment[];
};

const EMPTY_ANALYTICS: SDRoomAnalytics = { opens: 0, uniqueVisitors: 0, activeSeconds: 0, lastViewedAt: null, recentVisitors: [] };

function lines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

function textLines(values: string[]) {
  return values.join("\n");
}

function formatDate(value: string | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Area({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={event => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
    />
  );
}

function SD01Form({ content, onChange }: { content: SD01Content; onChange: (content: SD01Content) => void }) {
  const update = <K extends keyof SD01Content>(key: K, value: SD01Content[K]) => onChange({ ...content, [key]: value });
  return (
    <div className="space-y-5">
      <Card className="space-y-5 p-5">
        <FormField label="Synthèse exécutive" hint="La lecture board en moins de deux minutes.">
          <Area value={content.executiveSummary} onChange={value => update("executiveSummary", value)} rows={6} placeholder="Contexte, enjeu principal, valeur attendue et décision à prendre…" />
        </FormField>
        <div className="grid gap-4 lg:grid-cols-3">
          <FormField label="Secteur"><Input value={content.companyProfile.sector} onChange={event => update("companyProfile", { ...content.companyProfile, sector: event.target.value })} /></FormField>
          <FormField label="Présentation" ><Input value={content.companyProfile.description} onChange={event => update("companyProfile", { ...content.companyProfile, description: event.target.value })} /></FormField>
          <FormField label="Contexte"><Input value={content.companyProfile.context} onChange={event => update("companyProfile", { ...content.companyProfile, context: event.target.value })} /></FormField>
        </div>
        <FormField label="Contexte Gando"><Area value={content.gandoContext} onChange={value => update("gandoContext", value)} rows={3} placeholder="Pourquoi cette discussion avec Gando ?" /></FormField>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="space-y-4 p-5">
          <FormField label="Personnes clés" hint="Une ligne : Nom | Fonction | Organisation | Note">
            <Area
              value={content.stakeholders.map(item => [item.name, item.role, item.organization, item.notes].join(" | ")).join("\n")}
              onChange={value => update("stakeholders", lines(value).map(row => { const [name = "", role = "", organization = "", notes = ""] = row.split("|").map(item => item.trim()); return { name, role, organization, notes }; }))}
              rows={6}
            />
          </FormField>
          <FormField label="Processus actuel" hint="Une étape par ligne"><Area value={textLines(content.currentProcess)} onChange={value => update("currentProcess", lines(value))} rows={6} /></FormField>
          <FormField label="Produits et offres" hint="Un élément par ligne"><Area value={textLines(content.productsAndOffers)} onChange={value => update("productsAndOffers", lines(value))} rows={5} /></FormField>
          <FormField label="Business model" hint="Un élément par ligne"><Area value={textLines(content.businessModel)} onChange={value => update("businessModel", lines(value))} rows={5} /></FormField>
        </Card>

        <Card className="space-y-4 p-5">
          <FormField label="Pain points" hint="Une ligne : titre | détail">
            <Area
              value={content.painPoints.map(item => `${item.title} | ${item.details.join(" ; ")}`).join("\n")}
              onChange={value => update("painPoints", lines(value).map((row, index) => { const [title = "", detail = ""] = row.split("|").map(item => item.trim()); return { priority: index + 1, title, details: detail ? detail.split(";").map(item => item.trim()).filter(Boolean) : [] }; }))}
              rows={7}
            />
          </FormField>
          <FormField label="Correspondance solution" hint="Une ligne : besoin | réponse Gando">
            <Area
              value={content.solutionFit.map(item => `${item.need} | ${item.response}`).join("\n")}
              onChange={value => update("solutionFit", lines(value).map(row => { const [need = "", response = ""] = row.split("|").map(item => item.trim()); return { need, response }; }))}
              rows={7}
            />
          </FormField>
          <FormField label="Leviers de valeur / ROI" hint="Une ligne : levier | mécanisme | valeur/chiffre confirmé">
            <Area
              value={content.roi.valueLevers.map(item => `${item.lever} | ${item.mechanism} | ${item.value}`).join("\n")}
              onChange={value => update("roi", { ...content.roi, valueLevers: lines(value).map(row => { const [lever = "", mechanism = "", numericValue = ""] = row.split("|").map(item => item.trim()); return { lever, mechanism, value: numericValue }; }) })}
              rows={6}
            />
          </FormField>
          <FormField label="Métriques encore nécessaires" hint="Une métrique par ligne"><Area value={textLines(content.roi.metricsRequired)} onChange={value => update("roi", { ...content.roi, metricsRequired: lines(value) })} rows={4} /></FormField>
        </Card>
      </div>

      <Card className="grid gap-5 p-5 xl:grid-cols-2">
        <div className="space-y-4">
          <FormField label="Pourquoi maintenant ?" hint="Un facteur d’urgence par ligne"><Area value={textLines(content.urgency)} onChange={value => update("urgency", lines(value))} rows={5} /></FormField>
          <FormField label="Décisions prises" hint="Une décision par ligne"><Area value={textLines(content.decisions)} onChange={value => update("decisions", lines(value))} rows={5} /></FormField>
        </div>
        <div className="space-y-4">
          <FormField label="Questions ouvertes" hint="Un manque ou désaccord par ligne"><Area value={textLines(content.openQuestions)} onChange={value => update("openQuestions", lines(value))} rows={5} /></FormField>
          <FormField label="Prochaines étapes" hint="Une ligne : responsable | action | date AAAA-MM-JJ">
            <Area
              value={content.nextSteps.map(item => `${item.owner} | ${item.action} | ${item.dueDate || ""}`).join("\n")}
              onChange={value => update("nextSteps", lines(value).map(row => { const [owner = "", action = "", dueDate = ""] = row.split("|").map(item => item.trim()); return { owner, action, dueDate: dueDate || null, status: "not_started" as const }; }))}
              rows={6}
            />
          </FormField>
        </div>
      </Card>

      {content.evidence.length ? (
        <Card className="p-5">
          <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary" /><h3 className="font-semibold">Preuves conservées par l’agent</h3><Badge variant="outline">{content.evidence.length}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">Ces citations servent à la relecture interne et ne sont pas exposées dans la room client.</p>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {content.evidence.slice(0, 16).map((item, index) => (
              <div key={`${item.sourceId}-${index}`} className="rounded-lg border border-border bg-muted/25 p-3 text-xs">
                <div className="font-semibold text-primary">{item.field}</div>
                <p className="mt-1 leading-5 text-muted-foreground">« {item.quote} »</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function SDRoomEditor({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [content, setContent] = useState<SD01Content>(() => createEmptySD01());
  const [activeStage, setActiveStage] = useState<SDCode>("SD01");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const [manualTitle, setManualTitle] = useState("Conversation ajoutée manuellement");
  const [manualTranscript, setManualTranscript] = useState("");
  const [allowlist, setAllowlist] = useState("");

  const applyResponse = useCallback((next: RoomResponse) => {
    setData(next);
    const sd01 = next.documents.find(document => document.code === "SD01");
    setContent((sd01?.content as SD01Content) || createEmptySD01(next.deal.company?.name));
    setAllowlist(next.room?.allowed_emails?.join("\n") || "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Impossible de charger la room SD.");
      applyResponse(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [applyResponse, dealId]);

  useEffect(() => { void load(); }, [load]);

  const room = data?.room;
  const currentDocument = data?.documents.find(document => document.code === activeStage);
  const sd01Document = data?.documents.find(document => document.code === "SD01");
  const shareUrl = room && typeof window !== "undefined" ? `${window.location.origin}/r/${room.share_token}` : "";
  const analytics = data?.analytics || EMPTY_ANALYTICS;

  const createRoom = async () => {
    setWorking("create");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Création impossible");
      applyResponse(payload);
      toast.success("Room SD créée");
    } catch (creationError) {
      toast.error(creationError instanceof Error ? creationError.message : "Création impossible");
    } finally {
      setWorking(null);
    }
  };

  const save = async (publish = false) => {
    setWorking(publish ? "publish" : "save");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: publish ? "publish_sd01" : "save_sd01", content }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD01" ? payload.document : document), room: publish && current.room ? { ...current.room, status: "published", current_stage: "SD01", published_at: new Date().toISOString() } : current.room } : current);
      setContent(payload.document.content);
      toast.success(publish ? "SD01 publié dans la room client" : "Brouillon enregistré");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Enregistrement impossible");
    } finally {
      setWorking(null);
    }
  };

  const generate = async () => {
    setWorking("generate");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callIds: selectedCalls, manualTitle, manualTranscript }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Génération impossible");
      setContent(payload.document.content);
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD01" ? payload.document : document) } : current);
      setManualTranscript("");
      toast.success(`Brouillon SD01 généré depuis ${payload.sourceCount} conversation(s) — à relire`);
      void load();
    } catch (generationError) {
      toast.error(generationError instanceof Error ? generationError.message : "Génération impossible");
    } finally {
      setWorking(null);
    }
  };

  const saveAccess = async () => {
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
    } catch (accessError) {
      toast.error(accessError instanceof Error ? accessError.message : "Réglage impossible");
    } finally {
      setWorking(null);
    }
  };

  const resolveComment = async (commentId: string) => {
    setWorking(`comment:${commentId}`);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resolve_comment", commentId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Traitement impossible");
      setData(current => current ? { ...current, comments: current.comments.map(comment => comment.id === commentId ? payload.comment : comment) } : current);
      toast.success("Remarque traitée");
    } catch (commentError) {
      toast.error(commentError instanceof Error ? commentError.message : "Traitement impossible");
    } finally {
      setWorking(null);
    }
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error || !data) return <div className="p-6"><Card className="mx-auto max-w-2xl p-8 text-center"><p className="text-sm text-rose-300">{error}</p><Button className="mt-4" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Réessayer</Button></Card></div>;

  if (!room) {
    return (
      <div className="page-shell min-h-screen p-5 lg:p-7">
        <div className="mx-auto max-w-4xl">
          <Button variant="ghost" size="sm" asChild><Link href={`/deal-room/${dealId}`}><ArrowLeft className="mr-2 h-4 w-4" /> War Room interne</Link></Button>
          <Card className="mt-6 overflow-hidden border-primary/25 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Link2 className="h-6 w-6" /></div>
            <h1 className="mt-5 text-2xl font-bold">Créer la room SD · {data.deal.company?.name || data.deal.name}</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Un espace client continu de l’alignement stratégique SD01 jusqu’à la signature SD05, avec versions, sources et suivi de consultation.</p>
            <div className="mx-auto mt-6 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-border p-4"><Bot className="h-4 w-4 text-primary" /><p className="mt-2 text-sm font-semibold">Manuel ou agent</p></div>
              <div className="rounded-xl border border-border p-4"><LockKeyhole className="h-4 w-4 text-primary" /><p className="mt-2 text-sm font-semibold">Relecture humaine</p></div>
              <div className="rounded-xl border border-border p-4"><Activity className="h-4 w-4 text-primary" /><p className="mt-2 text-sm font-semibold">Consultations suivies</p></div>
            </div>
            <Button className="mt-7" onClick={() => void createRoom()} disabled={working === "create"}>{working === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Créer la room</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-screen p-5 lg:p-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild><Link href={`/deal-room/${dealId}`}><ArrowLeft className="mr-2 h-4 w-4" /> War Room interne</Link></Button>
          <Badge variant="outline" className={cn("rounded-md", room.status === "published" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300")}>{room.status === "published" ? "Room publiée" : "Room en brouillon"}</Badge>
          <Button className="ml-auto" variant="outline" size="sm" disabled={!shareUrl || room.status !== "published"} onClick={async () => { await navigator.clipboard.writeText(shareUrl); toast.success("Lien copié"); }}><Copy className="mr-2 h-4 w-4" /> Copier le lien client</Button>
        </div>

        <header className="rounded-2xl border border-border bg-card p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Deal Room SD</div><h1 className="mt-1 text-2xl font-bold">{room.title}</h1><p className="mt-2 text-sm text-muted-foreground">Une seule mémoire partagée, du premier cadrage à la signature.</p></div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border px-4 py-3"><div className="text-xl font-bold">{analytics.uniqueVisitors}</div><div className="text-[10px] uppercase text-muted-foreground">visiteurs</div></div>
              <div className="rounded-xl border border-border px-4 py-3"><div className="text-xl font-bold">{analytics.opens}</div><div className="text-[10px] uppercase text-muted-foreground">ouvertures</div></div>
              <div className="rounded-xl border border-border px-4 py-3"><div className="text-xl font-bold">{formatDuration(analytics.activeSeconds)}</div><div className="text-[10px] uppercase text-muted-foreground">lecture</div></div>
            </div>
          </div>
        </header>

        <nav className="grid gap-2 md:grid-cols-5" aria-label="Parcours SD">
          {SD_CODES.map(code => {
            const document = data.documents.find(item => item.code === code);
            return (
              <button key={code} type="button" onClick={() => setActiveStage(code)} className={cn("rounded-xl border p-3 text-left transition-colors", activeStage === code ? "border-primary bg-primary/[0.08]" : "border-border bg-card hover:border-primary/35")}>
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-primary">{code}</span>{document?.status === "published" || document?.status === "validated" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : null}</div>
                <div className="mt-1 text-xs font-semibold">{SD_STAGE_META[code].title}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">{document?.status === "review" ? "À relire" : document?.status === "published" ? "Publié" : "Brouillon"}</div>
              </button>
            );
          })}
        </nav>

        {activeStage === "SD01" ? (
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
            <main className="min-w-0 space-y-5">
              <div className="flex flex-wrap items-center gap-2"><div><h2 className="text-lg font-bold">SD01 · Alignement stratégique</h2><p className="text-xs text-muted-foreground">Mode manuel : tous les champs restent modifiables.</p></div><div className="ml-auto flex gap-2"><Button variant="outline" onClick={() => void save(false)} disabled={Boolean(working)}>{working === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Enregistrer</Button><Button onClick={() => void save(true)} disabled={Boolean(working)}>{working === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Publier</Button></div></div>
              {sd01Document?.status === "review" ? <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200"><Sparkles className="mr-2 inline h-4 w-4" /> Brouillon généré par l’agent : relisez les faits et les prochaines étapes avant publication.</div> : null}
              <SD01Form content={content} onChange={setContent} />
            </main>

            <aside className="space-y-5">
              <Card className="border-primary/25 p-5">
                <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="h-4 w-4" /></span><div><h3 className="font-bold">Agent SD01</h3><p className="text-[11px] text-muted-foreground">Conversation complète → brouillon sourcé</p></div></div>
                <div className="mt-5 space-y-3">
                  <Label>Appels liés au deal</Label>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {data.linkedConversations.map(call => (
                      <label key={call.id} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 text-xs hover:border-primary/35">
                        <input type="checkbox" checked={selectedCalls.includes(call.id)} onChange={event => setSelectedCalls(current => event.target.checked ? [...current, call.id] : current.filter(id => id !== call.id))} className="mt-0.5 accent-[var(--primary)]" />
                        <span className="min-w-0"><span className="font-semibold">{call.title}</span><span className="mt-1 line-clamp-2 block text-muted-foreground">{call.transcriptText}</span>{call.imported ? <span className="mt-1 block text-emerald-300">Déjà enregistré · sera actualisé</span> : null}</span>
                      </label>
                    ))}
                    {!data.linkedConversations.length ? <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Aucun appel transcrit relié à ce deal. Collez une conversation ci-dessous.</p> : null}
                  </div>
                  <FormField label="Ou ajouter une conversation"><Input value={manualTitle} onChange={event => setManualTitle(event.target.value)} placeholder="Titre de la réunion" /><Area value={manualTranscript} onChange={setManualTranscript} rows={8} placeholder="Collez ici la transcription complète, les notes de réunion ou la conversation…" /></FormField>
                  <Button className="w-full" onClick={() => void generate()} disabled={Boolean(working) || (!selectedCalls.length && !manualTranscript.trim())}>{working === "generate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Générer le brouillon SD01</Button>
                  <p className="text-[10px] leading-4 text-muted-foreground">L’agent n’invente pas les informations manquantes : il les transforme en questions ouvertes. Il ne publie jamais seul.</p>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><h3 className="font-bold">Mémoire source</h3><Badge variant="outline">{data.sources.length}</Badge></div>
                <div className="mt-3 space-y-2">{data.sources.slice(0, 8).map(source => <div key={source.id} className="rounded-lg bg-muted/35 p-3 text-xs"><div className="font-semibold">{source.title}</div><div className="mt-1 text-muted-foreground">{source.characterCount.toLocaleString("fr-FR")} caractères · {source.source_type}</div></div>)}{!data.sources.length ? <p className="text-xs text-muted-foreground">Les conversations utilisées par l’agent apparaîtront ici.</p> : null}</div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-bold">Accès client</h3></div>
                <div className="mt-4 grid grid-cols-2 gap-2"><Button variant={room.access_mode === "email" ? "default" : "outline"} size="sm" onClick={() => setData(current => current && current.room ? { ...current, room: { ...current.room, access_mode: "email" } } : current)}>Email identifié</Button><Button variant={room.access_mode === "allowlist" ? "default" : "outline"} size="sm" onClick={() => setData(current => current && current.room ? { ...current, room: { ...current.room, access_mode: "allowlist" } } : current)}>Liste autorisée</Button></div>
                {room.access_mode === "allowlist" ? <div className="mt-3"><Area value={allowlist} onChange={setAllowlist} rows={5} placeholder="direction@client.com\nboard@client.com" /></div> : <p className="mt-3 text-xs leading-5 text-muted-foreground">Toute personne ayant le lien renseigne son email avant accès. Chaque visite est attribuée.</p>}
                <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => void saveAccess()} disabled={working === "access"}>{working === "access" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />} Enregistrer l’accès</Button>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /><h3 className="font-bold">Remarques du board</h3><Badge variant="outline">{data.comments.filter(comment => comment.status === "open").length}</Badge></div>
                <div className="mt-3 space-y-2">{data.comments.slice(0, 8).map(comment => <article key={comment.id} className={cn("rounded-lg border p-3 text-xs", comment.status === "open" ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-muted/25 opacity-65")}><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{comment.author_email}</span><Badge variant="outline" className="shrink-0">{comment.document_code}</Badge></div><p className="mt-2 whitespace-pre-line leading-5 text-muted-foreground">{comment.body}</p><div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{formatDate(comment.created_at)}</span>{comment.status === "open" ? <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled={working === `comment:${comment.id}`} onClick={() => void resolveComment(comment.id)}>{working === `comment:${comment.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />} Marquer traité</Button> : <span className="text-emerald-300">Traitée</span>}</div></article>)}{!data.comments.length ? <p className="text-xs text-muted-foreground">Les suggestions envoyées depuis la room apparaîtront ici.</p> : null}</div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><h3 className="font-bold">Dernières consultations</h3></div>
                <p className="mt-1 text-xs text-muted-foreground">Dernière activité : {formatDate(analytics.lastViewedAt)}</p>
                <div className="mt-3 space-y-2">{analytics.recentVisitors.map(visitor => <div key={visitor.email} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 p-3 text-xs"><div className="min-w-0"><div className="truncate font-semibold">{visitor.email}</div><div className="text-muted-foreground">{formatDate(visitor.lastSeenAt)}</div></div><Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />{formatDuration(visitor.activeSeconds)}</Badge></div>)}{!analytics.recentVisitors.length ? <p className="text-xs text-muted-foreground">Aucune consultation pour le moment.</p> : null}</div>
              </Card>
            </aside>
          </div>
        ) : (
          <Card className="p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div><h2 className="mt-4 text-xl font-bold">{activeStage} · {SD_STAGE_META[activeStage].title}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{SD_STAGE_META[activeStage].subtitle}. Le socle est prêt ; l’éditeur détaillé sera activé dans l’itération correspondante.</p><Badge variant="outline" className="mt-4">Statut : {currentDocument?.status || "draft"}</Badge></Card>
        )}
      </div>
    </div>
  );
}
