"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Phone, PhoneCall, X } from "lucide-react";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

const ALLO_URL = "https://web.withallo.com/";
const DOWNLOAD_URL = "https://www.withallo.com/fr/telecharger";

export function GlobalPhoneDialer() {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [dialClicked, setDialClicked] = useState(false);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string; name?: string; company?: string }>).detail;
      setNumber(detail?.phone || "");
      setName(detail?.name || "");
      setCompany(detail?.company || "");
      setOpen(true);
      setCopied(false);
      setFeedback("");
      setFeedbackError("");
      setDialClicked(false);
    };
    window.addEventListener("gando:open-dialer", onOpen);
    return () => window.removeEventListener("gando:open-dialer", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setStatusError("");
    void fetch("/api/withallo/status", { cache: "no-store" }).then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Impossible de vérifier la connexion Allo.");
      if (!active) return;
      setConnected(Boolean(body.connected));
      setConfigured(Boolean(body.configured));
      setStatusError(typeof body.error === "string" ? body.error : "");
    }).catch(error => {
      if (active) {
        setConnected(false);
        setStatusError(error instanceof Error ? error.message : "Allo indisponible");
      }
    });
    return () => { active = false; };
  }, [open]);

  const normalized = normalizeWithAlloDialNumber(number);
  const changePhone = (value: string) => {
    setNumber(value);
    setCopied(false);
    setFeedback("");
    setFeedbackError("");
    setDialClicked(false);
  };

  async function copyNumber() {
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      setFeedback("Numéro copié. Collez-le dans le clavier Allo pour appeler.");
      setFeedbackError("");
    } catch {
      setFeedbackError("La copie automatique est bloquée. Sélectionnez le numéro ci-dessus pour le copier manuellement.");
    }
  }

  function openAllo() {
    window.open(ALLO_URL, "_blank", "noopener,noreferrer");
    // Copy is optional: this action must still open Allo if clipboard permission is denied.
    void copyNumber();
  }

  async function queueCall() {
    if (!normalized || busy) return;
    setBusy(true);
    setFeedback("");
    setFeedbackError("");
    // Opening during the click gesture avoids pop-up blockers for the Allo tab.
    window.open(ALLO_URL, "_blank", "noopener,noreferrer");
    try {
      const response = await fetch("/api/withallo/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normalized, name, company }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Allo n’a pas accepté le numéro.");
      setFeedback("Numéro ajouté à la file Power Dialer Allo. Dans Allo, ouvrez la file et lancez l’appel.");
      setFeedbackError("");
    } catch (error) {
      setFeedbackError((error instanceof Error ? error.message : "Erreur Allo") + " Vous pouvez toujours coller le numéro dans Allo ou utiliser son extension Chrome.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setFeedback(""); setFeedbackError(""); }} className="fixed bottom-6 right-6 z-[55] grid h-12 w-12 place-items-center rounded-full border border-border bg-card shadow-lg transition hover:-translate-y-0.5 hover:bg-muted" aria-label="Ouvrir la téléphonie Allo" title="Allo">
        <Phone className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ pointerEvents: "auto" }} role="dialog" aria-modal="true" aria-label="Téléphonie Allo">
          <div className="w-full max-w-[520px] overflow-auto rounded-2xl border border-border bg-background shadow-2xl" style={{ maxHeight: "92vh" }}>
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <div className="text-lg font-semibold">Appeler avec Allo</div>
                <div className="mt-1 text-xs text-muted-foreground">Prépare le numéro depuis Gando, puis passe l’appel dans Allo.</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-2 hover:bg-muted"><X size={18}/></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs">
                <span className={"mr-2 inline-block h-2 w-2 rounded-full " + (connected ? "bg-emerald-500" : "bg-amber-500")}/>
                {connected ? "API Allo connectée" : configured ? "Connexion Allo à vérifier" : "Connexion Allo non configurée"}
                {statusError ? <p className="mt-2 text-destructive">{statusError}</p> : null}
              </div>
              <div>
                <label htmlFor="gando-allo-number" className="text-xs font-semibold">Numéro du prospect</label>
                <input id="gando-allo-number" value={number} onChange={event => changePhone(event.target.value)} placeholder="06 12 34 56 78 ou +590..." inputMode="tel" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-lg outline-none focus:ring-2 focus:ring-ring" />
                {normalized ? <p className="mt-2 text-xs text-muted-foreground">Numéro à composer : <span className="font-semibold text-foreground">{normalized}</span></p> :
                  <p className="mt-2 text-xs text-destructive">Saisissez un numéro français à 10 chiffres ou un numéro international (+33, +590, etc.).</p>}
              </div>
              <div className="space-y-2">
                <button type="button" disabled={!normalized || busy} onClick={() => void queueCall()} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? <Loader2 size={16} className="animate-spin"/> : <PhoneCall size={16}/>}
                  {busy ? "Préparation en cours…" : "Préparer dans Allo et ouvrir l’application"}
                </button>
                <p className="text-[11px] leading-5 text-muted-foreground">Ajoute ce prospect à votre file Power Dialer si la fonctionnalité et les permissions Allo sont activées. L’appel ne démarre pas automatiquement.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={normalized ? "tel:" + normalized : undefined} aria-disabled={!normalized} onClick={event => { if (!normalized) { event.preventDefault(); return; } setDialClicked(true); }} className={"inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-2 text-xs font-semibold hover:bg-muted " + (!normalized ? "pointer-events-none opacity-40" : "")}>
                  <Phone size={14}/> Appel via navigateur
                </a>
                <button type="button" onClick={() => void copyNumber()} disabled={!normalized} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-2 text-xs font-semibold hover:bg-muted disabled:opacity-40">
                  {copied ? <Check size={14}/> : <Copy size={14}/>}
                  {copied ? "Numéro copié" : "Copier le numéro"}
                </button>
              </div>
              {dialClicked ? <p className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs leading-5">Lien téléphonique ouvert. Si rien ne s’est passé, Chrome n’a probablement pas de gestionnaire <code>tel:</code>. Connectez Allo et activez sa gestion des liens téléphone, ou utilisez « Préparer dans Allo ».</p> : null}
              {feedback ? <p role="status" className="rounded-xl border border-border bg-muted/30 px-3 py-3 text-xs leading-5">{feedback}</p> : null}
              {feedbackError ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs leading-5 text-destructive">{feedbackError}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs">
                <a href={ALLO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Ouvrir Allo <ExternalLink size={12}/></a>
                <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Installer Allo pour Chrome <ExternalLink size={12}/></a>
                <a href="/phone" onClick={() => setOpen(false)} className="font-semibold text-primary hover:underline">Voir l’historique</a>
              </div>
              <button type="button" onClick={openAllo} className="w-full rounded-lg border border-border px-3 py-2.5 text-xs font-medium hover:bg-muted">Ouvrir Allo sans passer par la file d’appels</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
