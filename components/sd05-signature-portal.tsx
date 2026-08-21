"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileSignature, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { SD05ContractRenderer, type SD05SignatureSummary } from "@/components/sd05-contract-renderer";
import type { SD05Content } from "@/lib/sd-stage-content";

type PortalData = {
  request: SD05SignatureSummary;
  signer: { name: string; email: string; role: string | null; organization: string | null };
  consentText: string;
  snapshot: {
    room: { companyName: string; title: string };
    document: { contractReference: string; contractVersion: string };
    content: SD05Content;
  };
};

export function SD05SignaturePortal({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [accepted, setAccepted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/signatures/sd05/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Lien de signature indisponible.");
      setData(payload as PortalData);
      const name = String(payload?.signer?.name || "").trim();
      if (name) setSignatureName(name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lien de signature indisponible.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function sign() {
    if (!accepted || signatureName.trim().length < 2 || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/signatures/sd05/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted, signatureName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "La signature n'a pas pu être enregistrée.");
      setData(current => current ? { ...current, request: { ...current.request, ...payload.request } } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La signature n'a pas pu être enregistrée.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm"><Loader2 className="h-5 w-5 animate-spin text-[#735DF3]" /> Chargement du contrat sécurisé…</div></main>;
  }

  if (!data || error && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <LockKeyhole className="mx-auto h-10 w-10 text-[#735DF3]" />
          <h1 className="mt-5 text-xl font-black">Lien de signature indisponible</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{error || "Ce lien n'est plus valide."}</p>
          <p className="mt-4 text-xs text-slate-400">Contactez Gando pour recevoir une nouvelle invitation.</p>
        </div>
      </main>
    );
  }

  const signed = data.request.status === "signed";
  const signatureSummary: SD05SignatureSummary = { ...data.request, signerName: data.signer.name, signerEmail: data.signer.email, signerRole: data.signer.role, signerOrganization: data.signer.organization };

  return (
    <main className="min-h-screen bg-slate-100 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#735DF3]/10 text-[#735DF3]"><FileSignature className="h-5 w-5" /></div>
            <div><div className="text-sm font-black">Signature électronique Gando</div><div className="text-xs text-slate-500">Lien personnel envoyé à {data.signer.email}</div></div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 sm:mt-0"><ShieldCheck className="h-4 w-4" /> Document figé · SHA-256</div>
        </div>

        {signed ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" /><div><h1 className="font-black">Signature enregistrée</h1><p className="mt-1 text-sm leading-6 text-emerald-800">Votre signature électronique est horodatée. L'empreinte du contrat et la preuve technique sont conservées par Gando.</p>{data.request.signedAt ? <p className="mt-2 text-xs font-semibold">Signé le {new Date(data.request.signedAt).toLocaleString("fr-FR")}</p> : null}</div></div>
          </div>
        ) : null}

        <SD05ContractRenderer content={data.snapshot.content} companyName={data.snapshot.room.companyName} contractHash={data.request.contractHash} signatures={[signatureSummary]} />

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {signed ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Identifiant de preuve</div><div className="mt-2 break-all font-mono text-xs text-slate-700">{data.request.id}</div></div>
              <div><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Empreinte de la signature</div><div className="mt-2 break-all font-mono text-xs text-slate-700">{data.request.signedPayloadHash || "—"}</div></div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              <div className="text-xs font-black uppercase tracking-[0.13em] text-[#735DF3]">Dernière étape</div>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Signer le contrat</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">En signant, vous confirmez votre identité déclarée et votre volonté de conclure ce contrat par voie électronique.</p>

              <label className="mt-6 block text-sm font-bold text-slate-800">Nom complet du signataire</label>
              <input value={signatureName} onChange={event => setSignatureName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-[#735DF3]/20 transition focus:border-[#735DF3] focus:ring-4" placeholder="Prénom NOM" autoComplete="name" />

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#735DF3]" />
                <span className="text-xs leading-5 text-slate-600">{data.consentText}</span>
              </label>

              {error ? <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}
              <button onClick={() => void sign()} disabled={!accepted || signatureName.trim().length < 2 || sending} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#735DF3] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#6550e8] disabled:cursor-not-allowed disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} {sending ? "Signature en cours…" : "Signer électroniquement"}
              </button>
              <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">Le lien est personnel. La date et l'heure, l'email, l'empreinte du document et les informations techniques nécessaires à la preuve sont journalisés.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
