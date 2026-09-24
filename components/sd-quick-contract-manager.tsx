"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileSignature, FileText, Loader2, Save, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createEmptySD05, type SD05Content, type SD05TemplateId } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomRecord } from "@/lib/sd-room-types";

type RoomResponse = { room: SDRoomRecord | null; documents: SDDocumentRecord[] };

const TEMPLATE_OPTIONS: Array<{ id: SD05TemplateId; name: string; description: string }> = [
  { id: "rental_exact", name: "Contrat loueur", description: "Le modèle 12 pages fidèle au SD05 de référence." },
  { id: "gando_standard", name: "Services Gando", description: "Convention de services plus générique et compacte." },
  { id: "legal_convention", name: "Convention juridique", description: "Présentation institutionnelle pour partenariats et accords spécifiques." },
];

function templateName(id: SD05TemplateId) {
  return TEMPLATE_OPTIONS.find(item => item.id === id)?.name || "Modèle Gando";
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function SDQuickContractManager({ dealId, onChanged }: { dealId: string; onChanged?: () => void }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [contractReference, setContractReference] = useState("");
  const [contractSummary, setContractSummary] = useState("");
  const [documensoConfigured, setDocumensoConfigured] = useState(false);
  const [wordConversionConfigured, setWordConversionConfigured] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [rentalDraft, setRentalDraft] = useState(createEmptySD05().rentalTemplate);
  const [goLiveDate, setGoLiveDate] = useState("");
  const [signatureDeadline, setSignatureDeadline] = useState("");
  const [templateChoice, setTemplateChoice] = useState<SD05TemplateId>("rental_exact");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [response, configResponse] = await Promise.all([
        fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" }),
        fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/documenso-sign`, { cache: "no-store" }),
      ]);
      const [payload, config] = await Promise.all([response.json(), configResponse.json()]);
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      if (configResponse.ok) {
        setDocumensoConfigured(Boolean(config.configured));
        setWordConversionConfigured(Boolean(config.wordConversionConfigured));
        setWebhookConfigured(Boolean(config.webhookConfigured));
      }
      const quickContract = (payload.documents || []).find((item: SDDocumentRecord) => item.code === "SD05");
      const quickContent = (quickContract?.content || {}) as Partial<SD05Content>;
      const clientSigner = Array.isArray(quickContent.signatories) ? quickContent.signatories.find(item => item.organization !== "GANDO SOLUTIONS") : undefined;
      setSignerName(String(clientSigner?.name || ""));
      setSignerEmail(String(clientSigner?.email || ""));
      setSignerRole(String(clientSigner?.role || ""));
      setContractTitle(String(quickContent.contractTitle || ""));
      setContractReference(String(quickContent.contractReference || ""));
      setContractSummary(String(quickContent.contractSummary || ""));
      setRentalDraft({ ...createEmptySD05().rentalTemplate, ...(quickContent.rentalTemplate || {}) });
      setGoLiveDate(String(quickContent.goLiveDate || ""));
      setSignatureDeadline(String(quickContent.signatureDeadline || ""));
      setTemplateChoice(quickContent.contractTemplate === "legal_convention" || quickContent.contractTemplate === "gando_standard" || quickContent.contractTemplate === "rental_exact" ? quickContent.contractTemplate : "rental_exact");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const document = data?.documents.find(item => item.code === "SD05");
  const value = { ...createEmptySD05(), ...((document?.content || {}) as Partial<SD05Content>) };
  const signed = value.contractStatus === "signed" || document?.status === "validated";
  const generated = Boolean(!value.contractUrl && value.contractTitle && value.contractSummary);
  const hasContract = Boolean(value.contractUrl || generated);
  const signatureInProgress = value.signatureProvider === "documenso" && value.signatureState === "sent";
  const signatureReady = signatureInProgress && /^https?:\/\//i.test(value.signatureUrl || "");
  const sourceIsWord = /\.(docx?|DOCX?)(?:[?#]|$)/.test(value.contractUrl || "");

  async function upload(file: File) {
    setWorking(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Import impossible");
      toast.success("Contrat ajouté au deal");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible");
    } finally {
      setWorking(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function generateTemplate(templateId: SD05TemplateId = templateChoice) {
    setTemplateChoice(templateId);
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate_template", templateId, rentalTemplate: rentalDraft, goLiveDate, signatureDeadline }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Génération impossible");
      toast.success(`${templateName(templateId)} ${generated ? "mis à jour" : "généré"}`);
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Génération impossible");
    } finally {
      setWorking(false);
    }
  }

  async function sendForSignature() {
    if (!hasContract) return toast.error("Ajoute ou génère d’abord le contrat.");
    if (signerName.trim().length < 2) return toast.error("Renseigne le nom du signataire.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) return toast.error("Renseigne un email de signataire valide.");
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/documenso-sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim(), signerEmail: signerEmail.trim(), signerRole: signerRole.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Envoi en signature impossible");
      toast.success("Contrat envoyé automatiquement en signature");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi en signature impossible");
    } finally {
      setWorking(false);
    }
  }

  async function saveContractContent() {
    if (!generated) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_contract_content", contractTitle, contractReference, contractSummary }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Mise à jour impossible");
      toast.success("Contenu du contrat mis à jour");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!hasContract || !window.confirm("Retirer ce contrat du deal ?")) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Suppression impossible");
      toast.success("Contrat retiré");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    } finally {
      setWorking(false);
    }
  }

  if (loading && !data) return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1000px] space-y-5">
    <Card className="p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">Deal rapide · Étape 2</div><h1 className="mt-1 text-2xl font-black tracking-[-0.03em]">Contrat</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choisis le modèle, modifie les informations ou le texte du contrat, puis envoie-le en signature. La Dealroom suit automatiquement son statut.</p></div>{signed ? <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Signé</Badge> : generated ? <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">{templateName(value.contractTemplate)}</Badge> : value.contractUrl ? <Badge variant="outline">Contrat ajouté</Badge> : <Badge variant="outline">À préparer</Badge>}</div>
    </Card>

    <input ref={inputRef} type="file" accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />

    {!value.contractUrl ? <Card className="p-5 lg:p-6">
      <div><div className="text-sm font-black">Modèle de contrat</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Clique sur un modèle pour le générer immédiatement. Les informations du loueur sont conservées lors du changement.</p></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {TEMPLATE_OPTIONS.map(option => {
          const active = generated ? value.contractTemplate === option.id : templateChoice === option.id;
          return <button key={option.id} type="button" disabled={working || signed || signatureInProgress} onClick={() => void generateTemplate(option.id)} className={active ? "rounded-xl border-2 border-primary bg-primary/5 p-4 text-left" : "rounded-xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-muted/30"}>
            <div className="flex items-center gap-2 text-sm font-black"><Sparkles className="h-4 w-4 text-primary" />{option.name}</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{option.description}</p>
          </button>;
        })}
      </div>
      {generated && value.signatureUrl ? <p className="mt-4 text-xs leading-5 text-amber-700">Changer de modèle avant l’envoi réinitialise automatiquement la future demande de signature.</p> : null}
    </Card> : null}

    {!hasContract ? <Card className="p-5 lg:p-6">
      <button type="button" onClick={() => inputRef.current?.click()} disabled={working} className="flex min-h-[190px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 px-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03] disabled:opacity-60">
        <UploadCloud className="h-8 w-8 text-primary" />
        <div className="mt-3 text-base font-bold">Ou importer ton propre contrat</div>
        <div className="mt-1 text-sm text-muted-foreground">Word (.doc/.docx) ou PDF · 20 Mo max</div>
      </button>
    </Card> : generated ? <Card className="p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><div className="truncate font-black">{value.contractTitle || "Contrat Gando"}</div><div className="mt-1 text-xs text-muted-foreground">{templateName(value.contractTemplate)} · généré par le cockpit</div></div>
        <Button variant="outline" asChild><a href={`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-pdf`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Aperçu PDF</a></Button>
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={working || signatureInProgress}>Importer à la place</Button>
        <Button variant="ghost" onClick={() => void remove()} disabled={working || signatureInProgress}><Trash2 className="mr-2 h-4 w-4" />Retirer</Button>
      </div>
    </Card> : <Card className="p-5 lg:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate font-bold">{value.contractTitle || "Contrat"}</div><div className="mt-1 text-xs text-muted-foreground">Stocké directement dans ce deal</div></div><Button variant="outline" asChild><a href={value.contractUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Ouvrir</a></Button><Button variant="outline" onClick={() => inputRef.current?.click()} disabled={working || signatureInProgress}>Remplacer</Button><Button variant="ghost" onClick={() => void remove()} disabled={working || signatureInProgress}><Trash2 className="mr-2 h-4 w-4" />Retirer</Button></div></Card>}

    {generated ? <Card className="p-5 lg:p-6">
      <div><div className="text-sm font-black">Informations du contrat</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Ces champs alimentent directement la première page et les mentions du modèle SD05.</p></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label><span className="text-xs font-bold">Raison sociale</span><Input className="mt-2" value={rentalDraft.legalName} onChange={e=>setRentalDraft(v=>({...v,legalName:e.target.value}))} disabled={signed} /></label>
        <label><span className="text-xs font-bold">Forme juridique</span><Input className="mt-2" value={rentalDraft.legalForm} onChange={e=>setRentalDraft(v=>({...v,legalForm:e.target.value}))} disabled={signed} /></label>
        <label><span className="text-xs font-bold">Capital social</span><Input className="mt-2" value={rentalDraft.shareCapital} onChange={e=>setRentalDraft(v=>({...v,shareCapital:e.target.value}))} placeholder="5 000,00 €" disabled={signed} /></label>
        <label><span className="text-xs font-bold">SIREN</span><Input className="mt-2" value={rentalDraft.siren} onChange={e=>setRentalDraft(v=>({...v,siren:e.target.value}))} disabled={signed} /></label>
        <label><span className="text-xs font-bold">N° TVA</span><Input className="mt-2" value={rentalDraft.vatNumber} onChange={e=>setRentalDraft(v=>({...v,vatNumber:e.target.value}))} disabled={signed} /></label>
        <label><span className="text-xs font-bold">Email</span><Input className="mt-2" value={rentalDraft.contactEmail} onChange={e=>setRentalDraft(v=>({...v,contactEmail:e.target.value}))} disabled={signed} /></label>
        <label className="sm:col-span-2"><span className="text-xs font-bold">Adresse du siège</span><Input className="mt-2" value={rentalDraft.registeredOffice} onChange={e=>setRentalDraft(v=>({...v,registeredOffice:e.target.value}))} disabled={signed} /></label>
        <label><span className="text-xs font-bold">Territoire / activité</span><Input className="mt-2" value={rentalDraft.activityRegion} onChange={e=>setRentalDraft(v=>({...v,activityRegion:e.target.value}))} placeholder="France métropole & DOM-TOM" disabled={signed} /></label>
        <label><span className="text-xs font-bold">Mise en production</span><Input className="mt-2" type="date" value={goLiveDate} onChange={e=>setGoLiveDate(e.target.value)} disabled={signed} /></label>
        <label><span className="text-xs font-bold">Tarif Gando (%)</span><Input className="mt-2" value={rentalDraft.gandoRate} onChange={e=>setRentalDraft(v=>({...v,gandoRate:e.target.value}))} disabled={signed} /></label>
        <label><span className="text-xs font-bold">Marge loueur (%)</span><Input className="mt-2" value={rentalDraft.partnerRate} onChange={e=>setRentalDraft(v=>({...v,partnerRate:e.target.value}))} disabled={signed} /></label>
        <label><span className="text-xs font-bold">Tarif total client (%)</span><Input className="mt-2" value={rentalDraft.totalRate} onChange={e=>setRentalDraft(v=>({...v,totalRate:e.target.value}))} disabled={signed} /></label>
        <label><span className="text-xs font-bold">Date limite de signature</span><Input className="mt-2" type="date" value={signatureDeadline} onChange={e=>setSignatureDeadline(e.target.value)} disabled={signed} /></label>
      </div>
      <div className="mt-5 flex justify-end"><Button onClick={() => void generateTemplate(value.contractTemplate)} disabled={working || signed || signatureInProgress}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Mettre à jour le contrat</Button></div>
    </Card> : null}

    {generated ? <Card className="p-5 lg:p-6">
      <details>
        <summary className="cursor-pointer text-sm font-black">Modifier le contenu du modèle</summary>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Le PDF est régénéré depuis ce contenu. Pour le modèle loueur 12 pages, conserve les séparateurs <code>[[PAGE_BREAK]]</code> si tu modifies le texte juridique.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs font-bold">Titre du contrat</span><Input className="mt-2" value={contractTitle} onChange={event => setContractTitle(event.target.value)} disabled={signed || signatureInProgress} /></label>
          <label><span className="text-xs font-bold">Référence</span><Input className="mt-2" value={contractReference} onChange={event => setContractReference(event.target.value)} disabled={signed || signatureInProgress} /></label>
          <label className="sm:col-span-2"><span className="text-xs font-bold">Texte du contrat</span><textarea className="mt-2 min-h-[420px] w-full rounded-md border border-input bg-background px-3 py-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring" value={contractSummary} onChange={event => setContractSummary(event.target.value)} disabled={signed || signatureInProgress} /></label>
        </div>
        <div className="mt-4 flex justify-end"><Button type="button" onClick={() => void saveContractContent()} disabled={working || signed || signatureInProgress}><Save className="mr-2 h-4 w-4" />Enregistrer les modifications</Button></div>
      </details>
    </Card> : null}

    {hasContract ? <>
      <Card className="p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-black"><FileSignature className="h-4 w-4 text-primary" /> Signature électronique automatisée</div><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Gando génère le PDF, l’envoie à Documenso et récupère automatiquement le statut ainsi que le PDF signé.</p></div>
          {signed ? <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600">Signé</Badge> : signatureInProgress ? <Badge variant="outline" className="border-blue-500/25 bg-blue-500/10 text-blue-600">Envoyé</Badge> : documensoConfigured ? <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600">Documenso connecté</Badge> : <Badge variant="outline">Documenso à connecter</Badge>}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label><span className="text-xs font-bold">Nom du signataire</span><Input className="mt-2" value={signerName} onChange={event => setSignerName(event.target.value)} placeholder="Prénom Nom" disabled={signed || signatureInProgress} /></label>
          <label><span className="text-xs font-bold">Email du signataire</span><Input className="mt-2" type="email" value={signerEmail} onChange={event => setSignerEmail(event.target.value)} placeholder="direction@client.fr" disabled={signed || signatureInProgress} /></label>
          <label><span className="text-xs font-bold">Fonction</span><Input className="mt-2" value={signerRole} onChange={event => setSignerRole(event.target.value)} placeholder="Gérant, Président…" disabled={signed || signatureInProgress} /></label>
        </div>
        {!documensoConfigured ? <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-800"><strong>Configuration requise :</strong> ajouter la clé <code>DOCUMENSO_API_TOKEN</code> côté serveur. Aucun lien n’est à copier manuellement.</div> : null}
        {sourceIsWord && !wordConversionConfigured ? <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-800">Ce fichier Word pourra être signé automatiquement dès que le convertisseur <code>GOTENBERG_URL</code> sera configuré. Les PDF et modèles Gando générés fonctionnent directement.</div> : null}
        {documensoConfigured && !webhookConfigured ? <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-800">L’envoi fonctionne, mais configure <code>DOCUMENSO_WEBHOOK_SECRET</code> pour que le statut « Signé » et le PDF final remontent automatiquement.</div> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {signatureReady ? <Button variant="outline" asChild><a href={value.signatureUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Ouvrir le lien de signature</a></Button> : null}
          {signed && value.signedDocumentUrl ? <Button variant="outline" asChild><a href={value.signedDocumentUrl} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />PDF signé</a></Button> : null}
          {!signed && !signatureInProgress ? <Button type="button" onClick={() => void sendForSignature()} disabled={working || !documensoConfigured || (sourceIsWord && !wordConversionConfigured)}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}Envoyer en signature</Button> : null}
        </div>
        {signatureInProgress ? <p className="mt-4 text-xs leading-5 text-muted-foreground">La demande a été envoyée. Documenso notifie le signataire et Gando mettra automatiquement cette Dealroom à jour à la fin de la signature.</p> : null}
      </Card>
    </> : null}
  </div></div>;
}