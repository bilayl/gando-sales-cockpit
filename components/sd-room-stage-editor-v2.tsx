"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileSignature, Loader2, Presentation, Save, Send, Target } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyStageContent, type SD02Content, type SD03Content, type SD04Content, type SD05Content, type SDStageContent } from "@/lib/sd-stage-content";
import { SD_STAGE_META, type SDCode, type SDDocumentRecord } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type RoomResponse = { documents: SDDocumentRecord[]; room: { id: string; title: string } | null };
const CODES: SDCode[] = ["SD02", "SD03", "SD04", "SD05"];
const OPTIONAL = new Set<SDCode>(["SD03", "SD04"]);
const REQUIRED_BEFORE: Partial<Record<SDCode, SDCode[]>> = {
  SD02: ["SD01"],
  SD03: ["SD02"],
  SD04: ["SD02"],
  SD05: ["SD01", "SD02"],
};

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
function SelectField({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">{children}</select>;
}
function hydrate(code: SDCode, raw: Record<string, unknown> | undefined): SDStageContent {
  const base = emptyStageContent(code) as Record<string, unknown>;
  if (code === "SD03") return { ...base, ...(raw || {}), pilot: { ...(base.pilot as object), ...(((raw || {}).pilot as object) || {}) } } as SDStageContent;
  return { ...base, ...(raw || {}) } as SDStageContent;
}

function SD02Form({ value, onChange }: { value: SD02Content; onChange: (value: SD02Content) => void }) {
  const set = <K extends keyof SD02Content>(key: K, next: SD02Content[K]) => onChange({ ...value, [key]: next });
  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="space-y-4 p-5">
        <div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Target className="h-4 w-4" /></div><div><h3 className="font-semibold">Cap commun</h3><p className="text-xs text-muted-foreground">Le SD02 doit pouvoir être relu en 30 secondes par un sponsor ou un directeur.</p></div></div>
        <Field label="Objectif business commun"><Area value={value.objective || ""} onChange={next => set("objective", next)} rows={4} placeholder="Ex. Valider un pilote Gando sur 3 agences avant généralisation réseau." /></Field>
        <Field label="Définition du succès"><Area value={value.successDefinition || ""} onChange={next => set("successDefinition", next)} rows={4} placeholder="Résultat concret qui permettra de dire : nous pouvons signer / déployer." /></Field>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Décision cible"><Input type="date" value={value.decisionDate || ""} onChange={event => set("decisionDate", event.target.value)} /></Field><Field label="Go-live cible"><Input type="date" value={value.targetGoLiveDate || ""} onChange={event => set("targetGoLiveDate", event.target.value)} /></Field><Field label="Prochain point"><Input type="date" value={value.nextMeetingDate || ""} onChange={event => set("nextMeetingDate", event.target.value)} /></Field></div>
      </Card>
      <Card className="space-y-4 p-5">
        <Field label="Processus de décision" hint="Une ligne par validation : métier, direction, IT, achats, juridique…"><Area value={textLines(value.decisionProcess)} onChange={next => set("decisionProcess", lines(next))} rows={7} placeholder="Sponsor métier valide le périmètre\nIT valide l’intégration\nAchats valide les conditions\nDirection signe" /></Field>
        <Field label="Bloqueurs actifs" hint="Uniquement ce qui peut réellement ralentir ou faire perdre le deal"><Area value={textLines(value.blockers)} onChange={next => set("blockers", lines(next))} rows={5} /></Field>
      </Card>
    </div>

    <Card className="space-y-4 p-5">
      <div><h3 className="font-semibold">Mutual Action Plan</h3><p className="mt-1 text-xs text-muted-foreground">Une ligne = chantier | action | organisation | responsable | date | dépendance | statut.</p></div>
      <Area
        value={(value.milestones || []).map(item => `${item.workstream || "business"} | ${item.milestone} | ${item.organization || "joint"} | ${item.owner} | ${item.dueDate} | ${item.dependency} | ${item.status || "not_started"}`).join("\n")}
        onChange={next => set("milestones", lines(next).map(row => {
          const [rawWorkstream="business", milestone="", rawOrganization="joint", owner="", dueDate="", dependency="", rawStatus="not_started"] = row.split("|").map(item => item.trim());
          const workstream = rawWorkstream === "technical" || rawWorkstream === "legal" || rawWorkstream === "procurement" || rawWorkstream === "other" ? rawWorkstream : "business";
          const organization = rawOrganization === "client" || rawOrganization === "gando" ? rawOrganization : "joint";
          const status = rawStatus === "done" || rawStatus === "in_progress" ? rawStatus : "not_started";
          return { milestone, workstream, organization, owner, dueDate, dependency, status };
        }).filter(item => item.milestone))}
        rows={11}
        placeholder="business | Valider le périmètre pilote | joint | Marie / Paul | 2026-09-05 | — | in_progress\ntechnical | Valider le flux API | client | CTO | 2026-09-12 | accès sandbox | not_started"
      />
    </Card>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5"><Field label="Engagements client"><Area value={textLines(value.clientCommitments)} onChange={next => set("clientCommitments", lines(next))} /></Field><Field label="Engagements Gando"><Area value={textLines(value.gandoCommitments)} onChange={next => set("gandoCommitments", lines(next))} /></Field><Field label="Critères de passage au closing"><Area value={textLines(value.exitCriteria)} onChange={next => set("exitCriteria", lines(next))} /></Field></Card>
      <Card className="space-y-4 p-5"><Field label="Dépendances"><Area value={textLines(value.dependencies)} onChange={next => set("dependencies", lines(next))} /></Field><Field label="Risques"><Area value={textLines(value.risks)} onChange={next => set("risks", lines(next))} /></Field></Card>
    </div>
  </div>;
}

function SD03Form({ value, onChange }: { value: SD03Content; onChange: (value: SD03Content) => void }) {
  const set = <K extends keyof SD03Content>(key: K, next: SD03Content[K]) => onChange({ ...value, [key]: next });
  return <div className="grid gap-5 xl:grid-cols-2"><Card className="space-y-4 p-5"><Field label="Synthèse solution"><Area value={value.solutionSummary} onChange={next => set("solutionSummary", next)} rows={5} /></Field><Field label="Dans le périmètre"><Area value={textLines(value.scopeIn)} onChange={next => set("scopeIn", lines(next))} /></Field><Field label="Hors périmètre"><Area value={textLines(value.scopeOut)} onChange={next => set("scopeOut", lines(next))} /></Field><Field label="Intégrations"><Area value={textLines(value.integrations)} onChange={next => set("integrations", lines(next))} /></Field><Field label="Données requises"><Area value={textLines(value.dataRequirements)} onChange={next => set("dataRequirements", lines(next))} /></Field></Card><Card className="space-y-4 p-5"><Field label="Sécurité & conformité"><Area value={textLines(value.securityAndCompliance)} onChange={next => set("securityAndCompliance", lines(next))} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Périmètre pilote"><Input value={value.pilot.perimeter} onChange={event => set("pilot", { ...value.pilot, perimeter: event.target.value })} /></Field><Field label="Durée pilote"><Input value={value.pilot.duration} onChange={event => set("pilot", { ...value.pilot, duration: event.target.value })} /></Field></div><Field label="Métriques de succès du pilote"><Area value={textLines(value.pilot.successMetrics)} onChange={next => set("pilot", { ...value.pilot, successMetrics: lines(next) })} /></Field><Field label="Plan de déploiement"><Area value={textLines(value.deploymentPlan)} onChange={next => set("deploymentPlan", lines(next))} /></Field><Field label="Responsables techniques"><Area value={textLines(value.technicalOwners)} onChange={next => set("technicalOwners", lines(next))} /></Field></Card></div>;
}

function SD04Form({ value, onChange }: { value: SD04Content; onChange: (value: SD04Content) => void }) {
  const set = <K extends keyof SD04Content>(key: K, next: SD04Content[K]) => onChange({ ...value, [key]: next });
  const setExecutive = (next: string) => onChange({ ...value, executiveMessage: next, offerSummary: next });
  return <div className="space-y-5">
    <Card className="overflow-hidden border-primary/20 p-0">
      <div className="border-b border-border bg-gradient-to-r from-primary/[.12] to-transparent p-5"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary p-2 text-primary-foreground"><Presentation className="h-4 w-4" /></div><div><h3 className="font-semibold">Narratif du pitch deck</h3><p className="mt-1 text-xs text-muted-foreground">Le deck doit raconter : problème → urgence → solution → preuve → impact → offre → décision.</p></div></div></div>
      <div className="grid gap-5 p-5 xl:grid-cols-2"><Field label="Titre du deck"><Input value={value.deckTitle || ""} onChange={event => set("deckTitle", event.target.value)} placeholder="Gando × Client — sécuriser la location sans bloquer les fonds" /></Field><Field label="Sous-titre / promesse"><Input value={value.deckSubtitle || ""} onChange={event => set("deckSubtitle", event.target.value)} placeholder="Une infrastructure de confiance pour convertir davantage et réduire la friction" /></Field><div className="xl:col-span-2"><Field label="Message exécutif" hint="La phrase que le décideur doit retenir même s’il ne lit qu’une slide."><Area value={value.executiveMessage || value.offerSummary || ""} onChange={setExecutive} rows={4} /></Field></div></div>
    </Card>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-primary">Slides 02–04</div><Field label="Problème / enjeux client"><Area value={textLines(value.problem)} onChange={next => set("problem", lines(next))} rows={6} placeholder="Une idée forte par ligne" /></Field><Field label="Solution Gando"><Area value={textLines(value.solution)} onChange={next => set("solution", lines(next))} rows={6} /></Field><Field label="Pourquoi Gando / différenciation"><Area value={textLines(value.differentiators)} onChange={next => set("differentiators", lines(next))} rows={6} /></Field></Card>
      <Card className="space-y-4 p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-primary">Slides 05–07</div><Field label="Preuves / références / signaux de confiance"><Area value={textLines(value.proofPoints)} onChange={next => set("proofPoints", lines(next))} rows={6} placeholder="Traction, clients, résultats pilote, sécurité, partenaires…" /></Field><Field label="Impact / ROI" hint="Une ligne : métrique | actuel | cible | valeur"><Area value={(value.businessCase || []).map(item => `${item.metric} | ${item.baseline} | ${item.target} | ${item.value}`).join("\n")} onChange={next => set("businessCase", lines(next).map(row => { const [metric="", baseline="", target="", metricValue=""] = row.split("|").map(item => item.trim()); return { metric, baseline, target, value: metricValue }; }).filter(item => item.metric))} rows={7} /></Field></Card>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-primary">Slide 08 · Offre</div><Field label="Modèle commercial" hint="Une ligne : produit / offre | modèle | prix | notes"><Area value={(value.pricing || []).map(item => `${item.item} | ${item.model} | ${item.price} | ${item.notes}`).join("\n")} onChange={next => set("pricing", lines(next).map(row => { const [item="", model="", price="", notes=""] = row.split("|").map(value => value.trim()); return { item, model, price, notes }; }).filter(item => item.item))} rows={8} /></Field><Field label="Validité de l’offre"><Input type="date" value={value.validityDate || ""} onChange={event => set("validityDate", event.target.value)} /></Field></Card>
      <Card className="space-y-4 p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-primary">Slides 09–10 · Décision</div><Field label="Plan de déploiement / rollout"><Area value={textLines(value.rolloutPlan)} onChange={next => set("rolloutPlan", lines(next))} rows={6} /></Field><Field label="Décision / call-to-action"><Area value={value.callToAction || ""} onChange={next => set("callToAction", next)} rows={4} placeholder="Ex. Valider le pilote et lancer le cadrage technique le 15 septembre." /></Field></Card>
    </div>
  </div>;
}

function SD05Form({ value, onChange }: { value: SD05Content; onChange: (value: SD05Content) => void }) {
  const set = <K extends keyof SD05Content>(key: K, next: SD05Content[K]) => onChange({ ...value, [key]: next });
  return <div className="space-y-5">
    <Card className="space-y-5 p-5"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileSignature className="h-4 w-4" /></div><div><h3 className="font-semibold">Document contractuel de référence</h3><p className="text-xs text-muted-foreground">SD05 doit refléter le vrai état du contrat, pas seulement une checklist juridique.</p></div></div><div className="grid gap-4 lg:grid-cols-4"><Field label="Titre du contrat"><Input value={value.contractTitle || ""} onChange={event => set("contractTitle", event.target.value)} placeholder="Convention de services Gando" /></Field><Field label="Référence"><Input value={value.contractReference || ""} onChange={event => set("contractReference", event.target.value)} placeholder="GANDO-CLIENT-2026-01" /></Field><Field label="Version"><Input value={value.contractVersion || ""} onChange={event => set("contractVersion", event.target.value)} placeholder="v1.0" /></Field><Field label="Statut"><SelectField value={value.contractStatus || "draft"} onChange={next => set("contractStatus", next as SD05Content["contractStatus"])}><option value="draft">Brouillon</option><option value="internal_review">Revue interne</option><option value="client_review">Revue client</option><option value="ready_to_sign">Prêt à signer</option><option value="signed">Signé</option></SelectField></Field></div><Field label="Lien vers le contrat / PDF / e-signature"><Input value={value.contractUrl || ""} onChange={event => set("contractUrl", event.target.value)} placeholder="https://…" /></Field><Field label="Synthèse contractuelle"><Area value={value.contractSummary || ""} onChange={next => set("contractSummary", next)} rows={4} placeholder="Objet, périmètre, prix, responsabilités et éléments spécifiques négociés." /></Field></Card>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Date d’effet"><Input type="date" value={value.effectiveDate || ""} onChange={event => set("effectiveDate", event.target.value)} /></Field><Field label="Deadline de signature"><Input type="date" value={value.signatureDeadline || ""} onChange={event => set("signatureDeadline", event.target.value)} /></Field></div><Field label="Durée initiale"><Input value={value.term || ""} onChange={event => set("term", event.target.value)} placeholder="12 mois" /></Field><Field label="Renouvellement"><Input value={value.renewal || ""} onChange={event => set("renewal", event.target.value)} placeholder="Tacite / annuel / sans renouvellement…" /></Field><Field label="Préavis / résiliation"><Input value={value.terminationNotice || ""} onChange={event => set("terminationNotice", event.target.value)} /></Field><Field label="Conditions finales"><Area value={textLines(value.finalConditions)} onChange={next => set("finalConditions", lines(next))} /></Field></Card>
      <Card className="space-y-4 p-5"><Field label="Points juridiques" hint="Une ligne : sujet | open/in_review/approved | responsable | notes"><Area value={(value.legalItems || []).map(item => `${item.topic} | ${item.status} | ${item.owner} | ${item.notes}`).join("\n")} onChange={next => set("legalItems", lines(next).map(row => { const [topic="", rawStatus="", owner="", notes=""] = row.split("|").map(value => value.trim()); const status = rawStatus === "approved" || rawStatus === "in_review" ? rawStatus : "open"; return { topic, status, owner, notes }; }).filter(item => item.topic))} rows={10} /></Field></Card>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="space-y-4 p-5"><Field label="Signataires" hint="Une ligne : nom | rôle | organisation | email | pending/sent/signed"><Area value={(value.signatories || []).map(item => `${item.name} | ${item.role} | ${item.organization} | ${item.email || ""} | ${item.signatureStatus || "pending"}`).join("\n")} onChange={next => set("signatories", lines(next).map(row => { const [name="", role="", organization="", email="", rawStatus="pending"] = row.split("|").map(value => value.trim()); const signatureStatus = rawStatus === "sent" || rawStatus === "signed" ? rawStatus : "pending"; return { name, role, organization, email, signatureStatus }; }).filter(item => item.name))} rows={8} /></Field><Field label="Étapes de signature"><Area value={textLines(value.signatureSteps)} onChange={next => set("signatureSteps", lines(next))} rows={6} /></Field></Card>
      <Card className="space-y-4 p-5"><Field label="Date de go-live"><Input type="date" value={value.goLiveDate || ""} onChange={event => set("goLiveDate", event.target.value)} /></Field><Field label="Plan de handover après signature"><Area value={textLines(value.handoverPlan)} onChange={next => set("handoverPlan", lines(next))} rows={8} placeholder="Kick-off\nCréation des accès\nConfiguration\nFormation\nMise en production" /></Field></Card>
    </div>
  </div>;
}

function syncCompatibility(code: SDCode, content: SDStageContent): SDStageContent {
  if (code !== "SD04") return content;
  const value = content as SD04Content;
  return {
    ...value,
    offerSummary: value.executiveMessage || value.offerSummary || "",
    assumptions: value.problem || [],
    commercialTerms: [...(value.differentiators || []), ...(value.proofPoints || [])],
    procurementSteps: [...(value.rolloutPlan || []), ...(value.callToAction ? [`Décision attendue — ${value.callToAction}`] : [])],
  };
}

export function SDRoomStageEditorV2({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [active, setActive] = useState<SDCode>("SD02");
  const [content, setContent] = useState<SDStageContent>(emptyStageContent("SD02") as SDStageContent);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const doc = payload.documents.find((item: SDDocumentRecord) => item.code === active);
      setContent(hydrate(active, doc?.content as Record<string, unknown>));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [active, dealId]);

  useEffect(() => { void load(); }, [load]);

  const selectStage = (code: SDCode) => {
    setActive(code);
    const doc = data?.documents.find(item => item.code === code);
    setContent(hydrate(code, doc?.content as Record<string, unknown>));
  };

  const current = data?.documents.find(item => item.code === active);
  const requiredBefore = REQUIRED_BEFORE[active] || [];
  const missingRequired = requiredBefore.filter(code => data?.documents.find(item => item.code === code)?.status !== "validated");
  const canPublish = missingRequired.length === 0;

  const save = async (publish: boolean) => {
    setWorking(true);
    try {
      const compatibleContent = syncCompatibility(active, content);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: active, content: compatibleContent, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(currentData => currentData ? { ...currentData, documents: currentData.documents.map(doc => doc.code === active ? payload.document : doc) } : currentData);
      setContent(hydrate(active, payload.document.content));
      toast.success(publish ? `${active} publié dans la Room` : `${active} enregistré`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setWorking(false);
    }
  };

  const title = useMemo(() => `${active} · ${SD_STAGE_META[active].title}`, [active]);
  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const requirementCopy = canPublish ? `${requiredBefore.join(" + ") || "Aucun prérequis"} validé · publication autorisée` : `${missingRequired.join(" + ")} à valider avant publication`;
  const stageIcon = active === "SD04" ? Presentation : active === "SD05" ? FileSignature : Target;
  const StageIcon = stageIcon;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1500px] space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-primary">Parcours de closing</div><h1 className="mt-1 text-2xl font-bold">De l’accord de principe à la signature</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">SD02 pilote le deal avec un plan partagé. SD03 cadre la solution si nécessaire. SD04 transforme le business case en pitch deck. SD05 devient le dossier contractuel jusqu’à la signature.</p></div><Badge variant="outline" className="w-fit">SD01 → SD02 → SD04 → SD05</Badge></div></header>

    <nav className="grid gap-2 md:grid-cols-4">{CODES.map(code => { const doc = data?.documents.find(item => item.code === code); const optional = OPTIONAL.has(code); return <button type="button" key={code} onClick={() => selectStage(code)} className={cn("rounded-xl border p-3 text-left transition", active === code ? "border-primary bg-primary/[.08] shadow-sm" : "border-border bg-card hover:border-primary/30")}><div className="flex items-center justify-between"><span className="text-xs font-bold text-primary">{code}</span>{doc?.status === "validated" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}</div><div className="mt-1 text-xs font-semibold">{SD_STAGE_META[code].title}</div><div className="mt-1 text-[10px] text-muted-foreground">{optional ? "Facultatif" : "Obligatoire"} · {doc?.status || "draft"}</div></button>; })}</nav>

    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><StageIcon className="h-4 w-4" /></div><div><h2 className="text-lg font-bold">{title}</h2><p className="text-xs leading-5 text-muted-foreground">{SD_STAGE_META[active].subtitle}</p></div></div><Badge variant="outline" className={cn("w-fit lg:ml-auto", canPublish ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600")}>{requirementCopy}</Badge><div className="flex gap-2"><Button variant="outline" onClick={() => void save(false)} disabled={working}><Save className="mr-2 h-4 w-4" /> Enregistrer</Button><Button onClick={() => void save(true)} disabled={working || !canPublish}><Send className="mr-2 h-4 w-4" /> Publier</Button></div></div>

    {active === "SD02" ? <SD02Form value={content as SD02Content} onChange={setContent} /> : active === "SD03" ? <SD03Form value={content as SD03Content} onChange={setContent} /> : active === "SD04" ? <SD04Form value={content as SD04Content} onChange={setContent} /> : <SD05Form value={content as SD05Content} onChange={setContent} />}

    {current?.status === "validated" ? <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[.06] px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Cette version a déjà été validée par le client.</div> : null}
  </div></div>;
}
