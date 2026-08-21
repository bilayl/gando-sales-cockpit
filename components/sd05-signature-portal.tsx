"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, Eraser, FileSignature, Loader2, LockKeyhole, PenLine, ShieldCheck, Type } from "lucide-react";
import { SD05ContractRenderer, type SD05SignatureSummary } from "@/components/sd05-contract-renderer";
import { contractPageCount } from "@/lib/sd05-contract";
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

function initialsFromName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 3).map(part => part.charAt(0).toUpperCase()).join(".").slice(0, 12);
}

export function SD05SignaturePortal({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureMode, setSignatureMode] = useState<"typed" | "drawn">("typed");
  const [hasDrawing, setHasDrawing] = useState(false);
  const [initialsText, setInitialsText] = useState("");
  const [initialsByPage, setInitialsByPage] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/signatures/sd05/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Lien de signature indisponible.");
      const next = payload as PortalData;
      setData(next);
      const name = String(next?.signer?.name || "").trim();
      if (name) {
        setSignatureName(name);
        setInitialsText(initialsFromName(name));
      }
      setInitialsByPage(next.request.initials || {});
      if (next.snapshot.content.allowTypedSignature === false && next.snapshot.content.allowDrawnSignature !== false) setSignatureMode("drawn");
      else if (next.request.signatureMode === "drawn") setSignatureMode("drawn");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lien de signature indisponible.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const pageCount = useMemo(() => data ? data.request.documentPageCount || contractPageCount(data.snapshot.content) : 0, [data]);
  const signed = data?.request.status === "signed";
  const effectiveInitials = signed ? data?.request.initials || {} : initialsByPage;
  const initialedPages = Object.keys(effectiveInitials).filter(key => effectiveInitials[key]).length;
  const initialsComplete = !data?.snapshot.content.requireInitialsEachPage || initialedPages >= pageCount;

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = canvasPoint(event);
    if (!canvas || !point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#111827";
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const point = canvasPoint(event);
    if (!canvas || !point) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasDrawing(true);
  }

  function stopDrawing(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drawingRef.current = false;
  }

  function clearDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }

  function initialEveryPage() {
    const value = initialsText.trim().slice(0, 12);
    if (!value || !pageCount) return;
    setInitialsByPage(Object.fromEntries(Array.from({ length: pageCount }, (_, index) => [String(index + 1), value])));
  }

  function togglePageInitial(page: number) {
    const value = initialsText.trim().slice(0, 12);
    if (!value) return;
    setInitialsByPage(current => {
      const next = { ...current };
      if (next[String(page)]) delete next[String(page)];
      else next[String(page)] = value;
      return next;
    });
  }

  async function sign() {
    if (!data || !accepted || signatureName.trim().length < 2 || sending || !initialsComplete) return;
    if (signatureMode === "drawn" && !hasDrawing) {
      setError("Dessinez votre signature manuscrite avant de signer.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const signatureDataUrl = signatureMode === "drawn" ? canvasRef.current?.toDataURL("image/png") || null : null;
      const response = await fetch(`/api/signatures/sd05/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted, signatureName, signatureMode, signatureDataUrl, initials: initialsByPage }),
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

  const signatureSummary: SD05SignatureSummary = { ...data.request, signerName: data.signer.name, signerEmail: data.signer.email, signerRole: data.signer.role, signerOrganization: data.signer.organization };
  const canTyped = data.snapshot.content.allowTypedSignature !== false;
  const canDrawn = data.snapshot.content.allowDrawnSignature !== false;
  const canSign = accepted && signatureName.trim().length >= 2 && initialsComplete && (signatureMode === "typed" || hasDrawing);

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
            <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" /><div><h1 className="font-black">Signature enregistrée</h1><p className="mt-1 text-sm leading-6 text-emerald-800">Votre signature et vos paraphes sont horodatés. L'empreinte du contrat et la preuve technique sont conservées par Gando.</p>{data.request.signedAt ? <p className="mt-2 text-xs font-semibold">Signé le {new Date(data.request.signedAt).toLocaleString("fr-FR")}</p> : null}</div></div>
          </div>
        ) : null}

        <SD05ContractRenderer content={data.snapshot.content} companyName={data.snapshot.room.companyName} contractHash={data.request.contractHash} signatures={[signatureSummary]} initialsByPage={effectiveInitials} />

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {signed ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Identifiant de preuve</div><div className="mt-2 break-all font-mono text-xs text-slate-700">{data.request.id}</div></div>
              <div><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Empreinte de la signature</div><div className="mt-2 break-all font-mono text-xs text-slate-700">{data.request.signedPayloadHash || "—"}</div></div>
              <div><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Mode</div><div className="mt-2 text-sm font-semibold text-slate-700">{data.request.signatureMode === "drawn" ? "Signature manuscrite" : "Signature écrite"}</div></div>
              <div><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Paraphes</div><div className="mt-2 text-sm font-semibold text-slate-700">{Object.keys(data.request.initials || {}).length} / {pageCount} pages</div></div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl">
              <div className="text-xs font-black uppercase tracking-[0.13em] text-[#735DF3]">Signature du document</div>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Parapher puis signer</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Vous pouvez signer à la main ou avec votre nom et prénom. Si les paraphes sont requis, chaque page doit être marquée avant la signature finale.</p>

              {data.snapshot.content.requireInitialsEachPage ? (
                <div className="mt-7 rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-800">Votre paraphe</label>
                      <input value={initialsText} onChange={event => setInitialsText(event.target.value.slice(0, 12))} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-[#735DF3]/20 transition focus:border-[#735DF3] focus:ring-4" placeholder="B.M." />
                    </div>
                    <button type="button" onClick={initialEveryPage} disabled={!initialsText.trim()} className="h-11 rounded-xl border border-[#735DF3]/25 bg-[#735DF3]/5 px-4 text-sm font-black text-[#5d49dc] disabled:opacity-40">Parapher toutes les pages</button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map(page => {
                      const active = Boolean(initialsByPage[String(page)]);
                      return <button key={page} type="button" onClick={() => togglePageInitial(page)} disabled={!initialsText.trim()} className={active ? "flex h-10 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700" : "flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500"}>{active ? <Check className="h-3.5 w-3.5" /> : null} Page {page}</button>;
                    })}
                  </div>
                  <div className={initialsComplete ? "mt-3 text-xs font-semibold text-emerald-700" : "mt-3 text-xs font-semibold text-amber-700"}>{initialedPages} / {pageCount} pages paraphées</div>
                </div>
              ) : null}

              <div className="mt-7">
                <label className="block text-sm font-bold text-slate-800">Nom complet du signataire</label>
                <input value={signatureName} onChange={event => setSignatureName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-[#735DF3]/20 transition focus:border-[#735DF3] focus:ring-4" placeholder="Prénom NOM" autoComplete="name" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {canTyped ? <button type="button" onClick={() => setSignatureMode("typed")} className={signatureMode === "typed" ? "rounded-xl border-2 border-[#735DF3] bg-[#735DF3]/5 p-4 text-left" : "rounded-xl border border-slate-200 p-4 text-left"}><div className="flex items-center gap-2 text-sm font-black"><Type className="h-4 w-4" /> Signature écrite</div><p className="mt-1 text-xs leading-5 text-slate-500">Votre nom et prénom sont rendus comme une signature.</p></button> : null}
                {canDrawn ? <button type="button" onClick={() => setSignatureMode("drawn")} className={signatureMode === "drawn" ? "rounded-xl border-2 border-[#735DF3] bg-[#735DF3]/5 p-4 text-left" : "rounded-xl border border-slate-200 p-4 text-left"}><div className="flex items-center gap-2 text-sm font-black"><PenLine className="h-4 w-4" /> Signature manuscrite</div><p className="mt-1 text-xs leading-5 text-slate-500">Dessinez directement votre signature au doigt ou à la souris.</p></button> : null}
              </div>

              {signatureMode === "typed" ? (
                <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 text-center text-[34px] italic text-slate-900" style={{ fontFamily: "'Segoe Script','Snell Roundhand','Brush Script MT',cursive" }}>{signatureName || "Prénom NOM"}</div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><span className="text-xs font-bold text-slate-600">Signez dans le cadre</span><button type="button" onClick={clearDrawing} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"><Eraser className="h-3.5 w-3.5" /> Effacer</button></div>
                  <canvas ref={canvasRef} width={900} height={260} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onPointerLeave={event => { if (drawingRef.current) stopDrawing(event); }} className="block h-[190px] w-full touch-none bg-white" />
                </div>
              )}

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#735DF3]" />
                <span className="text-xs leading-5 text-slate-600">{data.consentText}</span>
              </label>

              {error ? <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}
              <button onClick={() => void sign()} disabled={!canSign || sending} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#735DF3] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#6550e8] disabled:cursor-not-allowed disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} {sending ? "Signature en cours…" : "Signer électroniquement"}
              </button>
              <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">Le lien est personnel. Les paraphes, le mode de signature, l'heure, l'email, l'empreinte du document et les informations techniques nécessaires à la preuve sont journalisés.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
