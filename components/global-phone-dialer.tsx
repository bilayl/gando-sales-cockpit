"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Phone, PhoneCall, X } from "lucide-react";

const ALLO_URL = "https://web.withallo.com/";

function sanitizePhone(phone: string) {
  const value = phone.replace(/[\s().-]/g, "");
  return value.startsWith("00") ? "+" + value.slice(2) : value;
}

export function GlobalPhoneDialer() {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string }>).detail;
      setNumber(detail?.phone || "");
      setOpen(true);
      setCopied(false);
    };
    window.addEventListener("gando:open-dialer", onOpen);
    return () => window.removeEventListener("gando:open-dialer", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetch("/api/withallo/status", { cache: "no-store" }).then(async result => {
      const body = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(body.error || "Statut Allo indisponible");
      if (!active) return;
      setConnected(Boolean(body.connected));
      setConfigured(Boolean(body.configured));
      setStatusError(body.error || "");
    }).catch(error => { if (active) setStatusError(error instanceof Error ? error.message : "Allo indisponible"); });
    return () => { active = false; };
  }, [open]);

  const normalized = sanitizePhone(number);
  const valid = /^\+[1-9]\d{7,14}$/.test(normalized);

  async function copy() {
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-[55] grid h-12 w-12 place-items-center rounded-full border border-border bg-card shadow-lg transition hover:-translate-y-0.5 hover:bg-muted" aria-label="Ouvrir la téléphonie Allo" title="Allo"><Phone className="h-5 w-5" /></button>
      {open ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Appeler avec Allo">
          <div className="w-full max-w-[500px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div><div className="text-lg font-semibold">Téléphonie Allo</div><div className="mt-1 text-xs text-muted-foreground">Connectée au CRM Gando avec WITHALLO_API_KEY</div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-2 hover:bg-muted"><X size={18} /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs">
                <span className={"inline-block h-2 w-2 rounded-full mr-2 " + (connected ? "bg-emerald-500" : "bg-amber-500")} />
                {connected ? "API Allo connectée" : configured ? "Connexion Allo à vérifier" : "Allo non configuré"}
                {statusError ? <p className="mt-2 text-destructive">{statusError}</p> : null}
              </div>
              <div><label htmlFor="gando-allo-number" className="text-xs font-semibold">Numéro du prospect</label>
                <input id="gando-allo-number" value={number} onChange={event => { setNumber(event.target.value); setCopied(false); }} placeholder="+33612345678" inputMode="tel" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-lg outline-none focus:ring-2 focus:ring-ring" />
                <p className="mt-2 text-[11px] text-muted-foreground">Utilise le format international (+33, +590, etc.) pour éviter d’appeler un mauvais numéro.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <a href={valid ? "tel:" + normalized : undefined} aria-disabled={!valid} onClick={event => { if (!valid) event.preventDefault(); }} className={"inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground " + (!valid ? "pointer-events-none opacity-40" : "hover:opacity-90")}><PhoneCall size={16} /> Clic pour appeler</a>
                <button type="button" onClick={() => void copy()} disabled={!valid} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-40">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Numéro copié" : "Copier le numéro"}</button>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">Le clic pour appeler passe par le gestionnaire téléphonique de ton appareil. Pour appeler avec Allo dans Chrome, installe son extension et connecte ton compte. L’API Allo permet de récupérer les appels et les résumés, mais ne fournit pas ici de softphone embarqué.</p>
              <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs font-medium text-primary">
                <a href={ALLO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">Ouvrir Allo <ExternalLink size={12} /></a>
                <a href="https://www.withallo.com/fr/telecharger" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">Extension Chrome Allo <ExternalLink size={12} /></a>
                <a href="/phone" onClick={() => setOpen(false)} className="inline-flex items-center gap-1">Historique Gando</a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
