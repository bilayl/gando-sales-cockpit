"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Link2, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SDQuickProposalBranding } from "@/components/sd-quick-proposal-branding";
import { createEmptySD04, type SD04Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomRecord } from "@/lib/sd-room-types";

const ROOM_BASE_URL = (process.env.NEXT_PUBLIC_ROOM_BASE_URL || "https://room.gando.pro").replace(/\/$/, "");

type RoomResponse = {
  deal?: { name?: string | null };
  room: SDRoomRecord | null;
  documents: SDDocumentRecord[];
};

function lines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

function pricingText(rows: SD04Content["pricing"]) {
  return rows.map(row => [row.item, row.price, row.notes].filter(Boolean).join(" | ")).join("\n");
}

function parsePricing(value: string): SD04Content["pricing"] {
  return lines(value).map(row => {
    const [item = "", price = "", notes = ""] = row.split("|").map(part => part.trim());
    return { item, price, notes, model: "" };
  }).filter(row => row.item);
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
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = (payload.documents || []).find((item: SDDocumentRecord) => item.code === "SD04");
      setValue({ ...createEmptySD04(), ...((document?.content || {}) as Partial<SD04Content>) });
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

  const ready = useMemo(() => Boolean(value.deckTitle.trim() && value.executiveMessage.trim() && (value.solution.length || value.pricing.length || value.commercialTerms.length)), [value]);

  const set = <K extends keyof SD04Content>(key: K, next: SD04Content[K]) => setValue(current => ({ ...current, [key]: next }));

  function generateTemplate() {
    setValue(current => ({
      ...current,
      deckTitle: current.deckTitle || `Proposition Gando × ${companyName}`,
      executiveMessage: current.executiveMessage || `Dans le cadre du deal « ${dealName} », voici le cadre commercial proposé à ${companyName}. Les éléments entre crochets sont à adapter avant de partager le lien au client.`,
      solution: current.solution.length ? current.solution : [
        "Caution sans blocage de fonds pour le locataire",
        "Garantie d’encaissement selon les conditions contractuelles",
        "Parcours digital de création, d’envoi et de suivi des cautions",
      ],
      pricing: current.pricing.length ? current.pricing : [
        { item: "Tarif Gando", model: "", price: "[X % HT]", notes: "par caution activée" },
        { item: "Marge partenaire", model: "", price: "[+X % HT]", notes: "optionnelle · conservée par le partenaire" },
      ],
      commercialTerms: current.commercialTerms.length ? current.commercialTerms : [
        "Durée de sécurisation : [XX jours]",
        "Plafond de caution : [X XXX €]",
        "Frais d’encaissement : [X % + X € HT]",
        "Périmètre / date de déploiement : [à confirmer]",
      ],
      proofPoints: current.proofPoints.length ? current.proofPoints : [
        "Pas de fonds immobilisés pour le locataire",
        "Gain de temps opérationnel pour les équipes",
        "Revenu additionnel possible sur chaque caution",
      ],
      callToAction: current.callToAction || "Êtes-vous en accord avec cette proposition pour passer au contrat ?",
    }));
    toast.success("Modèle de propal généré — complète les éléments entre crochets");
  }

  async function persist(publish: boolean) {
    if (working) return;
    if (publish && !ready) return toast.error("Ajoute au minimum un titre, un message et les éléments de l’offre.");
    setWorking(true);
    try {
      const content: SD04Content = {
        ...value,
        deckTitle: value.deckTitle.trim(),
        executiveMessage: value.executiveMessage.trim(),
        offerSummary: value.executiveMessage.trim(),
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
      setValue({ ...createEmptySD04(), ...((payload.document?.content || {}) as Partial<SD04Content>) });
      toast.success(publish ? "Lien de propal prêt à être partagé" : "Propal enregistrée");
      onChanged?.();
      if (publish) await load();
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
        <Button variant="outline" onClick={() => void persist(false)} disabled={working}><Save className="mr-2 h-4 w-4" />Enregistrer</Button>
        <Button onClick={() => void persist(true)} disabled={working || !ready || agreed}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}{published ? "Mettre à jour le lien" : "Générer le lien"}</Button>
      </div>

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

    <section className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-background shadow-sm">
      <div className="border-b border-primary/15 bg-primary/[0.06] px-5 py-4 sm:px-6">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">Branding du Deal rapide</div>
        <h2 className="mt-1 text-lg font-black tracking-[-0.025em]">Bannière de la proposition</h2>
        <p className="mt-1 text-xs text-muted-foreground">Configure ici le logo, le titre, le sous-titre, l’image et le style visibles sur le lien public de cette propal.</p>
      </div>
      <div className="p-5 sm:p-6"><SDQuickProposalBranding dealId={dealId} /></div>
    </section>

    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <Card className="space-y-5 p-5 lg:p-6">
        <Field label="Titre de la proposition"><Input value={value.deckTitle} onChange={event => set("deckTitle", event.target.value)} placeholder={`Proposition Gando × ${companyName}`} /></Field>
        <Field label="Message principal" hint="Ce que le client doit comprendre en 20 secondes"><Area value={value.executiveMessage} onChange={next => set("executiveMessage", next)} rows={6} placeholder={`Dans le cadre du deal « ${dealName} », voici le cadre commercial proposé à ${companyName}…`} /></Field>
        <Field label="Ce que comprend l’offre" hint="Un élément par ligne"><Area value={value.solution.join("\n")} onChange={next => set("solution", lines(next))} rows={7} placeholder={'Caution sans blocage de fonds\nGarantie d’encaissement\nParcours digital de suivi'} /></Field>
        <Field label="Prochaine étape"><Input value={value.callToAction} onChange={event => set("callToAction", event.target.value)} placeholder="Êtes-vous en accord avec cette proposition pour passer au contrat ?" /></Field>
      </Card>

      <Card className="space-y-5 p-5 lg:p-6">
        <Field label="Prix / offre" hint="Une ligne : intitulé | prix | précision"><Area value={pricingText(value.pricing)} onChange={next => set("pricing", parsePricing(next))} rows={7} placeholder={'Tarif Gando | [X % HT] | par caution activée\nMarge partenaire | [+X % HT] | optionnelle'} /></Field>
        <Field label="Conditions commerciales" hint="Une condition par ligne"><Area value={value.commercialTerms.join("\n")} onChange={next => set("commercialTerms", lines(next))} rows={7} placeholder={'Durée de sécurisation : [XX jours]\nPlafond : [X XXX €]\nFrais d’encaissement : [X % + X € HT]'} /></Field>
        <Field label="Points de valeur / ROI" hint="Une ligne par bénéfice"><Area value={value.proofPoints.join("\n")} onChange={next => set("proofPoints", lines(next))} rows={6} placeholder={'Pas de fonds immobilisés\nGain de temps opérationnel\nRevenu additionnel possible'} /></Field>
      </Card>
    </div>
  </div></div>;
}
