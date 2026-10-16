"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Link2, Loader2, Save, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SDQuickProposalBranding } from "@/components/sd-quick-proposal-branding";
import { createEmptySD04, type SD04Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomRecord } from "@/lib/sd-room-types";
import { computeQuickDealEconomics, isQuickPricingRow, quickPricingRows } from "@/lib/quick-deal-economics";

const ROOM_BASE_URL = (process.env.NEXT_PUBLIC_ROOM_BASE_URL || "https://room.gando.pro").replace(/\/$/, "");

type RoomResponse = {
  deal?: { name?: string | null };
  room: SDRoomRecord | null;
  documents: SDDocumentRecord[];
};
type ApprovalState = {
  approval: { required: boolean; approvedAt: string | null; approvedByEmail: string | null; approvedHash: string | null };
  approvedForCurrent: boolean;
  canApprove: boolean;
  documentStatus: string;
};

function cleanLines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

function draftLines(value: string) {
  return value.split("\n");
}

function pricingText(rows: SD04Content["pricing"]) {
  return rows.map(row => [row.item, row.price, row.notes].filter(Boolean).join(" | ")).join("\n");
}

function parsePricing(value: string): SD04Content["pricing"] {
  return cleanLines(value).map(row => {
    const [item = "", price = "", notes = ""] = row.split("|").map(part => part.trim());
    return { item, price, notes, model: "" };
  }).filter(row => row.item);
}

function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value || 0);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-bold">{label}</span>{hint ? <span className="ml-2 text-[11px] text-muted-foreground">{hint}</span> : null}<div className="mt-2">{children}</div></label>;
}

function Area({ value, onChange, rows = 5, placeholder }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />;
}

export function SDQuickProposalBuilder({ dealId, onChanged }: { dealId: string; onChanged?: () => void }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [value, setValue] = useState<SD04Content>(createEmptySD04());
  const [pricingDraft, setPricingDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [approvalWorking, setApprovalWorking] = useState(false);
  const [pricingConfirmed, setPricingConfirmed] = useState(false);
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [uploading, setUploading] = useState(false);
  const proposalFileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [response, approvalResponse] = await Promise.all([
        fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" }),
        fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-approval`, { cache: "no-store" }),
      ]);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      if (approvalResponse.ok) setApproval(await approvalResponse.json());
      setData(payload);
      const document = (payload.documents || []).find((item: SDDocumentRecord) => item.code === "SD04");
      const nextValue = { ...createEmptySD04(), ...((document?.content || {}) as Partial<SD04Content>) };
      const economics = nextValue.gandoEconomics;
      if (economics) nextValue.partnerRevenueExample = {
        ...nextValue.partnerRevenueExample,
        averageDeposit: economics.averageDeposit,
        monthlyActivations: economics.monthlyActivations,
        partnerMarginRate: economics.partnerMarginPercent,
      };
      setValue(nextValue);
      setPricingDraft(pricingText(nextValue.pricing.filter(row => !isQuickPricingRow(row.item))));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const document = data?.documents.find(item => item.code === "SD04");
  const clientUrl = data?.room ? `${ROOM_BASE_URL}/r/${data.room.share_token}` : "";
  const dealName = data?.deal?.name || data?.room?.title || "Deal rapide";
  const companyName = data?.room?.company_name || "Client";
  const agreed = document?.status === "validated";
  const published = document?.status === "published" || agreed;

  const ready = useMemo(() => Boolean(value.deckTitle.trim() && value.executiveMessage.trim() && (value.solution.length || value.pricing.length || value.commercialTerms.length || value.proposalFileUrl)), [value]);
  const revenueExample = value.partnerRevenueExample || createEmptySD04().partnerRevenueExample;
  const revenuePerDeposit = revenueExample.averageDeposit * (revenueExample.partnerMarginRate / 100);
  const monthlyRevenue = revenuePerDeposit * revenueExample.monthlyActivations;
  const annualRevenue = monthlyRevenue * 12;
  const gandoEconomics = value.gandoEconomics || createEmptySD04().gandoEconomics;
  const gando = computeQuickDealEconomics(gandoEconomics);
  const canPublish = !approval?.approval.required || approval.approvedForCurrent;
  const gandoFields = [
    { key: "averageDeposit", label: "Caution moyenne (€)", step: "50" },
    { key: "monthlyActivations", label: "Activations / mois", step: "1" },
    { key: "gandoRatePercent", label: "Frais Gando (%)", step: "0.1" },
    { key: "partnerMarginPercent", label: "Marge du loueur (%)", step: "0.1" },
    { key: "monthlySubscription", label: "Abonnement mensuel (€)", step: "1" },
    { key: "collectionRatePercent", label: "Frais encaissement (%)", step: "0.1" },
    { key: "collectionFixedFee", label: "Frais fixes encaissement (€)", step: "0.1" },
    { key: "expectedCollectionSharePercent", label: "Demandes encaissées (%)", step: "0.1" },
    { key: "averageCollectionAmountPercent", label: "Part de caution encaissée (%)", step: "0.1" },
    { key: "insuranceCostPercent", label: "Assurance / caution (%)", step: "0.01" },
    { key: "paymentCostPercent", label: "PSP / frais totaux facturés (%)", step: "0.1" },
    { key: "paymentFixedCost", label: "PSP fixe / activation (€)", step: "0.01" },
  ] as const;

  const setEconomics = (field: keyof typeof gandoEconomics, number: number) => {
    const next = { ...gandoEconomics, [field]: Math.max(0, Number.isFinite(number) ? number : 0) };
    setValue(current => ({
      ...current,
      gandoEconomics: next,
      partnerRevenueExample: {
        ...(current.partnerRevenueExample || createEmptySD04().partnerRevenueExample),
        averageDeposit: next.averageDeposit,
        monthlyActivations: next.monthlyActivations,
        partnerMarginRate: next.partnerMarginPercent,
      },
    }));
    setPricingConfirmed(false);
    setApproval(current => current?.approval.required ? { ...current, approvedForCurrent: false } : current);
  };

  async function changeApproval(action: "approve" | "revoke" | "set_required", required?: boolean) {
    if (approvalWorking) return;
    setApprovalWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-approval`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, required }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Validation interne impossible");
      setApproval(current => current ? { ...current, ...payload } : null);
      toast.success(action === "approve" ? "Proposition approuvée par Gando" : action === "revoke" ? "Approbation retirée" : "Règle de validation enregistrée");
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validation interne impossible");
    } finally { setApprovalWorking(false); }
  }

  const set = <K extends keyof SD04Content>(key: K, next: SD04Content[K]) => {
    setValue(current => ({ ...current, [key]: next }));
    setPricingConfirmed(false);
    setApproval(current => current?.approval.required ? { ...current, approvedForCurrent: false } : current);
  };

  async function importProposal(file: File) {
    if (uploading || agreed) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-proposal-file`, {
        method: "POST", body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Import impossible");
      setPricingConfirmed(false);
      toast.success("Proposition importée. Valide ses tarifs puis publie la version finale.");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible");
    } finally {
      if (proposalFileRef.current) proposalFileRef.current.value = "";
      setUploading(false);
    }
  }

  function generateTemplate() {
    const templatePricing = quickPricingRows(gandoEconomics);
    setValue(current => ({
      ...current,
      deckTitle: current.deckTitle || `Proposition Gando × ${companyName}`,
      executiveMessage: current.executiveMessage || `Dans le cadre du deal « ${dealName} », voici le cadre commercial proposé à ${companyName}. Les éléments entre crochets sont à adapter avant de partager le lien au client.`,
      solution: current.solution.length ? current.solution : [
        "Caution sans blocage de fonds pour le locataire",
        "Garantie d’encaissement selon les conditions contractuelles",
        "Parcours digital de création, d’envoi et de suivi des cautions",
      ],
      pricing: current.pricing.length ? current.pricing : templatePricing,
      commercialTerms: current.commercialTerms.length ? current.commercialTerms : [
        "Durée de sécurisation : [XX jours]",
        "Plafond de caution : [X XXX €]",
        "Frais d’encaissement : selon le barème ci-dessus",
        "Périmètre / date de déploiement : [à confirmer]",
      ],
      proofPoints: current.proofPoints.length ? current.proofPoints : [
        "Pas de fonds immobilisés pour le locataire",
        "Gain de temps opérationnel pour les équipes",
        "Revenu additionnel possible sur chaque caution",
      ],
      partnerRevenueExample: {
        enabled: current.partnerRevenueExample?.enabled !== false,
        averageDeposit: current.partnerRevenueExample?.averageDeposit || 1000,
        monthlyActivations: current.partnerRevenueExample?.monthlyActivations || 30,
        partnerMarginRate: current.partnerRevenueExample?.partnerMarginRate || 0.7,
      },
      callToAction: current.callToAction || "Êtes-vous en accord avec cette proposition pour passer au contrat ?",
    }));
    setPricingConfirmed(false);
    toast.success("Modèle généré — vérifie les tarifs et conditions avant publication");
  }

  async function persist(publish: boolean) {
    if (working) return;
    if (publish && !ready) return toast.error("Ajoute au minimum un titre, un message et les éléments de l’offre.");
    if (publish && !pricingConfirmed) return toast.error("Confirme les prix Gando avant de publier cette proposition.");
    if (publish && !canPublish) return toast.error("Un administrateur doit approuver les tarifs enregistrés avant publication.");
    setWorking(true);
    try {
      const content: SD04Content = {
        ...value,
        deckTitle: value.deckTitle.trim(),
        executiveMessage: value.executiveMessage.trim(),
        offerSummary: value.executiveMessage.trim(),
        solution: cleanLines(value.solution.join("\n")),
        pricing: [
          ...quickPricingRows(gandoEconomics),
          ...parsePricing(pricingDraft).filter(row => !isQuickPricingRow(row.item)),
        ],
        gandoEconomics,
        partnerRevenueExample: {
          ...revenueExample,
          averageDeposit: gandoEconomics.averageDeposit,
          monthlyActivations: gandoEconomics.monthlyActivations,
          partnerMarginRate: gandoEconomics.partnerMarginPercent,
        },
        commercialTerms: cleanLines(value.commercialTerms.join("\n")),
        proofPoints: cleanLines(value.proofPoints.join("\n")),
        callToAction: value.callToAction.trim() || "Êtes-vous en accord avec cette proposition ?",
      };
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "SD04", content, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(item => item.code === "SD04" ? payload.document : item) } : current);
      const nextValue = { ...createEmptySD04(), ...((payload.document?.content || {}) as Partial<SD04Content>) };
      setValue(nextValue);
      setPricingDraft(pricingText(nextValue.pricing.filter(row => !isQuickPricingRow(row.item))));
      await load();
      toast.success(publish ? "Lien de propal prêt à être partagé" : "Propal enregistrée");
      onChanged?.();

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setWorking(false);
    }
  }

  if (loading && !data) return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1080px] space-y-5">
    <Card className="p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">Deal rapide · Étape 1</div>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.03em]">{dealName}</h1>
          <p className="mt-1 text-sm font-semibold text-foreground/75">Propal en ligne · {companyName}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Tu construis la proposition puis tu génères un lien à copier. Gando n’envoie rien automatiquement.</p>
        </div>
        <div className="flex flex-wrap gap-2">{agreed ? <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600" variant="outline"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accord obtenu</Badge> : published ? <Badge variant="outline"><Link2 className="mr-1 h-3.5 w-3.5" /> Lien prêt · en attente</Badge> : <Badge variant="outline">Brouillon</Badge>}</div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={generateTemplate} disabled={working || agreed}><Sparkles className="mr-2 h-4 w-4" />Générer le modèle</Button>
        <input ref={proposalFileRef} className="hidden" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { const file = event.target.files?.[0]; if (file) void importProposal(file); }} />
        <Button variant="outline" disabled={working || uploading || agreed} onClick={() => proposalFileRef.current?.click()}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}{value.proposalFileUrl ? "Remplacer le document" : "Importer PDF / Word"}</Button>
        <Button variant="outline" onClick={() => void persist(false)} disabled={working}><Save className="mr-2 h-4 w-4" />Enregistrer</Button>
        <Button onClick={() => void persist(true)} disabled={working || !ready || agreed || !canPublish}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}{published ? "Mettre à jour le lien" : "Générer le lien"}</Button>
      </div>

      {value.proposalFileUrl ? <a className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary underline" href={value.proposalFileUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Fichier joint : {value.proposalFileName || "Proposition importée"}</a> : null}
      <label className="mt-4 flex items-start gap-2 text-xs font-semibold text-muted-foreground">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={pricingConfirmed} onChange={event => setPricingConfirmed(event.target.checked)} />
        Je confirme les tarifs de cette version avant publication. Les valeurs préremplies sont une simulation, pas un tarif accordé avec le client.
      </label>
      {clientUrl && published ? <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.1em] text-primary">Lien de la propal à partager</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={clientUrl} readOnly className="font-mono text-xs" />
          <Button onClick={async () => { await navigator.clipboard.writeText(clientUrl); toast.success("Lien de la propal copié"); }}><Copy className="mr-2 h-4 w-4" />Copier le lien</Button>
          <Button variant="outline" asChild><a href={clientUrl} target="_blank" rel="noreferrer">Aperçu <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Après l’avoir réellement partagé, renseigne la date et l’heure dans « Propal envoyée » au-dessus.</p>
      </div> : null}
    </Card>

    <Card className="p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground">Contrôle interne · Administration</div>
          <h2 className="mt-1 text-lg font-black">Validation de la proposition Gando</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">L’administrateur approuve la version enregistrée. Tout changement de prix ou de contenu annule son accord.</p>
        </div>
        <Badge variant="outline" className={approval?.approvedForCurrent ? "border-emerald-500/30 text-emerald-600" : ""}>
          {approval?.approvedForCurrent ? "Approuvée en interne" : approval?.approval.required ? "Approbation requise" : "Validation optionnelle"}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {approval?.canApprove ? <>
          <Button variant="outline" disabled={approvalWorking || agreed} onClick={() => void changeApproval("set_required", !approval?.approval.required)}>{approval?.approval.required ? "Rendre facultative" : "Exiger l’approbation admin"}</Button>
          <Button variant="outline" disabled={approvalWorking || agreed} onClick={() => void changeApproval("approve")}>{approvalWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Approuver la version enregistrée</Button>
          {approval?.approvedForCurrent ? <Button variant="ghost" disabled={approvalWorking || agreed} onClick={() => void changeApproval("revoke")}>Retirer l’approbation</Button> : null}
        </> : <span className="text-xs text-muted-foreground">Approbation réservée à un administrateur du cockpit.</span>}
      </div>
      {approval?.approval.approvedAt && approval.approvedForCurrent ? <p className="mt-3 text-xs text-muted-foreground">Validée par {approval.approval.approvedByEmail} le {new Date(approval.approval.approvedAt).toLocaleString("fr-FR")}.</p> : null}
      {approval?.approval.required && !approval.approvedForCurrent ? <p className="mt-3 text-xs text-amber-700">Enregistre la proposition, puis demande son approbation avant de publier le lien.</p> : null}
    </Card>

    <Card className="p-5 lg:p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.13em] text-primary">Pilotage financier · Interne uniquement</div>
      <h2 className="mt-1 text-lg font-black">Combien rapporte ce deal à Gando ?</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Hypothèses modifiables HT, confidentielles et non visibles par le client.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {gandoFields.map(field => <label key={field.key} className="block"><span className="text-xs font-bold">{field.label}</span>
          <Input className="mt-2" type="number" min="0" step={field.step} value={gandoEconomics[field.key]} onChange={event => setEconomics(field.key, Number(event.target.value))} disabled={agreed} />
        </label>)}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-muted/15 p-4"><div className="text-[10px] font-bold uppercase text-muted-foreground">Cautions sécurisées / mois</div><div className="mt-2 text-xl font-black">{euro(gando.securedMonthly)}</div><p className="mt-1 text-[11px] text-muted-foreground">Ce volume n’est pas du CA</p></div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="text-[10px] font-bold uppercase text-primary">CA Gando / mois · HT</div><div className="mt-2 text-xl font-black">{euro(gando.monthlyGandoRevenue)}</div></div>
        <div className="rounded-xl border border-border bg-muted/15 p-4"><div className="text-[10px] font-bold uppercase text-muted-foreground">CA Gando / an · HT</div><div className="mt-2 text-xl font-black">{euro(gando.annualGandoRevenue)}</div></div>
        <div className="rounded-xl border border-border bg-muted/15 p-4"><div className="text-[10px] font-bold uppercase text-muted-foreground">Contribution mensuelle estimée</div><div className="mt-2 text-xl font-black">{euro(gando.monthlyContribution)}</div><p className="mt-1 text-[11px] text-muted-foreground">Après assurance/PSP estimés, hors risque et recouvrement</p></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Détail mensuel : {euro(gando.monthlyGandoRevenue)} de revenus Gando − {euro(gando.monthlyInsuranceCost)} d’assurance − {euro(gando.monthlyPaymentCost)} de PSP. Marge estimée du loueur : {euro(gando.monthlyPartnerRevenue)} HT/mois (exclue du CA Gando). Hypothèses pour {companyName} à confirmer.</p>
    </Card>

    <section className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-background shadow-sm">
      <div className="border-b border-primary/15 bg-primary/[0.06] px-5 py-4 sm:px-6">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">Branding du Deal rapide</div>
        <h2 className="mt-1 text-lg font-black tracking-[-0.025em]">Bannière de la proposition</h2>
        <p className="mt-1 text-xs text-muted-foreground">Configure ici le logo, le titre, le sous-titre, l’image et le style visibles sur le lien public de cette propal.</p>
      </div>
      <div className="p-5 sm:p-6"><SDQuickProposalBranding dealId={dealId} /></div>
    </section>

    <Card className="overflow-hidden p-0">
      <div className="border-b border-border bg-primary/[0.035] px-5 py-4 sm:px-6">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">Impact financier partenaire</div>
        <h2 className="mt-1 text-lg font-black tracking-[-0.025em]">Exemple de revenu pour {companyName}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Ce calcul est présenté comme un exemple dans la propal. Modifie les hypothèses selon le volume réel du loueur.</p>
      </div>
      <div className="p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <label><span className="text-xs font-bold">Afficher dans la propal</span><select className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={revenueExample.enabled ? "yes" : "no"} onChange={event => set("partnerRevenueExample", { ...revenueExample, enabled: event.target.value === "yes" })}><option value="yes">Oui</option><option value="no">Non</option></select></label>
          <label><span className="text-xs font-bold">Caution moyenne (€)</span><Input className="mt-2" type="number" min="0" step="50" value={gandoEconomics.averageDeposit} onChange={event => setEconomics("averageDeposit", Number(event.target.value))} disabled={agreed} /></label>
          <label><span className="text-xs font-bold">Cautions activées / mois</span><Input className="mt-2" type="number" min="0" step="1" value={gandoEconomics.monthlyActivations} onChange={event => setEconomics("monthlyActivations", Number(event.target.value))} disabled={agreed} /></label>
          <label><span className="text-xs font-bold">Marge loueur (%)</span><Input className="mt-2" type="number" min="0" max="100" step="0.1" value={gandoEconomics.partnerMarginPercent} onChange={event => setEconomics("partnerMarginPercent", Number(event.target.value))} disabled={agreed} /></label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/20 p-4"><div className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Par caution activée · HT</div><div className="mt-2 text-2xl font-black tracking-[-0.04em]">{euro(revenuePerDeposit)} HT</div><div className="mt-1 text-xs text-muted-foreground">{euro(revenueExample.averageDeposit)} × {revenueExample.partnerMarginRate.toLocaleString("fr-FR")} %</div></div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4"><div className="text-[10px] font-black uppercase tracking-[0.1em] text-primary">Revenu estimé / mois · HT</div><div className="mt-2 text-2xl font-black tracking-[-0.04em] text-primary">{euro(monthlyRevenue)} HT</div><div className="mt-1 text-xs text-muted-foreground">{revenueExample.monthlyActivations.toLocaleString("fr-FR")} cautions activées</div></div>
          <div className="rounded-xl border border-border bg-muted/20 p-4"><div className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Projection annuelle · HT</div><div className="mt-2 text-2xl font-black tracking-[-0.04em]">{euro(annualRevenue)} HT</div><div className="mt-1 text-xs text-muted-foreground">si le même volume est maintenu 12 mois</div></div>
        </div>

        <div className="mt-4 rounded-xl bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
          Exemple : avec une caution moyenne de <strong className="text-foreground">{euro(revenueExample.averageDeposit)}</strong>, une marge de <strong className="text-foreground">{revenueExample.partnerMarginRate.toLocaleString("fr-FR")} %</strong> représente <strong className="text-foreground">{euro(revenuePerDeposit)} HT</strong> par caution. À <strong className="text-foreground">{revenueExample.monthlyActivations.toLocaleString("fr-FR")} cautions/mois</strong>, cela représente environ <strong className="text-foreground">{euro(monthlyRevenue)} HT/mois</strong>, soit <strong className="text-foreground">{euro(annualRevenue)} HT/an</strong>.
        </div>
      </div>
    </Card>

    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <Card className="space-y-5 p-5 lg:p-6">
        <Field label="Titre de la proposition"><Input value={value.deckTitle} onChange={event => set("deckTitle", event.target.value)} placeholder={`Proposition Gando × ${companyName}`} /></Field>
        <Field label="Message principal" hint="Ce que le client doit comprendre en 20 secondes"><Area value={value.executiveMessage} onChange={next => set("executiveMessage", next)} rows={6} placeholder={`Dans le cadre du deal « ${dealName} », voici le cadre commercial proposé à ${companyName}…`} /></Field>
        <Field label="Ce que comprend l’offre" hint="Un élément par ligne"><Area value={value.solution.join("\n")} onChange={next => set("solution", draftLines(next))} rows={7} placeholder={'Caution sans blocage de fonds\nGarantie d’encaissement\nParcours digital de suivi'} /></Field>
        <Field label="Prochaine étape"><Input value={value.callToAction} onChange={event => set("callToAction", event.target.value)} placeholder="Êtes-vous en accord avec cette proposition pour passer au contrat ?" /></Field>
      </Card>

      <Card className="space-y-5 p-5 lg:p-6">
        <Field label="Autres lignes de prix" hint="Les frais Gando, la marge du loueur et le tarif total sont calculés depuis la grille interne ci-dessus. Autres lignes : intitulé | prix | précision"><Area value={pricingDraft} onChange={next => { setPricingDraft(next); set("pricing", [...quickPricingRows(gandoEconomics), ...parsePricing(next).filter(row => !isQuickPricingRow(row.item))]); setPricingConfirmed(false); }} rows={5} placeholder={'Mise en place | 0 € HT | incluse'} /></Field>
        <Field label="Conditions commerciales" hint="Une condition par ligne"><Area value={value.commercialTerms.join("\n")} onChange={next => set("commercialTerms", draftLines(next))} rows={7} placeholder={'Durée de sécurisation : [XX jours]\nPlafond : [X XXX €]\nFrais d’encaissement : [X % + X € HT]'} /></Field>
        <Field label="Points de valeur / ROI" hint="Une ligne par bénéfice"><Area value={value.proofPoints.join("\n")} onChange={next => set("proofPoints", draftLines(next))} rows={6} placeholder={'Pas de fonds immobilisés\nGain de temps opérationnel\nRevenu additionnel possible'} /></Field>
      </Card>
    </div>

  </div></div>;
}
