"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Phone, PhoneCall, X } from "lucide-react";

type AircallLine = { id: number; name: string; digits?: string | null };
type Workspace = {
  on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
  send: (event: string, payload: Record<string, string>, callback?: (success: boolean, data?: { code?: string; message?: string }) => void) => void;
};
function normalizedPhone(source: string) {
  const value = source.replace(/[\s().-]/g, "");
  return value.startsWith("00") ? `+${value.slice(2)}` : value;
}
const isValidPhone = (source: string) => /^\+[1-9]\d{7,14}$/.test(normalizedPhone(source));

export function GlobalPhoneDialer() {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<AircallLine[]>([]);
  const [numberId, setNumberId] = useState("");
  const [configured, setConfigured] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [ready, setReady] = useState(false);
  const [sdkError, setSdkError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const workspaceRef = useRef<Workspace | null>(null);
  const sdkStartedRef = useRef(false);
  const previousDialRef = useRef("");

  useEffect(() => {
    const openFromCRM = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string }>).detail;
      setNumber(detail?.phone || "");
      setOpen(true);
      setError("");
      setMessage("");
      previousDialRef.current = "";
    };
    window.addEventListener("gando:open-dialer", openFromCRM);
    return () => window.removeEventListener("gando:open-dialer", openFromCRM);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/aircall/me", { cache: "no-store" }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Profil Aircall inaccessible");
      if (cancelled) return;
      setConfigured(Boolean(data.connected));
      setLines(Array.isArray(data.numbers) ? data.numbers : []);
      setAgentName(data.user?.name || data.user?.email || "");
      if (data.numbers?.length === 1) setNumberId(String(data.numbers[0].id));
      if (!data.connected) setError(data.error || "Connectez Aircall dans les paramètres du Cockpit.");
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Aircall indisponible"); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || sdkStartedRef.current) return;
    sdkStartedRef.current = true;
    let cancelled = false;
    void import("aircall-everywhere").then(module => {
      if (cancelled) { sdkStartedRef.current = false; return; }
      const AircallWorkspace = module.default;
      const workspace: Workspace = new AircallWorkspace({
        domToLoadWorkspace: "#gando-aircall-workspace",
        size: "big",
        debug: false,
        onLogin: () => setReady(true),
        onLogout: () => setReady(false),
      });
      workspace.on("call_ended", () => {
        window.dispatchEvent(new Event("gando:aircall-updated"));
      });
      workspaceRef.current = workspace;
    }).catch(() => {
      sdkStartedRef.current = false;
      setSdkError("Impossible de charger le téléphone intégré Aircall. Le démarrage par API reste disponible.");
    });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    const normalized = normalizedPhone(number);
    if (!open || !ready || !isValidPhone(number) || previousDialRef.current === normalized || !workspaceRef.current) return;
    previousDialRef.current = normalized;
    workspaceRef.current.send("dial_number", { phone_number: normalized }, (success, data) => {
      if (!success) setSdkError(data?.message || "Le numéro n’a pas été prérempli dans Aircall.");
    });
  }, [number, open, ready]);

  async function startCall() {
    if (!isValidPhone(number)) { setError("Indiquez un numéro international (+33, +590, etc.)."); return; }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/aircall/dial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: normalizedPhone(number), numberId: numberId || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Appel non démarré.");
      setMessage("Aircall a accepté la demande d’appel. Suivez la conversation dans Workspace.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de démarrer l’appel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-[55] grid h-12 w-12 place-items-center rounded-full border border-border bg-card shadow-lg transition hover:-translate-y-0.5 hover:bg-muted" aria-label="Ouvrir le téléphone Aircall" title="Aircall">
        <Phone className="h-5 w-5" />
      </button>
      <div className={open ? "fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm" : "hidden"} role="dialog" aria-modal={open} aria-label="Téléphonie Aircall">
        <div className="flex max-h-[96svh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl lg:flex-row">
          <div className="w-full shrink-0 border-b border-border p-5 lg:w-[450px] lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div><div className="text-lg font-semibold">Appeler avec Aircall</div><div className="mt-1 text-xs text-muted-foreground">{agentName || "Téléphonie connectée au CRM Gando"}</div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X size={18} /></button>
            </div>
            <label htmlFor="gando-aircall-number" className="text-xs font-semibold">Numéro du contact</label>
            <input id="gando-aircall-number" value={number} onChange={event => { setNumber(event.target.value); setError(""); setMessage(""); }} placeholder="+33612345678" inputMode="tel" className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-lg outline-none focus:ring-2 focus:ring-ring" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Format international requis : +33 pour la métropole, +590 pour la Guadeloupe.</p>

            <label htmlFor="gando-aircall-line" className="mt-5 block text-xs font-semibold">Ligne sortante</label>
            <select id="gando-aircall-line" value={numberId} onChange={event => setNumberId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" disabled={!lines.length}>
              <option value="">{lines.length ? "Choisir une ligne" : "Aucune ligne Aircall disponible"}</option>
              {lines.map(line => <option key={line.id} value={line.id}>{line.name}{line.digits ? ` · ${line.digits}` : ""}</option>)}
            </select>
            <button type="button" onClick={() => void startCall()} disabled={!configured || loading || !isValidPhone(number) || (lines.length > 1 && !numberId)} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <PhoneCall size={16} />} Appeler maintenant via l’API
            </button>
            {message ? <p className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-xs">{message}</p> : null}
            {error ? <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}
            <p className="mt-5 text-xs leading-5 text-muted-foreground">Le téléphone intégré permet aussi de composer depuis Aircall Workspace. Les appels terminés sont ajoutés à l’historique via le webhook.</p>
            <a href="https://workspace.aircall.io/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">Ouvrir Aircall Workspace <ExternalLink size={12} /></a>
            {sdkError ? <p className="mt-2 text-xs text-muted-foreground">{sdkError}</p> : null}
          </div>
          <div className="mx-auto min-h-0 w-full overflow-auto bg-muted/30 p-3 lg:w-[420px]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Aircall Workspace intégré {ready ? "· connecté" : "· connexion requise"}</div>
            <div id="gando-aircall-workspace" className="mx-auto min-h-[666px] w-[376px] max-w-full overflow-hidden rounded-xl bg-background shadow-sm" />
          </div>
        </div>
      </div>
    </>
  );
}
