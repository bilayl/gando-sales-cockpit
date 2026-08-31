"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ExternalLink, FileText, Loader2, ShieldCheck } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import type { SD04Content, SD05Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord } from "@/lib/sd-room-types";

type PublicDocument = SDDocumentRecord & {
  validated_at?: string | null;
  validated_by_first_name?: string | null;
  validated_by_last_name?: string | null;
};

type PublicData = {
  room: { companyName: string; displayTitle: string; displaySubtitle: string };
  documents: PublicDocument[];
  visitorEmail: string;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function List({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <ul className="space-y-2.5">{items.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 text-[15px] leading-6 text-[#465157]"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7166c7]" /><span>{item}</span></li>)}</ul>;
}

export function PublicQuickDealRoom({ token }: { token: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    setFirstName(sessionStorage.getItem(`gando-room-first:${token}`) || "");
    setLastName(sessionStorage.getItem(`gando-room-last:${token}`) || "");
    setEmail(sessionStorage.getItem(`gando-room-email:${token}`) || "");
  }, [token]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Accès impossible");
      setData(payload);
      sessionStorage.setItem(`gando-room-first:${token}`, firstName.trim());
      sessionStorage.setItem(`gando-room-last:${token}`, lastName.trim());
      sessionStorage.setItem(`gando-room-email:${token}`, payload.visitorEmail || email.trim());
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : "Accès impossible");
    } finally {
      setLoading(false);
    }
  }

  const proposal = data?.documents.find(document => document.code === "SD04");
  const contract = data?.documents.find(document => document.code === "SD05");
  const proposalContent = useMemo(() => ({ deckTitle: "", executiveMessage: "", solution: [], pricing: [], commercialTerms: [], proofPoints: [], callToAction: "", ...((proposal?.content || {}) as Partial<SD04Content>) }) as SD04Content, [proposal]);
  const contractContent = useMemo(() => ({ contractTitle: "Contrat", contractUrl: "", contractStatus: "draft", ...((contract?.content || {}) as Partial<SD05Content>) }) as SD05Content, [contract]);
  const agreed = proposal?.status === "validated";
  const contractSigned = contract?.status === "validated" || contractContent.contractStatus === "signed";

  async function agree() {
    if (!data || !proposal || proposal.status !== "published") return;
    setValidating(true);
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.visitorEmail, firstName, lastName, documentCode: "SD04" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Accord impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD04" ? payload.document : document) } : current);
    } catch (agreementError) {
      setError(agreementError instanceof Error ? agreementError.message : "Accord impossible");
    } finally {
      setValidating(false);
    }
  }

  if (!data) return <main className="min-h-screen bg-[#f5f6f7] px-5 py-10 text-[#111] sm:py-16"><div className="mx-auto max-w-[680px]">
    <div className="flex items-center gap-2.5"><GandoMark className="h-8 w-8" /><span className="text-sm font-semibold">Gando</span></div>
    <form onSubmit={unlock} className="mt-8 rounded-[22px] border border-[#d8dde0] bg-white p-6 shadow-[0_18px_55px_rgba(30,40,45,0.06)] sm:p-8">
      <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6c62bf]">Proposition commerciale</div><h1 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">Accéder à la proposition</h1><p className="mt-3 text-sm leading-6 text-[#59646a]">Identifiez-vous pour consulter la proposition et confirmer votre accord.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Prénom<input className="mt-2 h-11 w-full rounded-xl border border-[#cbd2d6] px-3 text-sm" value={firstName} onChange={event => setFirstName(event.target.value)} required /></label><label className="text-xs font-semibold">Nom<input className="mt-2 h-11 w-full rounded-xl border border-[#cbd2d6] px-3 text-sm" value={lastName} onChange={event => setLastName(event.target.value)} required /></label></div>
      <label className="mt-4 block text-xs font-semibold">Email professionnel<input type="email" className="mt-2 h-11 w-full rounded-xl border border-[#cbd2d6] px-3 text-sm" value={email} onChange={event => setEmail(event.target.value)} required /></label>
      {error ? <div className="mt-4 rounded-xl bg-[#fff3f1] p-3 text-sm text-[#9a4137]">{error}</div> : null}
      <button type="submit" disabled={loading} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#202a2f] text-sm font-semibold text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Voir la proposition</button>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#687277]"><ShieldCheck className="h-4 w-4 text-[#6558c8]" /> Accès confidentiel</div>
    </form>
  </div></main>;

  return <main className="min-h-screen bg-[#f5f6f7] text-[#1c2529]">
    <header className="border-b border-[#e1e4e6] bg-white"><div className="mx-auto flex h-16 max-w-[980px] items-center gap-3 px-5 sm:px-7"><GandoMark className="h-8 w-8" /><span className="text-sm font-semibold">Gando</span><span className="text-[#c3c8cb]">/</span><span className="truncate text-sm text-[#4c565b]">{data.room.companyName}</span><span className="ml-auto text-xs text-[#687277]">{firstName} {lastName}</span></div></header>
    <div className="mx-auto max-w-[980px] px-5 py-9 sm:px-7 sm:py-12">
      <div className="mb-7"><div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#7166c7]">Proposition Gando</div><h1 className="mt-2 text-[36px] font-semibold tracking-[-0.04em]">{proposalContent.deckTitle || data.room.displayTitle}</h1><p className="mt-3 max-w-3xl text-[17px] leading-7 text-[#59646a]">{proposalContent.executiveMessage || "Votre proposition commerciale est en préparation."}</p></div>

      <section className="rounded-[20px] border border-[#e0e4e6] bg-white p-6 sm:p-8">
        {proposalContent.solution.length ? <div><div className="text-xs font-bold uppercase tracking-[0.1em] text-[#687277]">Ce que comprend l’offre</div><div className="mt-4"><List items={proposalContent.solution} /></div></div> : null}
        {proposalContent.pricing.length ? <div className="mt-7 border-t border-[#eceeef] pt-6"><div className="text-xs font-bold uppercase tracking-[0.1em] text-[#687277]">Tarification</div><div className="mt-4 divide-y divide-[#eceeef]">{proposalContent.pricing.map((row, index) => <div key={`${row.item}-${index}`} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center"><div className="font-semibold sm:flex-1">{row.item}</div><div className="font-semibold text-[#5d52ae]">{row.price}</div>{row.notes ? <div className="text-xs text-[#7b8489] sm:w-52 sm:text-right">{row.notes}</div> : null}</div>)}</div></div> : null}
        {proposalContent.commercialTerms.length ? <div className="mt-7 border-t border-[#eceeef] pt-6"><div className="text-xs font-bold uppercase tracking-[0.1em] text-[#687277]">Conditions</div><div className="mt-4"><List items={proposalContent.commercialTerms} /></div></div> : null}
        {proposalContent.proofPoints.length ? <div className="mt-7 border-t border-[#eceeef] pt-6"><div className="text-xs font-bold uppercase tracking-[0.1em] text-[#687277]">Pourquoi Gando</div><div className="mt-4"><List items={proposalContent.proofPoints} /></div></div> : null}
      </section>

      <section className="mt-6 rounded-[20px] border border-[#d7dce0] bg-[#202a2f] p-6 text-white sm:p-8">{agreed ? <div className="flex gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#dff0e3] text-[#376b43]"><CheckCircle2 className="h-5 w-5" /></div><div><h2 className="text-xl font-semibold">Accord enregistré</h2><p className="mt-1 text-sm text-white/65">Votre accord sur cette proposition est enregistré{proposal?.validated_at ? ` le ${formatDate(proposal.validated_at)}` : ""}.</p></div></div> : <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Accord commercial</div><h2 className="mt-1 text-[23px] font-semibold">{proposalContent.callToAction || "Êtes-vous en accord avec cette proposition ?"}</h2><p className="mt-2 text-sm text-white/65">Votre clic enregistre votre accord sur cette version et permet de passer directement au contrat.</p></div><button type="button" onClick={() => void agree()} disabled={validating || proposal?.status !== "published"} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#202a2f] disabled:opacity-50">{validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Je suis d’accord</button></div>}</section>

      {agreed ? <section className="mt-6 rounded-[20px] border border-[#e0e4e6] bg-white p-6 sm:p-8"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7166c7]">Étape suivante</div><h2 className="mt-1 text-2xl font-semibold">Contrat</h2>{contractContent.contractUrl ? <div className="mt-5 flex flex-col gap-4 rounded-xl border border-[#e1e5e7] bg-[#f8f9f9] p-4 sm:flex-row sm:items-center"><FileText className="h-6 w-6 text-[#7166c7]" /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{contractContent.contractTitle || "Contrat"}</div><div className="mt-1 text-xs text-[#687277]">{contractSigned ? "Contrat signé" : "Contrat disponible"}</div></div><a href={contractContent.contractUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#202a2f] px-4 text-sm font-semibold text-white">Ouvrir <ExternalLink className="h-4 w-4" /></a></div> : <p className="mt-3 text-sm leading-6 text-[#687277]">Le contrat est en préparation. Vous le retrouverez ici dès qu’il sera ajouté au deal.</p>}</section> : null}
    </div>
  </main>;
}