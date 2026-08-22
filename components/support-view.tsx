"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock3, LifeBuoy, Mail, MessageSquareReply, Plus, RefreshCw, Search, Send, ShoppingBag, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type TicketType = "support" | "commercial";
type TicketStatus = "open" | "waiting_customer" | "resolved";

type Ticket = {
  id: string;
  reference: string;
  type: TicketType;
  status: TicketStatus;
  source: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  company_domain: string | null;
  subject: string;
  message_preview: string | null;
  hubspot_company_id: string | null;
  hubspot_contact_id: string | null;
  dispatch_status: "not_applicable" | "pending" | "synced" | "failed";
  dispatch_error: string | null;
  acknowledged_at: string | null;
  last_reply_at: string | null;
  created_at: string;
  updated_at: string;
};

type TicketMessage = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  channel: string;
  sender_name: string | null;
  sender_email: string | null;
  body: string;
  created_by_email: string | null;
  created_at: string;
};

type TicketDetail = { ticket: Ticket; messages: TicketMessage[] };

type NewTicketForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  companyDomain: string;
  subject: string;
  message: string;
};

const emptyForm: NewTicketForm = { firstName: "", lastName: "", email: "", phone: "", companyName: "", companyDomain: "", subject: "", message: "" };

function statusLabel(status: TicketStatus) {
  if (status === "resolved") return "Résolu";
  if (status === "waiting_customer") return "En attente client";
  return "Ouvert";
}

function statusClass(status: TicketStatus) {
  if (status === "resolved") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "waiting_customer") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "bg-primary/10 text-primary";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function fullName(ticket: Ticket) {
  return [ticket.first_name, ticket.last_name].filter(Boolean).join(" ") || ticket.email || "Demandeur";
}

export function SupportView() {
  const [type, setType] = useState<TicketType>("support");
  const [status, setStatus] = useState<"all" | TicketStatus>("all");
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<NewTicketForm>(emptyForm);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (status !== "all") params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/support/tickets?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de charger les tickets");
      const next = (data.tickets || []) as Ticket[];
      setTickets(next);
      setSelectedId(current => current && next.some(item => item.id === current) ? current : next[0]?.id || null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les tickets");
    } finally {
      setLoading(false);
    }
  }, [query, status, type]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de charger le ticket");
      setDetail(data as TicketDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger le ticket");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTickets(); }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets, query]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [loadDetail, selectedId]);

  const counters = useMemo(() => ({
    open: tickets.filter(item => item.status === "open").length,
    waiting: tickets.filter(item => item.status === "waiting_customer").length,
    resolved: tickets.filter(item => item.status === "resolved").length,
  }), [tickets]);

  async function createTicket() {
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, type }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de créer le ticket");
      setShowNew(false);
      setForm(emptyForm);
      await loadTickets();
      if (data.ticket?.id) setSelectedId(data.ticket.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de créer le ticket");
    } finally {
      setSending(false);
    }
  }

  async function sendReply() {
    if (!detail?.ticket.id || !reply.trim()) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(detail.ticket.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible d’envoyer la réponse");
      setDetail(data as TicketDetail);
      setReply("");
      await loadTickets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d’envoyer la réponse");
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(nextStatus: TicketStatus) {
    if (!detail?.ticket.id) return;
    setSending(true);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(detail.ticket.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de changer le statut");
      await Promise.all([loadTickets(), loadDetail(detail.ticket.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de changer le statut");
    } finally {
      setSending(false);
    }
  }

  const sectionTitle = type === "commercial" ? "Demandes commerciales" : "Support client";
  const sectionDescription = type === "commercial"
    ? "Les demandes commerciales sont transformées en prospects HubSpot avec entreprise + contact associés dès que les informations sont disponibles."
    : "Centralisez les demandes, répondez par email et conservez tout l’historique du ticket dans le Sales Cockpit.";

  return <div className="min-h-full bg-background p-5 lg:p-7">
    <div className="mx-auto max-w-[1540px] space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-primary"><LifeBuoy className="h-4 w-4" /> Support</div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">Support & demandes</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Deux files séparées, un historique email unique et un dispatch automatique des opportunités commerciales vers la prospection.</p>
        </div>
        <button type="button" onClick={() => setShowNew(value => !value)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"><Plus className="h-4 w-4" /> Nouveau ticket</button>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-1.5 sm:w-fit">
        <button type="button" onClick={() => { setType("support"); setSelectedId(null); }} className={cn("flex min-w-[170px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors", type === "support" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><LifeBuoy className="h-4 w-4" /> Support</button>
        <button type="button" onClick={() => { setType("commercial"); setSelectedId(null); }} className={cn("flex min-w-[170px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors", type === "commercial" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><ShoppingBag className="h-4 w-4" /> Commercial</button>
      </div>

      {showNew ? <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-base font-bold">Créer un ticket {type === "commercial" ? "commercial" : "support"}</h2><p className="mt-1 text-xs text-muted-foreground">Un accusé de réception personnalisé est envoyé par email avec la référence du ticket et un délai de réponse annoncé de 48 h.</p></div><button type="button" onClick={() => setShowNew(false)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Fermer</button></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Prénom" value={form.firstName} onChange={value => setForm(current => ({ ...current, firstName: value }))} />
          <Field label="Nom" value={form.lastName} onChange={value => setForm(current => ({ ...current, lastName: value }))} />
          <Field label="Email" type="email" value={form.email} onChange={value => setForm(current => ({ ...current, email: value }))} />
          <Field label="Téléphone" value={form.phone} onChange={value => setForm(current => ({ ...current, phone: value }))} />
          <Field label="Entreprise" value={form.companyName} onChange={value => setForm(current => ({ ...current, companyName: value }))} />
          <Field label="Domaine" placeholder="entreprise.fr" value={form.companyDomain} onChange={value => setForm(current => ({ ...current, companyDomain: value }))} />
          <div className="md:col-span-2"><Field label="Objet" value={form.subject} onChange={value => setForm(current => ({ ...current, subject: value }))} /></div>
          <label className="md:col-span-2 xl:col-span-4"><span className="mb-1.5 block text-xs font-bold text-foreground">Demande</span><textarea value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} rows={4} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring" placeholder="Décrivez la demande…" /></label>
        </div>
        <div className="mt-4 flex justify-end"><button type="button" disabled={sending || !form.message.trim()} onClick={() => void createTicket()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /> Créer + envoyer l’accusé</button></div>
      </section> : null}

      {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-3">
        <Metric icon={LifeBuoy} label="Ouverts" value={counters.open} />
        <Metric icon={Clock3} label="En attente client" value={counters.waiting} />
        <Metric icon={CheckCircle2} label="Résolus" value={counters.resolved} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-base font-bold">{sectionTitle}</h2><p className="mt-1 max-w-4xl text-xs text-muted-foreground">{sectionDescription}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher…" className="h-9 w-56 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
              <select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-semibold"><option value="all">Tous les statuts</option><option value="open">Ouverts</option><option value="waiting_customer">En attente client</option><option value="resolved">Résolus</option></select>
              <button type="button" onClick={() => void loadTickets()} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
            </div>
          </div>
        </div>

        <div className="grid min-h-[620px] lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="border-b border-border lg:border-b-0 lg:border-r">
            {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Chargement des tickets…</div> : tickets.length ? <div className="divide-y divide-border">{tickets.map(ticket => <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} className={cn("w-full p-4 text-left transition-colors hover:bg-muted/60", selectedId === ticket.id && "bg-muted")}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold text-foreground">{ticket.subject}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="font-bold text-primary">{ticket.reference}</span><span>·</span><span>{formatDate(ticket.updated_at)}</span></div></div><span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-bold", statusClass(ticket.status))}>{statusLabel(ticket.status)}</span></div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><UserRound className="h-3.5 w-3.5" /><span className="truncate">{fullName(ticket)}</span>{ticket.company_name ? <><span>·</span><Building2 className="h-3.5 w-3.5" /><span className="truncate">{ticket.company_name}</span></> : null}</div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{ticket.message_preview}</p>
              {ticket.type === "commercial" ? <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Prospection : {ticket.dispatch_status === "synced" ? "synchronisée" : ticket.dispatch_status === "failed" ? "erreur" : "en cours"}</div> : null}
            </button>)}</div> : <div className="p-10 text-center"><LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground/50" /><div className="mt-3 text-sm font-bold">Aucun ticket</div><div className="mt-1 text-xs text-muted-foreground">Les nouvelles demandes apparaîtront ici.</div></div>}
          </div>

          <div className="min-w-0 bg-background/40">
            {detailLoading ? <div className="p-10 text-sm text-muted-foreground">Chargement du ticket…</div> : detail ? <TicketPanel detail={detail} reply={reply} setReply={setReply} sending={sending} onSend={() => void sendReply()} onStatus={value => void changeStatus(value)} /> : <div className="grid h-full min-h-[500px] place-items-center p-8 text-center"><div><MessageSquareReply className="mx-auto h-10 w-10 text-muted-foreground/40" /><div className="mt-3 text-sm font-bold">Sélectionnez un ticket</div><div className="mt-1 text-xs text-muted-foreground">La conversation et les actions apparaîtront ici.</div></div></div>}
          </div>
        </div>
      </section>
    </div>
  </div>;
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label><span className="mb-1.5 block text-xs font-bold text-foreground">{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof LifeBuoy; label: string; value: number }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div><div className="text-xl font-bold leading-none">{value}</div><div className="mt-1 text-xs font-semibold text-muted-foreground">{label}</div></div></div>;
}

function TicketPanel({ detail, reply, setReply, sending, onSend, onStatus }: { detail: TicketDetail; reply: string; setReply: (value: string) => void; sending: boolean; onSend: () => void; onStatus: (status: TicketStatus) => void }) {
  const ticket = detail.ticket;
  return <div className="flex min-h-[620px] flex-col">
    <div className="border-b border-border bg-card p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-primary">{ticket.reference}</span><span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", statusClass(ticket.status))}>{statusLabel(ticket.status)}</span>{ticket.type === "commercial" ? <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-700 dark:text-violet-300">Commercial</span> : null}</div><h3 className="mt-2 text-xl font-bold tracking-[-0.02em]">{ticket.subject}</h3><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> {fullName(ticket)}</span>{ticket.email ? <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {ticket.email}</span> : null}{ticket.company_name ? <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {ticket.company_name}</span> : null}</div></div>
        <select value={ticket.status} disabled={sending} onChange={event => onStatus(event.target.value as TicketStatus)} className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-bold"><option value="open">Ouvert</option><option value="waiting_customer">En attente client</option><option value="resolved">Résolu</option></select>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3"><Info label="Accusé reçu" value={ticket.acknowledged_at ? formatDate(ticket.acknowledged_at) : "Non envoyé"} /><Info label="Dernière réponse" value={formatDate(ticket.last_reply_at)} /><Info label="Source" value={ticket.source} /></div>
      {ticket.type === "commercial" ? <div className={cn("mt-3 rounded-lg border p-3 text-xs", ticket.dispatch_status === "failed" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/40")}><div className="font-bold">Dispatch Prospection : {ticket.dispatch_status === "synced" ? "synchronisé" : ticket.dispatch_status === "failed" ? "échec" : "en cours"}</div>{ticket.dispatch_status === "synced" ? <div className="mt-1 text-muted-foreground">Entreprise HubSpot {ticket.hubspot_company_id || "—"} · Contact {ticket.hubspot_contact_id || "—"}</div> : null}{ticket.dispatch_error ? <div className="mt-1 text-destructive">{ticket.dispatch_error}</div> : null}</div> : null}
    </div>

    <div className="flex-1 space-y-3 overflow-y-auto p-5">{detail.messages.map(message => {
      const outbound = message.direction === "outbound";
      return <div key={message.id} className={cn("flex", outbound ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] rounded-2xl border px-4 py-3", outbound ? "border-primary/20 bg-primary/10" : "border-border bg-card")}><div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"><span>{outbound ? "Gando" : message.sender_name || "Client"}</span><span>·</span><span>{message.channel}</span><span>·</span><span>{formatDate(message.created_at)}</span></div><div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{message.body}</div></div></div>;
    })}</div>

    <div className="border-t border-border bg-card p-4"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold">Répondre par email</span><span className="text-[10px] font-semibold text-muted-foreground">La référence {ticket.reference} reste dans l’objet.</span></div><textarea value={reply} onChange={event => setReply(event.target.value)} rows={4} placeholder="Écrivez votre réponse…" className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" /><div className="mt-2 flex justify-end"><button type="button" disabled={sending || !reply.trim() || !ticket.email} onClick={onSend} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Envoyer la réponse</button></div></div>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/50 px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div><div className="mt-1 truncate text-xs font-semibold text-foreground">{value}</div></div>;
}
