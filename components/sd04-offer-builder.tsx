"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Eye, ExternalLink, FileText, LayoutTemplate, Loader2, Plus, Save, Send, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SD04ProposalVisual } from "@/components/sd04-proposal-visual";
import { createEmptySD04, type SD04Content } from "@/lib/sd-stage-content";
import type { SD01Content, SDDocumentRecord, SDRoomMode } from "@/lib/sd-room-types";

type RoomResponse = {
  documents: SDDocumentRecord[];
  room: { id: string; title: string; company_name?: string; share_token?: string; room_mode?: SDRoomMode } | null;
};
type ProposalMode = "visual" | "file";
type EditorTab = "editor" | "preview";
const ROOM_BASE_URL = (process.env.NEXT_PUBLIC_ROOM_BASE_URL || "https://room.gando.pro").replace(/\/$/, "");
const pdf = (value: string) => /^https?:\/\/\S+$/i.test(value || "");
const cleanRows = (lines: string[]) => lines.map(line => line.trim()).filter(Boolean);
const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value || 0);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[12px] font-semibold text-foreground">{label}</span>{hint ? <span className="ml-2 text-[11px] font-normal text-muted-foreground">{hint}</span> : null}<div className="mt-2">{children}</div></label>;
}
function Area({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-[14px] leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} rows={rows} />;
}
function Sections({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return <Card className="space-y-4 rounded-2xl p-5 sm:p-6"><div><h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>{detail ? <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{detail}</p> : null}</div>{children}</Card>;
}

export function SD04OfferBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [value, setValue] = useState<SD04Content>(createEmptySD04());
  const [mode, setMode] = useState<ProposalMode>("visual");
  const [tab, setTab] = useState<EditorTab>("editor");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible.");
      setData(payload);
      const document = (payload.documents || []).find((item: SDDocumentRecord) => item.code === "SD04");
      const original = (document?.content || {}) as Partial<SD04Content>;
      const empty = createEmptySD04();
      const hydrated: SD04Content = {
        ...empty,
        partnerRevenueExample: { ...empty.partnerRevenueExample, enabled: false },
        ...original,
      };
      const legacyFile = pdf(hydrated.deckSubtitle) || Boolean(hydrated.proposalFileUrl);
      const nextMode = hydrated.presentationMode || (legacyFile ? "file" : "visual");
      setValue({
        ...hydrated,
        presentationMode: nextMode,
        // Migrate legacy PDF-only proposals without deleting their source URL.
        proposalFileUrl: hydrated.proposalFileUrl || (pdf(hydrated.deckSubtitle) ? hydrated.deckSubtitle : ""),
        proposalFileName: hydrated.proposalFileName || (pdf(hydrated.deckSubtitle) ? hydrated.deckTitle || "Proposition commerciale.pdf" : ""),
      });
      setMode(nextMode);
      setDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible.");
    } finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const room = data?.room;
  const companyName = room?.company_name || room?.title || "Votre partenaire";
  const document = data?.documents.find(item => item.code === "SD04");
  const locked = document?.status === "validated";
  const published = document?.status === "published" || locked;
  const sd02Validated = data?.documents.find(item => item.code === "SD02")?.status === "validated";
  const canPublish = Boolean(sd02Validated);
  const fileUrl = value.proposalFileUrl || (pdf(value.deckSubtitle) ? value.deckSubtitle : "");
  const fileName = value.proposalFileName || value.deckTitle || "Proposition commerciale.pdf";
  const hasVisual = Boolean(value.deckTitle.trim() && value.executiveMessage.trim() && (value.pricing.some(row => row.item.trim()) || value.solution.some(Boolean) || value.proofPoints.some(Boolean)));
  const canSave = mode === "file" ? Boolean(fileUrl) : Boolean(value.deckTitle.trim());
  const canPublishContent = mode === "file" ? Boolean(fileUrl) : hasVisual;
  const roomUrl = room?.share_token ? `${ROOM_BASE_URL}/r/${room.share_token}` : "";
  const sanitized: SD04Content = {
    ...value,
    presentationMode: mode,
    deckTitle: value.deckTitle.trim(),
    deckSubtitle: mode === "visual" && pdf(value.deckSubtitle) ? "" : value.deckSubtitle.trim(),
    executiveMessage: value.executiveMessage.trim(),
    offerSummary: value.executiveMessage.trim(),
    problem: cleanRows(value.problem),
    solution: cleanRows(value.solution),
    proofPoints: cleanRows(value.proofPoints),
    differentiators: cleanRows(value.differentiators),
    rolloutPlan: cleanRows(value.rolloutPlan),
    commercialTerms: cleanRows(value.commercialTerms),
    pricing: value.pricing.map(row => ({
      item: row.item.trim(), model: row.model.trim(), price: row.price.trim(), notes: row.notes.trim(),
    })).filter(row => row.item),
    proposalFileUrl: fileUrl,
    proposalFileName: fileName,
  };

  function set<K extends keyof SD04Content>(key: K, next: SD04Content[K]) {
    setValue(current => ({ ...current, [key]: next }));
    setDirty(true);
  }
  function switchMode(next: ProposalMode) {
    if (locked) return;
    if (mode === next) return;
    setMode(next);
    setValue(current => ({
      ...current,
      presentationMode: next,
      // Former enterprise SD04 stored a PDF URL in deckSubtitle.
      // Keep the uploaded file, but not as the new visual's headline.
      deckSubtitle: next === "visual" && pdf(current.deckSubtitle) ? "" : current.deckSubtitle,
    }));
    setTab("editor");
    setDirty(true);
  }
  function generateTemplate() {
    if (locked) return;
    setValue(current => ({
      ...current,
      deckTitle: current.deckTitle || `Gando × ${companyName} — Proposition de collaboration`,
      deckSubtitle: current.deckSubtitle || "Simplifier la caution et faciliter la réservation",
      executiveMessage: current.executiveMessage || `Accompagner ${companyName} avec une caution digitale sans immobiliser les fonds du locataire, tout en sécurisant le parcours du loueur.`,
      problem: current.problem.some(Boolean) ? current.problem : ["La caution traditionnelle peut immobiliser une partie du budget du locataire.", "Le blocage de fonds ou les limitations de carte compliquent la réservation."],
      solution: current.solution.some(Boolean) ? current.solution : ["Un parcours de caution entièrement digitalisé", "Aucun blocage de fonds pour le locataire", "Une garantie d'encaissement soumise aux conditions contractuelles"],
      proofPoints: current.proofPoints.some(Boolean) ? current.proofPoints : ["Fluidifier l'expérience de réservation", "Réduire les contraintes au comptoir", "Permettre le suivi des cautions depuis un espace dédié"],
      rolloutPlan: current.rolloutPlan.some(Boolean) ? current.rolloutPlan : ["Valider le périmètre pilote", "Configurer la solution pour les équipes", "Mesurer les premiers résultats avant déploiement"],
      callToAction: current.callToAction || "Valider les conditions commerciales et définir le démarrage.",
    }));
    setMode("visual");
    setTab("editor");
    setDirty(true);
    toast.success("Structure de proposition créée. Complétez les tarifs avant publication.");
  }

  function prefillFromSD01() {
    if (locked) return;
    const source = data?.documents.find(item => item.code === "SD01")?.content as SD01Content | undefined;
    if (!source) return toast.error("Complétez d'abord le SD01.");
    const pricing = source.pricingProposal;
    const proposedPrices = pricing?.enabled ? [
      { item: "Frais de sécurisation Gando", model: "commission", price: `${pricing.gandoRatePercent.toLocaleString("fr-FR")} % HT`, notes: pricing.gandoRateNote || "Tarif à valider" },
      ...(pricing.partnerMarginPercent > 0 ? [{ item: "Marge partenaire", model: "commission", price: `${pricing.partnerMarginPercent.toLocaleString("fr-FR")} % HT`, notes: pricing.partnerMarginNote || "Marge loueur proposée" }] : []),
    ] : [];
    setValue(current => ({
      ...current,
      presentationMode: "visual",
      deckTitle: current.deckTitle || `Proposition Gando × ${companyName}`,
      executiveMessage: current.executiveMessage || source.executiveSummary || "",
      problem: current.problem.some(Boolean) ? current.problem : (source.painPoints || []).map(pain => pain.title).filter(Boolean),
      solution: current.solution.some(Boolean) ? current.solution : (source.solutionFit || []).map(item => item.response).filter(Boolean),
      proofPoints: current.proofPoints.some(Boolean) ? current.proofPoints : source.gandoProposal ? [source.gandoProposal] : [],
      rolloutPlan: current.rolloutPlan.some(Boolean) ? current.rolloutPlan : (source.nextSteps || []).map(item => item.action).filter(Boolean),
      pricing: current.pricing.some(row => row.item.trim()) ? current.pricing : proposedPrices,
      partnerRevenueExample: pricing?.enabled && !current.partnerRevenueExample.enabled ? {
        enabled: false,
        averageDeposit: pricing.averageDepositAmount || 0,
        monthlyActivations: pricing.monthlyDeposits || 0,
        partnerMarginRate: pricing.partnerMarginPercent || 0,
      } : current.partnerRevenueExample,
    }));
    setMode("visual");
    setTab("editor");
    setDirty(true);
    toast.success("Les éléments disponibles du SD01 ont été repris. Vérifiez les tarifs avant publication.");
  }

  async function upload(file: File) {
    if (locked || working) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") return toast.error("Sélectionnez un PDF.");
    if (!file.size || file.size > 20 * 1024 * 1024) return toast.error("Le PDF doit peser moins de 20 Mo.");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd04-pdf`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Import impossible.");
      setValue(current => ({
        ...current,
        presentationMode: "file",
        deckTitle: current.deckTitle || (payload.name || file.name).replace(/\.pdf$/i, ""),
        proposalFileUrl: payload.url || "",
        proposalFileName: payload.name || file.name,
      }));
      setMode("file");
      setDirty(true);
      toast.success("PDF importé. Enregistrez puis publiez la proposition.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible.");
    } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function save(publish: boolean) {
    if (working || locked) return;
    if (!canSave) return toast.error(mode === "file" ? "Importez d'abord votre PDF." : "Ajoutez au minimum un titre.");
    if (publish && !canPublish) return toast.error("Le SD02 doit être validé avant la publication du SD04.");
    if (publish && !canPublishContent) return toast.error("Complétez au moins le titre, le message et le contenu de la proposition.");
    if (publish && mode === "visual" && sanitized.pricing.some(row => !row.price || /^(à définir|a definir|tbd|\[.*\])$/i.test(row.price))) {
      return toast.error("Renseignez tous les tarifs affichés avant publication.");
    }
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "SD04", content: sanitized, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible.");
      setData(current => current ? { ...current, documents: current.documents.map(item => item.code === "SD04" ? payload.document : item) } : current);
      setValue(current => ({ ...current, ...(payload.document.content as SD04Content) }));
      setDirty(false);
      toast.success(publish ? "Proposition publiée dans la Deal Room." : "Brouillon enregistré.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally { setWorking(false); }
  }

  async function copyLink() {
    if (!roomUrl) return;
    try { await navigator.clipboard.writeText(roomUrl); toast.success("Lien de la Deal Room copié."); }
    catch { toast.error("Impossible de copier automatiquement le lien."); }
  }

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  if (!room) return <div className="p-8 text-sm text-destructive">Impossible de charger la Deal Room.</div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7">
    <div className="mx-auto max-w-[1440px] space-y-5">
      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="flex flex-col gap-5 bg-primary/[0.035] p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><LayoutTemplate className="size-5" /></div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">SD04 · Deal entreprise</div>
              <h1 className="mt-1 text-[25px] font-semibold tracking-[-0.04em]">Construire une proposition</h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-6 text-muted-foreground">Créez une proposition visuelle personnalisée ou partagez votre propre PDF. Le client retrouvera la version publiée dans sa Deal Room.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className={locked ? "border-emerald-500/30 text-emerald-600" : ""}>{locked ? <><CheckCircle2 className="mr-1 size-3.5" /> Validée par le client</> : published ? "Publiée" : "Brouillon"}</Badge>
                {dirty ? <Badge variant="outline">Modifications non enregistrées</Badge> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setTab(tab === "editor" ? "preview" : "editor")}><Eye className="mr-2 size-4" />{tab === "editor" ? "Aperçu client" : "Revenir à l'édition"}</Button>
            <Button variant="outline" disabled={working || uploading || locked || !canSave} onClick={() => void save(false)}><Save className="mr-2 size-4" />Enregistrer</Button>
            <Button disabled={working || uploading || locked || !canPublish || !canPublishContent} onClick={() => void save(true)}>{working ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}{published ? "Republier" : "Publier"}</Button>
          </div>
        </div>
        {!canPublish && !locked ? <div className="border-t border-amber-500/15 bg-amber-500/[0.06] px-5 py-3 text-[12px] leading-5 text-amber-700 lg:px-6">Vous pouvez préparer et enregistrer le SD04 dès maintenant. La publication nécessite la validation du SD02 par le client.</div> : null}
        {locked ? <div className="border-t border-emerald-500/15 bg-emerald-500/[0.06] px-5 py-3 text-[12px] text-emerald-700">La proposition est validée : son contenu est figé. Le document signé se gère séparément dans SD05.</div> : null}
        {published && roomUrl ? <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3 lg:px-6">
          <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{roomUrl}</div>
          <Button variant="outline" size="sm" onClick={() => void copyLink()}><Copy className="mr-1.5 size-3.5" />Copier le lien</Button>
          <Button variant="outline" size="sm" asChild><a href={roomUrl} target="_blank" rel="noopener noreferrer">Ouvrir <ExternalLink className="ml-1.5 size-3.5" /></a></Button>
        </div> : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" disabled={locked} onClick={() => switchMode("visual")} className={`flex gap-4 rounded-2xl border p-5 text-left transition ${mode === "visual" ? "border-primary bg-primary/[0.05] ring-1 ring-primary/15" : "border-border bg-card hover:border-primary/40"} disabled:opacity-75`}>
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LayoutTemplate className="size-5" /></div>
          <div><div className="font-semibold">Créer une proposition visuelle</div><p className="mt-1 text-[12px] leading-5 text-muted-foreground">Rédiger, personnaliser les prix, mettre en page automatiquement et voir le rendu en direct.</p></div>
        </button>
        <button type="button" disabled={locked} onClick={() => switchMode("file")} className={`flex gap-4 rounded-2xl border p-5 text-left transition ${mode === "file" ? "border-primary bg-primary/[0.05] ring-1 ring-primary/15" : "border-border bg-card hover:border-primary/40"} disabled:opacity-75`}>
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><FileText className="size-5" /></div>
          <div><div className="font-semibold">Importer une proposition PDF</div><p className="mt-1 text-[12px] leading-5 text-muted-foreground">Utiliser une proposition existante et l'afficher dans la Deal Room sans la refaire.</p></div>
        </button>
      </div>

      {mode === "file" ? <div className="space-y-4">
        <input ref={fileInput} type="file" accept=".pdf,application/pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        <Card className="rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-[16px] font-semibold">Votre document commercial</h2><p className="mt-1 text-[12px] text-muted-foreground">PDF jusqu'à 20 Mo · conserve les propositions déjà importées.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={locked || uploading} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}{fileUrl ? "Remplacer" : "Importer un PDF"}</Button>
              {fileUrl && !locked ? <Button variant="ghost" size="sm" onClick={() => { set("proposalFileUrl", ""); setValue(current => ({ ...current, proposalFileUrl: "", proposalFileName: "", deckSubtitle: pdf(current.deckSubtitle) ? "" : current.deckSubtitle })); }}><Trash2 className="mr-2 size-4" />Retirer</Button> : null}
            </div>
          </div>
          {!fileUrl ? <button type="button" disabled={locked || uploading} onClick={() => fileInput.current?.click()} className="mt-5 grid min-h-[210px] w-full place-items-center rounded-2xl border-2 border-dashed border-border bg-muted/15 p-8 text-center text-sm text-muted-foreground transition hover:border-primary/50"><div>{uploading ? <Loader2 className="mx-auto size-8 animate-spin text-primary" /> : <UploadCloud className="mx-auto size-9 text-primary" />}<div className="mt-3 font-semibold text-foreground">Sélectionner un PDF</div><div className="mt-1 text-xs">Le fichier sera visible uniquement après publication.</div></div></button> : <div className="mt-5"><SD04ProposalVisual content={{ ...sanitized, presentationMode: "file" }} companyName={companyName} compact /></div>}
        </Card>
      </div> : <div className={tab === "editor" ? "grid items-start gap-5 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]" : "mx-auto max-w-[990px]"}>
        {tab === "editor" ? <div className="space-y-4">
          <Sections title="Introduction" detail="Ce que le décideur doit comprendre en quelques secondes.">
            <Field label="Titre de la proposition"><Input value={value.deckTitle} onChange={event => set("deckTitle", event.target.value)} disabled={locked} placeholder={`Gando × ${companyName} — Proposition commerciale`} /></Field>
            <Field label="Sous-titre / promesse"><Input value={pdf(value.deckSubtitle) ? "" : value.deckSubtitle} onChange={event => set("deckSubtitle", event.target.value)} disabled={locked} placeholder="Une expérience de caution plus simple pour vos clients" /></Field>
            <Field label="Message exécutif"><Area value={value.executiveMessage} onChange={next => set("executiveMessage", next)} rows={4} placeholder="Votre proposition de valeur et le bénéfice attendu…" /></Field>
            {!locked ? <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={generateTemplate}><Sparkles className="mr-2 size-4" />Générer une trame Gando</Button>
              <Button variant="outline" size="sm" onClick={prefillFromSD01}><FileText className="mr-2 size-4" />Reprendre le SD01</Button>
            </div> : null}
          </Sections>
          <Sections title="Problème & solution" detail="Un élément par ligne. Le visuel est automatiquement mis en forme.">
            <Field label="Enjeux du client"><Area value={value.problem.join("\n")} onChange={next => set("problem", next.split("\n"))} rows={3} placeholder="Blocage de cautions trop élevé\nParcours client trop long" /></Field>
            <Field label="Ce que propose Gando"><Area value={value.solution.join("\n")} onChange={next => set("solution", next.split("\n"))} rows={4} placeholder="Caution sans blocage de fonds\nParcours digitalisé" /></Field>
            <Field label="Points forts / résultats attendus"><Area value={value.proofPoints.join("\n")} onChange={next => set("proofPoints", next.split("\n"))} rows={3} placeholder="Gain de temps au comptoir\nRéduction des frictions à la réservation" /></Field>
          </Sections>
          <Sections title="Tarification · HT" detail="Chaque tarif devient une carte visuelle dans la proposition. Utilisez des montants validés, jamais des tarifs fictifs.">
            {value.pricing.map((row, index) => <div key={index} className="rounded-xl border border-border bg-muted/10 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_.75fr_auto]">
                <Field label="Intitulé"><Input value={row.item} disabled={locked} placeholder="Ex. Frais de sécurisation" onChange={event => set("pricing", value.pricing.map((item, i) => i === index ? { ...item, item: event.target.value } : item))} /></Field>
                <Field label="Prix"><Input value={row.price} disabled={locked} placeholder="Ex. 2,5 % HT" onChange={event => set("pricing", value.pricing.map((item, i) => i === index ? { ...item, price: event.target.value } : item))} /></Field>
                {!locked ? <button type="button" aria-label="Supprimer ce tarif" className="mt-7 h-10 w-10 rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" onClick={() => set("pricing", value.pricing.filter((_, i) => i !== index))}><Trash2 className="mx-auto size-4" /></button> : <span />}
              </div>
              <Field label="Précision"><Input value={row.notes} disabled={locked} placeholder="Ex. Frais appliqués par caution activée" onChange={event => set("pricing", value.pricing.map((item, i) => i === index ? { ...item, notes: event.target.value } : item))} /></Field>
            </div>)}
            {!locked ? <Button variant="outline" size="sm" onClick={() => set("pricing", [...value.pricing, { item: "", price: "", model: "commission", notes: "" }])}><Plus className="mr-2 size-4" />Ajouter un tarif</Button> : null}
          </Sections>
          <Sections title="Projection de marge partenaire" detail="Facultatif : les hypothèses sont indicatives et présentées HT.">
            <label className="flex items-center gap-2 text-[12px] font-semibold"><input type="checkbox" className="size-4 accent-violet-600" checked={value.partnerRevenueExample.enabled} disabled={locked} onChange={event => set("partnerRevenueExample", { ...value.partnerRevenueExample, enabled: event.target.checked })} />Afficher un exemple de revenu pour le loueur</label>
            {value.partnerRevenueExample.enabled ? <>
              <div className="grid gap-3 sm:grid-cols-3">
                {([["averageDeposit", "Caution moyenne (€)", 50], ["monthlyActivations", "Cautions / mois", 1], ["partnerMarginRate", "Marge loueur (%)", 0.1]] as const).map(([key, label, step]) => <Field key={key} label={label}><Input type="number" min={0} step={step} value={value.partnerRevenueExample[key]} disabled={locked} onChange={event => set("partnerRevenueExample", { ...value.partnerRevenueExample, [key]: Math.max(0, Number(event.target.value) || 0) })} /></Field>)}
              </div>
              <p className="rounded-xl bg-primary/[0.05] px-4 py-3 text-[12px] text-muted-foreground">Projection : <strong className="text-foreground">{money(value.partnerRevenueExample.averageDeposit * value.partnerRevenueExample.monthlyActivations * value.partnerRevenueExample.partnerMarginRate / 100)} HT / mois</strong>, à volume constant.</p>
            </> : null}
          </Sections>
          <Sections title="Conditions & déploiement" detail="Ajoutez les conditions utiles, sans surcharger la proposition.">
            <Field label="Conditions commerciales"><Area value={value.commercialTerms.join("\n")} onChange={next => set("commercialTerms", next.split("\n"))} rows={4} placeholder="Durée de la caution : 60 jours\nConditions d'encaissement selon le contrat" /></Field>
            <Field label="Étapes de déploiement"><Area value={value.rolloutPlan.join("\n")} onChange={next => set("rolloutPlan", next.split("\n"))} rows={3} placeholder="Validation des conditions\nConfiguration\nLancement pilote" /></Field>
            <Field label="Prochaine étape"><Input value={value.callToAction} onChange={event => set("callToAction", event.target.value)} disabled={locked} placeholder="Valider cette proposition pour préparer le contrat" /></Field>
          </Sections>
        </div> : null}
        <div className={tab === "editor" ? "xl:sticky xl:top-24" : ""}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold"><Eye className="size-4 text-primary" />Aperçu en direct · visible par le client après publication</div>
            {tab === "editor" ? <Button variant="ghost" size="sm" onClick={() => setTab("preview")}>Agrandir <ExternalLink className="ml-1.5 size-3.5" /></Button> : null}
          </div>
          <SD04ProposalVisual content={sanitized} companyName={companyName} compact={tab === "editor"} />
        </div>
      </div>}
      <div className="flex flex-wrap items-center justify-end gap-2 pb-10">
        <span className="mr-auto text-[11px] text-muted-foreground">Le brouillon reste interne. Aucun envoi automatique au client.</span>
        <Button variant="outline" disabled={working || uploading || locked || !canSave} onClick={() => void save(false)}><Save className="mr-2 size-4" />Enregistrer le brouillon</Button>
        <Button disabled={working || uploading || locked || !canPublish || !canPublishContent} onClick={() => void save(true)}><Send className="mr-2 size-4" />Publier dans SD04</Button>
      </div>
    </div>
  </div>;
}
