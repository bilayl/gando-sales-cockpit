"use client";

import { ChevronDown, ChevronUp, Loader2, MailCheck, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POST_CALL_EMAIL_LABELS } from "@/lib/post-call-email-types";

type SentEmail = {
  id: string;
  provider: string;
  provider_message_id?: string | null;
  contact_id?: string | null;
  call_id?: string | null;
  email_kind?: keyof typeof POST_CALL_EMAIL_LABELS | null;
  recipient: string;
  subject: string;
  body: string;
  sent_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function providerLabel(provider: string) {
  if (provider === "smtp2go") return "Envoyé via SMTP2GO";
  if (provider === "gmail") return "Envoyé via Gmail API";
  return provider;
}

function providerIdLabel(provider: string) {
  if (provider === "smtp2go") return "ID SMTP2GO";
  if (provider === "gmail") return "ID Gmail";
  return "ID fournisseur";
}

export function SentEmailsView() {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/emails/sent?limit=250", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de charger les emails envoyés");
      setEmails(payload.emails || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les emails envoyés");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return emails;
    return emails.filter(email =>
      [email.recipient, email.subject, email.body, email.email_kind || ""]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [emails, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><MailCheck size={16} /> Suivi commercial</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Emails envoyés</h1>
          <p className="mt-1 text-sm text-muted-foreground">Historique des emails réellement envoyés depuis le backend du Sales Cockpit.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Actualiser
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un destinataire, un objet ou un contenu…" className="pl-9" />
          </div>
          <div className="text-sm font-semibold text-muted-foreground">{filtered.length} email{filtered.length > 1 ? "s" : ""}</div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}
      {!error && loading && emails.length === 0 ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-primary" /></div> : null}
      {!error && !loading && filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Aucun email envoyé ne correspond à cette recherche.</div> : null}

      <div className="space-y-2">
        {filtered.map(email => {
          const isOpen = expanded === email.id;
          const kindLabel = email.email_kind && email.email_kind in POST_CALL_EMAIL_LABELS
            ? POST_CALL_EMAIL_LABELS[email.email_kind]
            : "Email";
          return (
            <div key={email.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setExpanded(current => current === email.id ? null : email.id)}
                className="flex w-full items-start gap-4 px-4 py-4 text-left transition hover:bg-muted/50"
              >
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><MailCheck size={17} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold">{email.subject}</span>
                    <Badge variant="outline" className="text-[10px]">{kindLabel}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>À : {email.recipient}</span>
                    <span>{formatDate(email.sent_at)}</span>
                    <span>{providerLabel(email.provider)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-muted-foreground">{isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</div>
              </button>

              {isOpen ? (
                <div className="border-t border-border bg-background/60 px-4 py-4 sm:px-6">
                  <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{email.body}</div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {email.provider_message_id ? <span>{providerIdLabel(email.provider)} : {email.provider_message_id}</span> : null}
                    {email.contact_id ? <span>Contact HubSpot : {email.contact_id}</span> : null}
                    {email.call_id ? <span>Appel : {email.call_id}</span> : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
