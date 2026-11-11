"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp, Bot, Check, ChevronDown, Clock3, Copy, ExternalLink, Loader2,
  MessageCircle, Plus, ShieldCheck, Sparkles, UserRound, X,
} from "lucide-react";

type Role = "user" | "assistant";
type Source = {
  id: string;
  title: string;
  contact: string | null;
  date: string | null;
  summary: string | null;
  url: string;
};
type Item = {
  id: string;
  role: Role;
  content: string;
  sources?: Source[];
  truncated?: boolean;
  scanned?: number;
};
type Scope = { kind: "contact" | "company"; id: string } | null;

const PROMPTS = [
  "Quels prospects devons-nous relancer après les derniers appels ?",
  "Quelles objections ont été exprimées sur le prix de Gando ?",
  "Quelles prochaines actions ont été convenues avec les loueurs ?",
  "Résume les besoins importants identifiés dans les derniers appels.",
];

function dateText(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date non précisée";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function SourceReferences({ sources, truncated }: { sources: Source[]; truncated?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button type="button" onClick={() => setOpen(current => !current)}
        className="flex items-center gap-2 text-xs font-semibold text-primary">
        <ShieldCheck size={14}/> {sources.length} appels Allo consultés
        <ChevronDown size={13} className={open ? "rotate-180" : ""}/>
      </button>
      {open ? <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {sources.map((source, index) => (
          <Link key={source.id} href={source.url}
            className="rounded-lg border border-border bg-background p-3 transition hover:border-primary/45 hover:bg-muted/30">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-primary">[{index + 1}] {source.title}</div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">{source.contact || "Appel Allo"} · {dateText(source.date)}</div>
              </div>
              <ExternalLink size={13} className="shrink-0 text-muted-foreground"/>
            </div>
            {source.summary ? <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-muted-foreground">{source.summary}</p> : null}
          </Link>
        ))}
      </div> : null}
      {truncated ? <p className="mt-2 text-[10px] text-muted-foreground">Les appels affichés ne couvrent pas nécessairement tout l'historique Allo.</p> : null}
    </div>
  );
}

export function WithAlloAiChat() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [scope, setScope] = useState<Scope>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("kind");
    const id = params.get("id");
    if ((kind === "contact" || kind === "company") && id && /^\d{1,25}$/.test(id)) {
      setScope({ kind, id });
    }
    fetch("/api/withallo/ai/chat", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Statut du chat indisponible");
        setConfigured(Boolean(payload.configured));
        setModel(String(payload.model || ""));
      })
      .catch(cause => {
        setConfigured(false);
        setStatusError(cause instanceof Error ? cause.message : "Connexion au chat impossible.");
      });
  }, []);

  useEffect(() => {
    if (!items.length && !busy) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, busy]);

  const send = useCallback(async (text?: string) => {
    const question = String(text ?? input).trim().slice(0, 1600);
    if (!question || busy || configured !== true) return;
    const userMessage: Item = {
      id: "user-" + Date.now(), role: "user", content: question,
    };
    const history = [...items, userMessage].slice(-12);
    setItems(history);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/withallo/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(item => ({ role: item.role, content: item.content })),
          scope,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "L'assistant n'a pas pu répondre.");
      setModel(String(payload.model || model));
      setItems(current => [...current, {
        id: "assistant-" + Date.now(),
        role: "assistant",
        content: String(payload.answer || "Aucune réponse."),
        sources: Array.isArray(payload.sources) ? payload.sources : [],
        truncated: Boolean(payload.truncated),
        scanned: Number(payload.scanned || 0),
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur du chat IA.");
      // Keep the user's question in the chat so they can try again.
    } finally {
      setBusy(false);
    }
  }, [input, items, busy, configured, scope, model]);

  function reset() {
    setItems([]);
    setInput("");
    setError("");
    inputRef.current?.focus();
  }
  function copy(content: string, id: string) {
    void navigator.clipboard.writeText(content).then(() => setCopied(id)).catch(() => undefined);
  }

  return (
    <div className="page-shell min-h-screen bg-background">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[1150px] flex-col px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">
              <Sparkles size={14}/> Assistant commercial
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Chat IA · Allo × Gando</h1>
            <p className="mt-1 text-xs text-muted-foreground">Posez des questions sur vos appels. L'assistant retrouve les preuves dans Allo et poursuit la conversation.</p>
          </div>
          <button type="button" onClick={reset}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold transition hover:bg-muted">
            <Plus size={14}/> Nouvelle discussion
          </button>
        </header>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 font-medium text-foreground">
              <ShieldCheck size={13}/>
              {scope ? (scope.kind === "contact" ? "Fiche contact" : "Fiche entreprise") + " #" + scope.id : "Mes appels autorisés"}
            </span>
            {scope ? <button type="button" onClick={() => { setScope(null); reset(); }}
              className="inline-flex items-center gap-1 text-primary hover:underline"><X size={12}/> Voir tous mes appels</button> : null}
            {model ? <span className="max-w-[240px] truncate">Moteur : {model}</span> : null}
          </div>
          <span>{configured === null ? "Vérification du moteur IA…" :
            configured ? "Chat IA connecté" : "Moteur IA non configuré"}</span>
        </div>

        {configured === false ? <div role="status" className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-4 text-xs leading-6">
          <strong>Le chat nécessite une connexion OpenRouter.</strong> {statusError || "La clé serveur OPENROUTER_API_KEY n'est pas disponible dans la configuration du Cockpit."}
          <p>Les transcriptions Allo seules ne constituent pas un moteur conversationnel. Le chat utilise l'IA Gando pour formuler les réponses à partir de ces données.</p>
        </div> : null}
        {error ? <div role="alert" className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <span>{error}</span><button type="button" onClick={() => setError("")}><X size={14}/></button>
        </div> : null}

        <div aria-live="polite" className="min-h-[300px] flex-1 py-6">
          {!items.length ? (
            <div className="mx-auto flex max-w-[680px] flex-col items-center justify-center py-12 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary"><Bot size={24}/></div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">Que souhaitez-vous savoir sur vos appels ?</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Analysez les échanges des loueurs, retrouvez les décisions et identifiez les prochaines relances. Posez ensuite une deuxième question : l'assistant garde le fil.
              </p>
              <div className="mt-7 grid w-full gap-2 text-left sm:grid-cols-2">
                {PROMPTS.map(prompt => <button type="button" key={prompt}
                  onClick={() => void send(prompt)} disabled={configured !== true || busy}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-xs leading-5 transition hover:border-primary/35 hover:bg-muted/40 disabled:opacity-45">
                  <span className="flex items-start gap-2"><MessageCircle size={15} className="mt-0.5 shrink-0 text-primary"/>{prompt}</span>
                </button>)}
              </div>
            </div>
          ) : <div className="mx-auto max-w-[850px] space-y-7">
            {items.map(item => (
              <div key={item.id} className={"flex gap-3 " + (item.role === "user" ? "justify-end" : "justify-start")}>
                {item.role === "assistant" ? <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles size={16}/></div> : null}
                <div className={item.role === "user"
                  ? "max-w-[83%] rounded-2xl bg-muted px-4 py-3 text-sm leading-6"
                  : "min-w-0 w-full max-w-[790px] rounded-xl border border-border/70 bg-card px-4 py-4"}>
                  {item.role === "assistant" ? <div className="mb-2 text-[11px] font-semibold text-primary">Assistant Gando · Sources Allo</div> : null}
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-7">{item.content}</div>
                  {item.role === "assistant" ? (
                    <>
                      <div className="mt-3 flex justify-end">
                        <button type="button" onClick={() => copy(item.content, item.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                          {copied === item.id ? <Check size={13}/> : <Copy size={13}/>}
                          {copied === item.id ? "Copié" : "Copier"}
                        </button>
                      </div>
                      <SourceReferences sources={item.sources || []} truncated={item.truncated}/>
                    </>
                  ) : null}
                </div>
                {item.role === "user" ? <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground"><UserRound size={15}/></div> : null}
              </div>
            ))}
            {busy ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={15} className="animate-spin"/> Lecture des appels et préparation de la réponse…</div> : null}
            <div ref={endRef}/>
          </div>}
        </div>

        <footer className="sticky bottom-2 z-10 mx-auto w-full max-w-[850px] rounded-2xl border border-border bg-card p-3 shadow-lg shadow-foreground/[0.04]">
          <div className="flex items-end gap-3">
            <textarea ref={inputRef} value={input} onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
              }}
              maxLength={1600} rows={2}
              placeholder="Demandez à l'IA ce qui a été dit, décidé ou reste à faire…"
              aria-label="Votre question à l'assistant IA Allo"
              className="max-h-32 min-h-[48px] min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
            />
            <button type="button" aria-label="Envoyer la question" onClick={() => void send()}
              disabled={!input.trim() || busy || configured !== true}
              className="mb-1 grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-35">
              {busy ? <Loader2 size={17} className="animate-spin"/> : <ArrowUp size={17}/>}
            </button>
          </div>
          <div className="mt-1 flex flex-wrap justify-between gap-2 border-t border-border/50 px-2 pt-2 text-[10px] text-muted-foreground">
            <span>Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</span>
            <span>Allo fournit les données · OpenRouter formule les réponses · Aucun envoi automatique</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
