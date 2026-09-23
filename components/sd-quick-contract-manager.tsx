"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileSignature, FileText, Loader2, Save, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createEmptySD05, type SD05Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomRecord } from "@/lib/sd-room-types";

type RoomResponse = { room: SDRoomRecord | null; documents: SDDocumentRecord[] };

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
  const [signedAt, setSignedAt] = useState("");
  const [signedByEmail, setSignedByEmail] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [rentalDraft, setRentalDraft] = useState(createEmptySD05().rentalTemplate);
  const [goLiveDate, setGoLiveDate] = useState("");
  const [signatureDeadline, setSignatureDeadline] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const quickContract = (payload.documents || []).find((item: SDDocumentRecord) => item.code === "SD05");
      const quickContent = (quickContract?.content || {}) as Partial<SD05Content>;
      setSignedAt(localDateTime(payload.room?.contract_signed_at || null));
      setSignedByEmail(payload.room?.contract_signed_by_email || "");
      setSignatureUrl(String(quickContent.signatureUrl || ""));
      setRentalDraft({ ...createEmptySD05().rentalTemplate, ...(quickContent.rentalTemplate || {}) });
      setGoLiveDate(String(quickContent.goLiveDate || ""));
      setSignatureDeadline(String(quickContent.signatureDeadline || ""));
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
  const generated = value.contractTemplate === "rental_exact" && Boolean(value.contractSummary);
  const hasContract = Boolean(value.contractUrl || generated);
  const odooReady = value.signatureProvider === "odoo" && /^https?:\/\//i.test(value.signatureUrl || "");

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

  async function generateTemplate() {
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate_template", rentalTemplate: rentalDraft, goLiveDate, signatureDeadline }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Génération impossible");
      toast.success(generated ? "Contrat Gando mis à jour" : "Contrat Gando généré");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Génération impossible");
    } finally {
      setWorking(false);
    }
  }

  async function saveSignatureSettings() {
    if (!hasContract) return toast.error("Ajoute ou génère d’abord le contrat.");
    const cleanUrl = signatureUrl.trim();
    if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) return toast.error("Ajoute un lien Odoo Signature valide.");
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "configure_signature", signatureUrl: cleanUrl }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Mise à jour impossible");
      toast.success(cleanUrl ? "Odoo Signature activé" : "Lien de signature retiré");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    } finally {
      setWorking(false);
    }
  }

  async function markSigned() {
    if (!hasContract) return toast.error("Ajoute ou génère d’abord le contrat.");
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedAt: signedAt || undefined, signedByEmail: signedByEmail.trim() || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Mise à jour impossible");
      toast.success("Contrat marqué comme signé");
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">Deal rapide · Étape 2</div><h1 className="mt-1 text-2xl font-black tracking-[-0.03em]">Contrat</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Dépose le contrat, ajoute le lien Odoo Signature puis partage la Dealroom. Le client pourra consulter le document et signer depuis le même parcours.</p></div>{signed ? <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Signé</Badge> : generated ? <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">Modèle Gando</Badge> : value.contractUrl ? <Badge variant="outline">Contrat ajouté</Badge> : <Badge variant="outline">À préparer</Badge>}</div>
    </Card>

    <input ref={inputRef} type="file" accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />

    {!hasContract ? <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5 lg:p-6">
        <button type="button" onClick={() => void generateTemplate()} disabled={working} className="flex min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border-2 border-primary/30 bg-primary/[0.035] px-6 text-center transition hover:border-primary/60 hover:bg-primary/[0.06] disabled:opacity-60">
          {working ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Sparkles className="h-9 w-9 text-primary" />}
          <div className="mt-4 text-base font-black">Générer le contrat Gando</div>
          <div className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Utilise le modèle SD05 de 12 pages identique au contrat loueur Gando.</div>
        </button>
      </Card>
      <Card className="p-5 lg:p-6">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={working} className="flex min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 px-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03] disabled:opacity-60">
          <UploadCloud className="h-9 w-9 text-primary" />
          <div className="mt-4 text-base font-bold">Importer un autre contrat</div>
          <div className="mt-2 text-sm text-muted-foreground">Word (.doc/.docx) ou PDF · 20 Mo max</div>
        </button>
      </Card>
    </div> : generated ? <Card className="p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><div className="truncate font-black">{value.contractTitle || "Contrat Gando"}</div><div className="mt-1 text-xs text-muted-foreground">Modèle SD05 Loueur · 12 pages · généré par le cockpit</div></div>
        <Button variant="outline" asChild><a href={`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-pdf`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Aperçu PDF</a></Button>
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={working}>Importer à la place</Button>
        <Button variant="ghost" onClick={() => void remove()} disabled={working}><Trash2 className="mr-2 h-4 w-4" />Retirer</Button>
      </div>
    </Card> : <Card className="p-5 lg:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate font-bold">{value.contractTitle || "Contrat"}</div><div className="mt-1 text-xs text-muted-foreground">Stocké directement dans ce deal</div></div><Button variant="outline" asChild><a href={value.contractUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Ouvrir</a></Button><Button variant="outline" onClick={() => inputRef.current?.click()} disabled={working}>Remplacer</Button><Button variant="ghost" onClick={() => void remove()} disabled={working}><Trash2 className="mr-2 h-4 w-4" />Retirer</Button></div></Card>}

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
      <div className="mt-5 flex justify-end"><Button onClick={() => void generateTemplate()} disabled={working || signed}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Mettre à jour le contrat</Button></div>
    </Card> : null}

    {hasContract ? <>
      <Card className="p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-black"><FileSignature className="h-4 w-4 text-primary" /> Signature électronique</div><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Importe le même contrat dans Odoo Signature, place les champs de signature puis colle ici le lien partagé Odoo.</p></div>
          {odooReady ? <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600">Odoo prêt</Badge> : <Badge variant="outline">À configurer</Badge>}
        </div>
        <div className="mt-5">
          <label><span className="text-xs font-bold">Lien Odoo Signature</span><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input type="url" value={signatureUrl} onChange={event => setSignatureUrl(event.target.value)} placeholder="https://votre-instance.odoo.com/sign/..." disabled={signed} />{/^https?:\/\//i.test(signatureUrl.trim()) ? <Button type="button" variant="outline" asChild><a href={signatureUrl.trim()} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Tester</a></Button> : null}<Button type="button" onClick={() => void saveSignatureSettings()} disabled={working || signed}><Save className="mr-2 h-4 w-4" />Enregistrer</Button></div></label>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Parcours client :</strong> Voir le contrat → Signer le contrat → Odoo Signature → retour à la Dealroom.</div>
      </Card>

      <Card className="p-5 lg:p-6"><div className="text-sm font-black">Suivi de signature</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Pour le POC sans API Odoo, confirme ici la signature une fois qu’elle est terminée. Le deal sera alors figé comme signé.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-bold">Date de signature</span><Input className="mt-2" type="datetime-local" value={signedAt} onChange={event => setSignedAt(event.target.value)} disabled={signed} /></label><label><span className="text-xs font-bold">Email du signataire <span className="font-normal text-muted-foreground">(optionnel)</span></span><Input className="mt-2" type="email" value={signedByEmail} onChange={event => setSignedByEmail(event.target.value)} placeholder="direction@client.fr" disabled={signed} /></label></div><div className="mt-5 flex justify-end"><Button onClick={() => void markSigned()} disabled={working || signed}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{signed ? "Contrat signé" : "Marquer comme signé"}</Button></div></Card>
    </> : null}
  </div></div>;
}