"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Download, FileSignature, Loader2, Mail, Save, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SD05ContractRenderer, type SD05SignatureSummary } from "@/components/sd05-contract-renderer";
import { createGandoPartnershipTemplate, createGandoSD05Template } from "@/lib/sd05-contract";
import { createEmptySD05, type SD05Content, type SD05TemplateId } from "@/lib/sd-stage-content";
import type { SDDocumentRecord } from "@/lib/sd-room-types";

type RoomResponse = { documents: SDDocumentRecord[]; room: { id: string; title: string; company_name?: string } | null };
type SignaturesResponse = { requests: SD05SignatureSummary[] };

function Area({ value, onChange, rows = 5, placeholder, disabled = false }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string; disabled?: boolean }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} disabled={disabled} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60" />;
}

function ContractTextEditor({ value, onChange, disabled, onAddAnnex }: { value: string; onChange: (value: string) => void; disabled: boolean; onAddAnnex: () => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const applyFormat = (prefix: "" | "## " | "### " | "#### ") => {
    const textarea = ref.current;
    if (!textarea) return;
    const cursorStart = textarea.selectionStart ?? value.length;
    const cursorEnd = textarea.selectionEnd ?? cursorStart;
    const lineStart = value.lastIndexOf("\n", Math.max(0, cursorStart - 1)) + 1;
    const nextBreak = value.indexOf("\n", cursorEnd);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const currentLine = value.slice(lineStart, lineEnd);
    const cleaned = currentLine.replace(/^\s*(?:H[234]:\s*|#{2,4}\s+)/i, "").trimStart();
    const replacement = `${prefix}${cleaned}`;
    onChange(`${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`);
    requestAnimationFrame(() => {
      const nextCursor = lineStart + replacement.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return <div className="overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
    {!disabled ? <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/25 p-2">
      <span className="px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Style de la ligne</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => applyFormat("")}>Texte</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyFormat("## ")}>Titre H2</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyFormat("### ")}>Sous-titre H3</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyFormat("#### ")}>Sous-section H4</Button>
      <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onAddAnnex}>+ Annexe</Button>
    </div> : null}
    <textarea
      ref={ref}
      value={value}
      onChange={event => onChange(event.target.value)}
      rows={34}
      disabled={disabled}
      placeholder={"## ARTICLE 1 — OBJET\nLe présent article définit…\n\n### 1.1 Périmètre\nLe périmètre comprend…\n\n#### Modalités pratiques\nLes modalités sont…"}
      className="w-full resize-y border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 outline-none disabled:cursor-not-allowed disabled:opacity-60"
    />
    <div className="border-t border-border bg-muted/15 px-4 py-2 text-[11px] leading-5 text-muted-foreground">Place le curseur sur une ligne puis choisis son niveau. Les symboles de structure ne sont jamais affichés dans le contrat final. H2 = titre, H3 = sous-titre, H4 = sous-section.</div>
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-2"><div><Label>{label}</Label>{hint ? <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{hint}</p> : null}</div>{children}</div>;
}

function ToggleField({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description: string; disabled: boolean }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-4"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} className="mt-1 h-4 w-4 accent-primary" /><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span></label>;
}

function statusLabel(status: string) {
  return status === "signed" ? "Signé" : status === "viewed" ? "Consulté" : status === "sent" ? "Envoyé" : status === "expired" ? "Expiré" : status === "revoked" ? "Révoqué" : status === "failed" ? "Échec" : "À signer";
}

function statusClass(status: string) {
  if (status === "signed") return "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700";
  if (status === "viewed") return "border-blue-500/30 bg-blue-500/[0.06] text-blue-700";
  if (["failed", "expired", "revoked"].includes(status)) return "border-red-500/20 bg-red-500/[0.05] text-red-700";
  return "border-amber-500/25 bg-amber-500/[0.05] text-amber-700";
}

export function SD05ContractBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [value, setValue] = useState<SD05Content>(createEmptySD05());
  const [signatures, setSignatures] = useState<SD05SignatureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomResponse, signatureResponse] = await Promise.all([
        fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" }),
        fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-signatures`, { cache: "no-store" }),
      ]);
      const roomPayload = await roomResponse.json().catch(() => ({}));
      if (!roomResponse.ok) throw new Error(roomPayload.message || roomPayload.error || "Chargement impossible");
      setData(roomPayload as RoomResponse);
      const document = (roomPayload.documents || []).find((item: SDDocumentRecord) => item.code === "SD05");
      setValue({ ...createEmptySD05(), ...((document?.content || {}) as Partial<SD05Content>) });
      const signaturePayload = await signatureResponse.json().catch(() => ({}));
      setSignatures(signatureResponse.ok ? (signaturePayload as SignaturesResponse).requests || [] : []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof SD05Content>(key: K, next: SD05Content[K]) => setValue(current => ({ ...current, [key]: next }));
  const requiredReady = ["SD01", "SD02"].every(code => data?.documents.find(item => item.code === code)?.status === "validated");
  const sd05 = data?.documents.find(item => item.code === "SD05");
  const locked = value.contractStatus === "signed" || sd05?.status === "validated";
  const companyName = data?.room?.company_name || data?.room?.title?.replace(/\s*[×x]\s*Gando.*$/i, "") || "Client";
  const latestContractHash = useMemo(() => signatures.find(item => ["signed", "viewed", "sent"].includes(item.status))?.contractHash || signatures[0]?.contractHash || null, [signatures]);

  async function persist(publish: boolean, successToast = true) {
    const content: SD05Content = {
      ...value,
      contractTitle: value.contractTitle.trim(), contractReference: value.contractReference.trim(), contractVersion: value.contractVersion.trim(), contractSummary: value.contractSummary.trim(),
      footerConfidentialityText: value.footerConfidentialityText.trim(), emailIntroText: value.emailIntroText.trim(), term: value.term.trim(), renewal: value.renewal.trim(), terminationNotice: value.terminationNotice.trim(),
      signatories: value.signatories.map(item => ({ ...item, name: item.name.trim(), email: item.email.trim().toLowerCase(), role: item.role.trim(), organization: item.organization.trim() })).filter(item => item.name || item.email),
      legalItems: value.legalItems.map(item => ({ ...item, topic: item.topic.trim(), owner: item.owner.trim(), notes: item.notes.trim() })).filter(item => item.topic),
    };
    if (!content.contractTitle) throw new Error("Ajoutez un titre de contrat.");
    if (!content.contractSummary) throw new Error("Ajoutez le texte contractuel.");
    if (!content.allowTypedSignature && !content.allowDrawnSignature) throw new Error("Activez au moins un mode de signature.");
    const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "SD05", content, publish }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
    setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD05" ? payload.document : document) } : current);
    setValue({ ...createEmptySD05(), ...((payload.document?.content || {}) as Partial<SD05Content>) });
    if (successToast) toast.success(publish ? "Contrat publié" : "Contrat enregistré");
  }

  async function save(publish: boolean) {
    if (working || locked) return;
    setWorking(true);
    try { await persist(publish); } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); } finally { setWorking(false); }
  }

  async function sendForSignature(signerEmail?: string) {
    if (working || locked) return;
    if (!requiredReady) return toast.error("SD01 et SD02 doivent être validés avant l'envoi du contrat en signature.");
    if (!value.signatories.some(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email.trim()))) return toast.error("Ajoutez au moins un signataire avec une adresse email valide.");
    setWorking(true);
    try {
      await persist(true, false);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-signatures`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(signerEmail ? { signerEmail } : {}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || "Envoi impossible");
      setSignatures(payload.requests || []);
      if (payload.failed?.length) toast.error(`${payload.failed.length} invitation(s) n'ont pas pu être envoyées.`);
      if (payload.sent?.length) toast.success(`${payload.sent.length} invitation(s) envoyée(s) depuis la Room.`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Envoi impossible"); } finally { setWorking(false); }
  }

  function applyTemplate(templateId: SD05TemplateId) {
    if (locked) return;
    const template = templateId === "legal_convention" ? createGandoPartnershipTemplate(companyName) : createGandoSD05Template(companyName);
    setValue(current => ({ ...template, contractReference: current.contractReference || template.contractReference, signatureDeadline: current.signatureDeadline, goLiveDate: current.goLiveDate, effectiveDate: current.effectiveDate }));
    toast.success(templateId === "legal_convention" ? "Modèle Convention juridique chargé." : "Modèle Services Gando chargé.");
  }

  const addSigner = () => setValue(current => ({ ...current, signatories: [...current.signatories, { name: "", role: "", organization: companyName, email: "", signatureStatus: "pending" }] }));
  const updateSigner = (index: number, key: "name" | "role" | "organization" | "email", next: string) => setValue(current => ({ ...current, signatories: current.signatories.map((item, i) => i === index ? { ...item, [key]: next } : item) }));
  const removeSigner = (index: number) => setValue(current => ({ ...current, signatories: current.signatories.filter((_, i) => i !== index) }));
  const addTerm = () => setValue(current => ({ ...current, legalItems: [...current.legalItems, { topic: "", status: "open", owner: "", notes: "" }] }));
  const updateTerm = (index: number, key: "topic" | "owner" | "notes", next: string) => setValue(current => ({ ...current, legalItems: current.legalItems.map((item, i) => i === index ? { ...item, [key]: next } : item) }));
  const removeTerm = (index: number) => setValue(current => ({ ...current, legalItems: current.legalItems.filter((_, i) => i !== index) }));
  const addAnnex = () => setValue(current => { const matches = current.contractSummary.match(/^ANNEXE\s+\d+/gim) || []; const number = matches.length + 1; return { ...current, contractSummary: `${current.contractSummary.trimEnd()}\n\nANNEXE ${number} : TITRE DE L'ANNEXE\nTexte de l'annexe à compléter.`.trim() }; });

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1180px] space-y-5">
    <Card className="overflow-hidden p-0"><div className="flex flex-col gap-4 border-b border-border bg-primary/[0.04] p-5 lg:flex-row lg:items-center"><div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><FileSignature className="h-5 w-5" /></div><div><div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">SD05 · Contrat & signature électronique</div><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Contrats juridiques Gando</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Mise en page juridique, paraphes, signature manuscrite ou écrite et preuve horodatée.</p></div></div><div className="flex flex-wrap items-center gap-2 lg:ml-auto">{locked ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Signé · version figée</Badge> : null}{locked ? <Button variant="outline" asChild><a href={`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-pdf`}><Download className="mr-2 h-4 w-4" /> Télécharger le PDF</a></Button> : null}<Button variant="outline" onClick={() => void save(false)} disabled={working || locked}><Save className="mr-2 h-4 w-4" /> Enregistrer</Button><Button onClick={() => void sendForSignature()} disabled={working || locked || !requiredReady}><Send className="mr-2 h-4 w-4" /> Envoyer pour signature</Button></div></div>{!requiredReady ? <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-700">SD01 et SD02 doivent être validés avant l'envoi du contrat en signature.</div> : null}</Card>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]"><div className="space-y-5">
      <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Modèle de contrat</h2><p className="mt-1 text-xs text-muted-foreground">Le premier modèle conserve sa première page Gando. Le second reprend une présentation de convention juridique.</p></div><div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled={locked} onClick={() => applyTemplate("gando_standard")} className={value.contractTemplate === "gando_standard" ? "rounded-xl border-2 border-primary bg-primary/5 p-4 text-left" : "rounded-xl border border-border p-4 text-left hover:bg-muted/30"}><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Services Gando</div><p className="mt-1 text-xs text-muted-foreground">Structure Gando d'origine, bandeau violet.</p></button><button type="button" disabled={locked} onClick={() => applyTemplate("legal_convention")} className={value.contractTemplate === "legal_convention" ? "rounded-xl border-2 border-primary bg-primary/5 p-4 text-left" : "rounded-xl border border-border p-4 text-left hover:bg-muted/30"}><div className="flex items-center gap-2 text-sm font-semibold"><FileSignature className="h-4 w-4 text-primary" /> Convention juridique</div><p className="mt-1 text-xs text-muted-foreground">Bandeau sombre et structure institutionnelle.</p></button></div></Card>

      <Card className="space-y-5 p-5"><div className="grid gap-4 md:grid-cols-2"><Field label="Titre du contrat"><Input disabled={locked} value={value.contractTitle} onChange={event => set("contractTitle", event.target.value)} /></Field><Field label="Référence SD05"><Input disabled={locked} value={value.contractReference} onChange={event => set("contractReference", event.target.value)} /></Field><Field label="Version"><Input disabled={locked} value={value.contractVersion} onChange={event => set("contractVersion", event.target.value)} /></Field><Field label="Date limite de signature"><Input disabled={locked} type="date" value={value.signatureDeadline} onChange={event => set("signatureDeadline", event.target.value)} /></Field><Field label="Mise en production"><Input disabled={locked} type="date" value={value.goLiveDate} onChange={event => set("goLiveDate", event.target.value)} /></Field><Field label="Durée initiale"><Input disabled={locked} value={value.term} onChange={event => set("term", event.target.value)} /></Field></div><Field label="Renouvellement"><Input disabled={locked} value={value.renewal} onChange={event => set("renewal", event.target.value)} /></Field><Field label="Préavis / résiliation"><Input disabled={locked} value={value.terminationNotice} onChange={event => set("terminationNotice", event.target.value)} /></Field></Card>

      <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Signature & paraphes</h2><p className="mt-1 text-xs text-muted-foreground">Options figées lors de l'envoi.</p></div><div className="grid gap-3 md:grid-cols-3"><ToggleField disabled={locked} checked={value.allowTypedSignature} onChange={next => set("allowTypedSignature", next)} label="Signature écrite" description="Nom et prénom avec rendu signature." /><ToggleField disabled={locked} checked={value.allowDrawnSignature} onChange={next => set("allowDrawnSignature", next)} label="Signature manuscrite" description="Dessin à la souris ou au doigt." /><ToggleField disabled={locked} checked={value.requireInitialsEachPage} onChange={next => set("requireInitialsEachPage", next)} label="Paraphe obligatoire" description="Chaque page doit être paraphée." /></div></Card>

      <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Email de signature</h2><p className="mt-1 text-xs text-muted-foreground">Le lien envoyé ouvre désormais le contrat directement dans la Room via /contract.</p></div><Field label="Texte d'introduction"><Area disabled={locked} value={value.emailIntroText} onChange={next => set("emailIntroText", next)} rows={3} /></Field></Card>

      <Card className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Conditions particulières</h2><p className="mt-1 text-xs text-muted-foreground">Affichées sur la première page.</p></div>{!locked ? <Button type="button" variant="outline" size="sm" onClick={addTerm}>Ajouter</Button> : null}</div>{value.legalItems.length ? <div className="space-y-3">{value.legalItems.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-[220px_1fr_auto]"><Input disabled={locked} value={item.topic} onChange={event => updateTerm(index, "topic", event.target.value)} placeholder="Intitulé" /><Input disabled={locked} value={item.notes} onChange={event => updateTerm(index, "notes", event.target.value)} placeholder="Condition" />{!locked ? <Button type="button" variant="ghost" size="icon" onClick={() => removeTerm(index)}><Trash2 className="h-4 w-4" /></Button> : null}</div>)}</div> : <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Aucune condition particulière.</div>}</Card>
      <Card className="space-y-4 p-5">
        <div><h2 className="font-semibold">Texte du contrat</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Éditeur structuré : applique directement un niveau à la ligne courante. Un titre ou un sous-titre reste distinct du paragraphe qui suit, même sans ligne vide. « ARTICLE », « 3.1. » et « ANNEXE » restent également reconnus.</p></div>
        <ContractTextEditor disabled={locked} value={value.contractSummary} onChange={next => set("contractSummary", next)} onAddAnnex={addAnnex} />
      </Card>

      <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Pied de page & confidentialité</h2><p className="mt-1 text-xs text-muted-foreground">Texte modifiable pour chaque contrat.</p></div><Area disabled={locked} value={value.footerConfidentialityText} onChange={next => set("footerConfidentialityText", next)} rows={4} /></Card>

      <Card className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Signataires</h2><p className="mt-1 text-xs text-muted-foreground">Une invitation personnelle est créée pour chaque email.</p></div>{!locked ? <Button type="button" variant="outline" size="sm" onClick={addSigner}>Ajouter</Button> : null}</div>{value.signatories.map((signer, index) => { const evidence = signatures.find(item => item.signerEmail.toLowerCase() === signer.email.toLowerCase() && !["revoked", "failed"].includes(item.status)); return <div key={index} className="rounded-xl border border-border bg-muted/20 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1fr_auto]"><Input disabled={locked} value={signer.name} onChange={event => updateSigner(index, "name", event.target.value)} placeholder="Nom" /><Input disabled={locked} type="email" value={signer.email} onChange={event => updateSigner(index, "email", event.target.value)} placeholder="Email" /><Input disabled={locked} value={signer.role} onChange={event => updateSigner(index, "role", event.target.value)} placeholder="Fonction" /><Input disabled={locked} value={signer.organization} onChange={event => updateSigner(index, "organization", event.target.value)} placeholder="Organisation" />{!locked ? <Button type="button" variant="ghost" size="icon" onClick={() => removeSigner(index)}><Trash2 className="h-4 w-4" /></Button> : null}</div><div className="mt-3 flex flex-wrap items-center gap-2">{evidence ? <Badge variant="outline" className={statusClass(evidence.status)}>{statusLabel(evidence.status)}</Badge> : <Badge variant="outline">À préparer</Badge>}{evidence?.sentAt ? <span className="text-[11px] text-muted-foreground">Envoyé {new Date(evidence.sentAt).toLocaleString("fr-FR")}</span> : null}{evidence?.firstViewedAt ? <span className="text-[11px] text-muted-foreground">· consulté {new Date(evidence.firstViewedAt).toLocaleString("fr-FR")}</span> : null}{evidence?.signedAt ? <span className="text-[11px] font-semibold text-emerald-700">· signé {new Date(evidence.signedAt).toLocaleString("fr-FR")}</span> : null}{!locked && signer.email && evidence?.status !== "signed" ? <Button type="button" variant="ghost" size="sm" onClick={() => void sendForSignature(signer.email)} disabled={working || !requiredReady}><Mail className="mr-1.5 h-3.5 w-3.5" /> Envoyer / renvoyer</Button> : null}{evidence?.status === "signed" ? <a href={`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-signatures/${encodeURIComponent(evidence.id)}/proof`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-primary hover:bg-primary/10"><Download className="h-3.5 w-3.5" /> Preuve</a> : null}</div></div>; })}</Card>
    </div>

    <div className="space-y-5"><Card className="p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-semibold">Preuve de signature</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Document figé, SHA-256, paraphes, signature, IP, horodatages et audit.</p></div></div>{latestContractHash ? <div className="mt-4 rounded-xl bg-muted/50 p-3"><div className="text-[10px] font-bold uppercase text-muted-foreground">Empreinte active</div><div className="mt-2 break-all font-mono text-[10px]">{latestContractHash}</div></div> : null}</Card><Card className="p-5"><div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Workflow</div><ol className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground"><li>1. Choisir et adapter le modèle.</li><li>2. Structurer avec H2 / H3 / H4 et annexes si nécessaire.</li><li>3. Envoyer depuis la Room.</li><li>4. Le client paraphe et signe.</li><li>5. Une fois signé, télécharger le PDF ou la preuve.</li></ol></Card></div></div>

    <Card className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Aperçu client</div><h2 className="mt-1 font-semibold">Rendu paginé</h2></div><Badge variant="outline">Frontend natif</Badge></div><div className="bg-slate-100 p-4 sm:p-6"><SD05ContractRenderer content={value} companyName={companyName} contractHash={latestContractHash} signatures={signatures} /></div></Card>
  </div></div>;
}
