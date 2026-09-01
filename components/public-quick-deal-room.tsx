"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ExternalLink, FileText, Loader2 } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { SDRoomBrandBanner } from "@/components/sd-room-brand-banner";
import type { SD04Content, SD05Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomBrandTheme } from "@/lib/sd-room-types";

type PublicDocument = SDDocumentRecord & {
  validated_at?: string | null;
  validated_by_first_name?: string | null;
  validated_by_last_name?: string | null;
};

type PublicData = {
  room: {
    id?: string;
    companyName: string;
    companyLogoUrl?: string | null;
    bannerImageUrl?: string | null;
    theme?: SDRoomBrandTheme;
    displayTitle: string;
    displaySubtitle: string;
  };
  documents: PublicDocument[];
  visitorEmail: string;
  visitorFirstName?: string;
  visitorLastName?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function List({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <ul className="space-y-2.5">{items.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 text-[15px] leading-6 text-[#465157]"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7166c7]" /><span>{item}</span></li>)}</ul>;
}

function PricingCards({ pricing }: { pricing: SD04Content["pricing"] }) {
  if (!pricing.length) return null;
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pricing.map((row, index) => <div key={`${row.item}-${index}`} className="rounded-[16px] border border-[#dedcf0] bg-[#f8f7ff] p-4">
    <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#7166c7]">{row.item}</div>
    <div className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-[#211f32]">{row.price || "À définir"}</div>
    {row.notes ? <div className="mt-2 text-xs leading-5 text-[#6c697c]">{row.notes}</div> : null}
  </div>)}</div>;
}

export function PublicQuickDealRoom({ token }: { token: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Accès impossible");
        if (!cancelled) setData(payload);
      } catch (accessError) {
        if (!cancelled) setError(accessError instanceof Error ? accessError.message : "Accès impossible");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  const proposal = data?.documents.find(document => document.code === "SD04");
  const contract = data?.documents.find(document => document.code === "SD05");
  const proposalContent = useMemo(() => ({ deckTitle: "", executiveMessage: "", solution: [], pricing: [], commercialTerms: [], proofPoints: [], callToAction: "", ...((proposal?.content || {}) as Partial<SD04Content>) }) as SD04Content, [proposal]);
  const contractContent = useMemo(() => ({ contractTitle: "Contrat", contractUrl: "", contractStatus: "draft", ...((contract?.content || {}) as Partial<SD05Content>) }) as SD05Content, [contract]);
  const agreed = proposal?.status === "validated";
  const contractSigned = contract?.status === "validated" || contractContent.contractStatus === "signed";

  async function agree() {
    if (!data || !proposal || proposal.status !== "published") return;
    if (firstName.trim().length < 2 || lastName.trim().length < 2) return setError("Renseignez votre prénom et votre nom pour enregistrer l’accord.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Renseignez un email valide pour enregistrer l’accord.");
    setValidating(true);
    setError("");
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), documentCode: "SD04" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Accord impossible");
      setData(current => current ? { ...current, visitorEmail: email.trim(), visitorFirstName: firstName.trim(), visitorLastName: lastName.trim(), documents: current.documents.map(document => document.code === "SD04" ? payload.document : document) } : current);
    } catch (agreementError) {
      setError(agreementError instanceof Error ? agreementError.message : "Accord impossible");
    } finally {
      setValidating(false);
    }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f5f6f7]"><Loader2 className="h-6 w-6 animate-spin text-[#7166c7]" /></main>;
  if (!data) return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] px-5"><div className="max-w-md rounded-2xl border border-[#e0e4e6] bg-white p-6 text-center"><GandoMark className="mx-auto h-8 w-8" /><h1 className="mt-4 text-xl font-semibold">Proposition indisponible</h1><p className="mt-2 text-sm text-[#687277]">{error || "Ce lien n’est plus disponible."}</p></div></main>;

  return <main className="min-h-screen bg-[#f5f6f7] text-[#1c2529]">
    <header className="border-b border-[#e1e4e6] bg-white"><div className="mx-auto flex h-16 max-w-[980px] items-center gap-3 px-5 sm:px-7"><GandoMark className="h-8 w-8" /><span className="text-sm font-semibold">Gando</span><span className="text-[#c3c8cb]">/</span><span className="truncate text-sm text-[#4c565b]">{data.room.companyName}</span><span className="ml-auto rounded-full bg-[#f2f0ff] px-3 py-1 text-[11px] font-semibold text-[#6257b8]">Proposition commerciale</span></div></header>

    <SDRoomBrandBanner companyName={data.room.companyName} logoUrl={data.room.companyLogoUrl || null} bannerUrl={data.room.bannerImageUrl || null} theme={data.room.theme || "gando"} title={proposalContent.deckTitle || data.room.displayTitle} subtitle={proposalContent.executiveMessage || data.room.displaySubtitle || "Proposition commerciale"} className="border-b border-[#e1e4e6]" />

    <div className="mx-auto max-w-[980px] px-5 py-9 sm:px-7 sm:py-12">
      <section className="rounded-[20px] border border-[#e0e4e6] bg-white p-6 sm:p-8">
        {proposalContent.pricing.length ? <div><div className="text-xs font-bold uppercase tracking-[0.1em] text-[#687277]">Tarification</div><p className="mt-2 max-w-2xl text-sm leading-6 text-[#687277]">Les éléments clés sont présentés immédiatement, comme dans une propal commerciale : tarif, marge éventuelle et conditions principales.</p><div className="mt-5"><PricingCards pricing={proposalContent.pricing} /></div></div> : null}
        {proposalContent.solution.length ? <div className={proposalContent.pricing.length ? "mt-7 border-t border-[#eceeef] pt-6" : ""}><div className="text-xs font-bold uppercase tracking-[0.1em] text-[#687277]">Ce que comprend l’offre</div><div className="mt-4"><List items={proposalContent.solution} /></div></div> : null}
        {proposalContent.commercialTerms.length ? <div className="mt-7 border-t border-[#eceeef] pt-6"><div className="text-xs font-bold uppercase tracking-[0.1em] text-[#687277]">Conditions commerciales</div><div className="mt-4"><List items={proposalContent.commercialTerms} /></div></div> : null}
        {proposalContent.proofPoints.length ? <div className="mt-7 border-t border-[#eceeef] pt-6"><div className="text-xs font-bold uppercase tracking-[0.1em] text-[#687277]">Pourquoi Gando</div><div className="mt-4"><List items={proposalContent.proofPoints} /></div></div> : null}
      </section>

      <section className="mt-6 rounded-[20px] border border-[#d7dce0] bg-[#202a2f] p-6 text-white sm:p-8">{agreed ? <div className="flex gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#dff0e3] text-[#376b43]"><CheckCircle2 className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold">Accord enregistré</h2><p className="mt-1 text-sm text-white/65">Votre accord sur cette proposition est enregistré{proposal?.validated_at ? ` le ${formatDate(proposal.validated_at)}` : ""}.</p></div></div> : <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Accord commercial</div><h2 className="mt-1 text-[23px] font-semibold">{proposalContent.callToAction || "Êtes-vous en accord avec cette proposition ?"}</h2><p className="mt-2 max-w-2xl text-sm text-white/65">La proposition est consultable librement. Ces informations servent uniquement à enregistrer qui donne l’accord commercial.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><input value={firstName} onChange={event => setFirstName(event.target.value)} placeholder="Prénom" className="h-11 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/40" /><input value={lastName} onChange={event => setLastName(event.target.value)} placeholder="Nom" className="h-11 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/40" /><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email professionnel" className="h-11 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/40" /></div>
        {error ? <div className="mt-3 text-sm text-[#ffb9ae]">{error}</div> : null}
        <button type="button" onClick={() => void agree()} disabled={validating || proposal?.status !== "published"} className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#202a2f] disabled:opacity-50">{validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Je suis d’accord</button>
      </div>}</section>

      {agreed ? <section className="mt-6 rounded-[20px] border border-[#e0e4e6] bg-white p-6 sm:p-8"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7166c7]">Étape suivante</div><h2 className="mt-1 text-2xl font-semibold">Contrat</h2>{contractContent.contractUrl ? <div className="mt-5 flex flex-col gap-4 rounded-xl border border-[#e1e5e7] bg-[#f8f9f9] p-4 sm:flex-row sm:items-center"><FileText className="h-6 w-6 text-[#7166c7]" /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{contractContent.contractTitle || "Contrat"}</div><div className="mt-1 text-xs text-[#687277]">{contractSigned ? "Contrat signé" : "Contrat disponible"}</div></div><a href={contractContent.contractUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#202a2f] px-4 text-sm font-semibold text-white">Ouvrir <ExternalLink className="h-4 w-4" /></a></div> : <p className="mt-3 text-sm leading-6 text-[#687277]">Le contrat est en préparation. Vous le retrouverez ici dès qu’il sera ajouté au deal.</p>}</section> : null}
    </div>
  </main>;
}
