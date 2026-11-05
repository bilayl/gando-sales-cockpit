"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Minimize2, Phone, PhoneCall, RefreshCw, X } from "lucide-react";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

const ALLO_ORIGIN = "https://web.withallo.com";
const ALLO_EMBED_URL = ALLO_ORIGIN + "?variant=dialer";
const ALLO_EMBED_HELP = "https://help.withallo.com/en/integrations/dialer/embedded-dialer";

type DialerEvent = {
  source?: string;
  type?: string;
  payload?: Record<string, unknown>;
};

type ContactMatch = { id: string; name: string; company: string | null; href: string };
type IncomingResult = {
  state: "loading" | "match" | "multiple" | "unknown" | "error" | "masked";
  phone: string | null;
  contacts: ContactMatch[];
  message?: string;
};
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function extractIncomingPhone(payload: unknown): string | null {
  const root = asRecord(payload);
  // Allo's incoming_call is the authoritative direction. Never use a "to"
  // number here, which would be Gando's own line.
  const sources = [root, asRecord(root.caller), asRecord(root.call), asRecord(root.contact), asRecord(root.from)];
  for (const value of sources) {
    for (const field of ["from_number", "caller_number", "caller_phone", "phone_number", "from", "phone", "number"]) {
      const candidate = value[field];
      if (typeof candidate !== "string") continue;
      const parsed = normalizeWithAlloDialNumber(candidate);
      if (parsed) return parsed;
    }
  }
  return null;
}

export function GlobalPhoneDialer() {
  const router = useRouter();
  const lookupSequence = useRef(0);
  const incomingDedup = useRef<{ id: string; at: number } | null>(null);
  const [incoming, setIncoming] = useState<IncomingResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [ready, setReady] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [embedWarning, setEmbedWarning] = useState(false);
  const [agentSignedIn, setAgentSignedIn] = useState(false);
  const [callState, setCallState] = useState("En attente d’appel");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const pendingPhoneRef = useRef<string | null>(null);

  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    window.dispatchEvent(new CustomEvent("gando:allo-panel-toggled", { detail: { open: next } }));
  }, []);

  const sendDial = useCallback((phone: string) => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame || !readyRef.current) {
      pendingPhoneRef.current = phone;
      return false;
    }
    frame.postMessage({
      source: "allo-host",
      type: "dial",
      payload: { phone_number: phone },
    }, ALLO_ORIGIN);
    pendingPhoneRef.current = null;
    setNotice("Numéro transmis au composeur Allo. Lancez l’appel depuis le téléphone intégré.");
    return true;
  }, []);

  useEffect(() => { setMounted(true); }, []);

  const resolveIncoming = useCallback(async (payload: unknown) => {
    const incomingData = asRecord(payload);
    const callerPhone = extractIncomingPhone(payload);
    const callId = String(incomingData.call_id || incomingData.callId || incomingData.id || callerPhone || "unknown");
    const now = Date.now();
    if (incomingDedup.current?.id === callId && now - incomingDedup.current.at < 35000) return;
    incomingDedup.current = { id: callId, at: now };

    const request = ++lookupSequence.current;
    toggle(true);
    if (!callerPhone) {
      setIncoming({ state: "masked", phone: null, contacts: [], message: "L'appelant n'a pas transmis de numéro exploitable." });
      return;
    }
    setIncoming({ state: "loading", phone: callerPhone, contacts: [] });
    try {
      const response = await fetch("/api/withallo/caller?phone=" + encodeURIComponent(callerPhone), {
        cache: "no-store", credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (request !== lookupSequence.current) return;
      if (!response.ok) throw new Error(data.error || "Le CRM n'a pas pu identifier ce numéro.");
      const matches: ContactMatch[] = Array.isArray(data.contacts) ? data.contacts : [];
      if (data.result === "match" && matches.length === 1 && /^\/contacts\/\d+$/.test(matches[0].href)) {
        setIncoming({ state: "match", phone: callerPhone, contacts: matches, message: "Fiche contact ouverte automatiquement." });
        router.push(matches[0].href);
      } else if (data.result === "multiple" && matches.length) {
        setIncoming({ state: "multiple", phone: callerPhone, contacts: matches, message: "Plusieurs contacts correspondent à ce numéro. Choisissez la bonne fiche." });
      } else {
        setIncoming({ state: "unknown", phone: callerPhone, contacts: [], message: "Aucun contact unique trouvé dans HubSpot pour ce numéro." });
      }
    } catch (error) {
      if (request === lookupSequence.current) setIncoming({
        state: "error", phone: callerPhone, contacts: [],
        message: error instanceof Error ? error.message : "Impossible de retrouver l'appelant dans HubSpot.",
      });
    }
  }, [router, toggle]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string }>).detail;
      const rawPhone = detail?.phone || "";
      const normalized = normalizeWithAlloDialNumber(rawPhone);
      setNumber(rawPhone);
      setNotice("");
      setCopied(false);
      if (rawPhone && !normalized) {
        setNotice("Vérifiez le numéro avant de composer. Les formats français et internationaux sont acceptés.");
        pendingPhoneRef.current = null;
      } else if (normalized) {
        sendDial(normalized);
      } else {
        pendingPhoneRef.current = null;
      }
      toggle(true);
    };
    window.addEventListener("gando:open-dialer", onOpen);
    return () => window.removeEventListener("gando:open-dialer", onOpen);
  }, [sendDial, toggle, resolveIncoming]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== ALLO_ORIGIN || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as DialerEvent | null;
      if (!data || typeof data !== "object" || data.source !== "allo-dialer") return;
      if (data.type === "ready") {
        readyRef.current = true;
        setReady(true);
        setEmbedWarning(false);
        const pending = pendingPhoneRef.current;
        if (pending) sendDial(pending);
      } else if (data.type === "login") {
        setAgentSignedIn(true);
      } else if (data.type === "incoming_call") {
        setCallState("Appel entrant");
        void resolveIncoming(data.payload);
      } else if (data.type === "outgoing_call") {
        setCallState("Appel sortant en cours");
      } else if (data.type === "call_answered") {
        setCallState("Conversation en cours");
      } else if (data.type === "call_ended") {
        lookupSequence.current += 1;
        setCallState("Appel terminé");
        window.dispatchEvent(new Event("gando:withallo-call-ended"));
        window.dispatchEvent(new Event("gando:withallo-updated"));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendDial, toggle]);

  useEffect(() => {
    if (!frameLoaded || ready) return;
    const timeout = window.setTimeout(() => setEmbedWarning(true), 9000);
    return () => window.clearTimeout(timeout);
  }, [frameLoaded, ready]);

  const normalized = normalizeWithAlloDialNumber(number);

  const prefill = () => {
    if (!normalized) {
      setNotice("Numéro incorrect : utilisez un 06/07 français ou un format international tel que +590…");
      return;
    }
    if (!sendDial(normalized)) setNotice("Numéro prêt. Le téléphone Allo attend de terminer son chargement ou sa connexion.");
  };

  const copy = async () => {
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      setNotice("Numéro copié. Vous pouvez le coller dans Allo.");
    } catch {
      setNotice("La copie est bloquée par le navigateur. Sélectionnez le numéro pour le copier.");
    }
  };

  if (!mounted) return null;
  return createPortal(
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => toggle(true)}
          className="fixed bottom-6 right-6 z-[1001] grid h-12 w-12 place-items-center rounded-full border border-border bg-card shadow-lg transition hover:-translate-y-0.5 hover:bg-muted"
          aria-label="Ouvrir le téléphone Allo"
          title="Téléphone Allo intégré"
        >
          <Phone className="h-5 w-5" />
        </button>
      ) : null}
      <section
        role="dialog"
        aria-label="Téléphone Allo intégré au Cockpit Gando"
        aria-hidden={!open}
        className={
          "fixed bottom-3 right-3 z-[1002] flex w-[min(420px,calc(100vw-24px))] max-h-[96dvh] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-[transform,opacity] duration-200 " +
          (open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+40px)] opacity-0")
        }
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Allo <span className="text-xs font-normal text-muted-foreground">dans Gando</span></div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {ready ? (agentSignedIn ? "Téléphone chargé · utilisateur connecté" : "Téléphone chargé · connexion Allo possible") : "Chargement du téléphone…"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" title="Réinitialiser le téléphone" aria-label="Recharger le téléphone Allo" onClick={() => {
              readyRef.current = false;
              setReady(false);
              setFrameLoaded(false);
              setEmbedWarning(false);
              if (iframeRef.current) iframeRef.current.src = ALLO_EMBED_URL;
            }} className="rounded-lg p-2 hover:bg-muted"><RefreshCw size={15}/></button>
            <button type="button" title="Réduire" aria-label="Réduire le téléphone Allo" onClick={() => toggle(false)} className="rounded-lg p-2 hover:bg-muted"><Minimize2 size={16}/></button>
            <button type="button" title="Fermer" aria-label="Fermer le panneau Allo" onClick={() => toggle(false)} className="rounded-lg p-2 hover:bg-muted"><X size={16}/></button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <input
            aria-label="Numéro de téléphone à appeler"
            value={number}
            onChange={event => { setNumber(event.target.value); pendingPhoneRef.current = null; setCopied(false); }}
            onKeyDown={event => { if (event.key === "Enter") prefill(); }}
            placeholder="06 12 34 56 78 ou +590…"
            inputMode="tel"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="button" onClick={prefill} disabled={!normalized} title="Préremplir dans Allo" className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"><PhoneCall size={14}/> Composer</button>
          <button type="button" onClick={() => void copy()} disabled={!normalized} title="Copier le numéro" aria-label="Copier le numéro" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40">{copied ? <Check size={14}/> : <Copy size={14}/>}</button>
        </div>
        {incoming ? (
          <div role="status" className="shrink-0 border-b border-primary/20 bg-primary/[0.045] px-3 py-3 text-xs leading-5">
            <div className="flex items-center justify-between gap-2">
              <strong>Appel entrant {incoming.phone ? "· " + incoming.phone : "· Numéro masqué"}</strong>
              <button type="button" className="rounded-md p-1 hover:bg-muted" title="Masquer la fiche de l’appelant" onClick={() => setIncoming(null)}><X size={13}/></button>
            </div>
            <p className="mt-1 text-muted-foreground">{incoming.state === "loading" ? "Recherche dans les contacts HubSpot…" : incoming.message}</p>
            {incoming.state === "match" && incoming.contacts[0] ? (
              <Link href={incoming.contacts[0].href} className="mt-2 inline-flex font-semibold text-primary hover:underline">{incoming.contacts[0].name} · Voir la fiche</Link>
            ) : null}
            {incoming.state === "multiple" ? <div className="mt-2 space-y-1">
              {incoming.contacts.map(item => (
                <Link key={item.id} href={item.href} onClick={() => setIncoming(null)} className="block rounded-lg border border-border bg-background px-3 py-2 hover:bg-muted">
                  <span className="font-semibold">{item.name}</span>{item.company ? <span className="ml-2 text-muted-foreground">{item.company}</span> : null}
                </Link>
              ))}
            </div> : null}
            {incoming.state === "unknown" || incoming.state === "masked" || incoming.state === "error" ? (
              <Link href="/contacts" className="mt-2 inline-flex font-semibold text-primary hover:underline">Consulter les contacts CRM</Link>
            ) : null}
          </div>
        ) : null}
        {notice ? <p role="status" className="border-b border-border bg-muted/30 px-3 py-2 text-xs leading-4">{notice}</p> : null}
        <div className="relative min-h-0 flex-1 overflow-y-auto bg-muted/20">
          <div className="mx-auto h-[640px] w-[376px] max-w-full overflow-hidden">
            <iframe
              ref={iframeRef}
              title="Composeur officiel Allo"
              src={ALLO_EMBED_URL}
              allow="microphone; autoplay"
              loading="eager"
              onLoad={() => setFrameLoaded(true)}
              onError={() => setEmbedWarning(true)}
              className="h-[640px] w-full border-0 bg-background"
            />
          </div>
        </div>
        <div className="shrink-0 border-t border-border px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-muted-foreground"><span className={"h-2 w-2 rounded-full " + (ready ? "bg-emerald-500" : "bg-amber-500")} /> {callState}</span>
            <a href={ALLO_ORIGIN} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Ouvrir Allo <ExternalLink size={11}/></a>
          </div>
          {embedWarning && !ready ? (
            <p role="alert" className="mt-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
              Le téléphone intégré ne répond pas. Allo doit autoriser <strong>room.gando.pro</strong> pour l’intégration embarquée.
              Consultez <a href={ALLO_EMBED_HELP} target="_blank" rel="noopener noreferrer" className="underline">leur procédure officielle</a> ou ouvrez Allo dans un nouvel onglet.
            </p>
          ) : null}
        </div>
      </section>
    </>,
    document.body
  );
}
