"use client";
import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Check, Clock, Loader2, Mail, Phone, PhoneCall, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, initials } from "@/lib/utils";

type Contact = { id: string; properties: Record<string, string | null | undefined> };

type Props = {
  segmentId: string;
  owner: string;
  owners: Record<string, string>;
  onOpenContact: (id: string) => void;
  onError: (message: string) => void;
  onUpdated: () => void;
};

type Outcome = { label: string; advance: string | null; tone: string };

const OUTCOMES: Outcome[] = [
  { label: "Intéressé", advance: "Conversation", tone: "emerald" },
  { label: "Intéressé mais", advance: "Conversation", tone: "emerald" },
  { label: "A Rappeler", advance: null, tone: "amber" },
  { label: "NRP", advance: null, tone: "slate" },
  { label: "Occupé", advance: null, tone: "slate" },
  { label: "pas intéressé", advance: null, tone: "rose" },
  { label: "HORS CIBLE", advance: "Non qualifié", tone: "rose" },
  { label: "Numéro invalide", advance: "Non qualifié", tone: "rose" },
];

const STATUS_PRIORITY: Record<string, number> = { "À prospecter": 1, "En prospection": 2, "Conversation": 3 };

const TERMINAL_CALL = ["pas intéressé", "HORS CIBLE", "Numéro invalide", "Intéressé", "Intéressé mais", "En attente décision", "A une date ultérieure"];
const TERMINAL_PROSPECTION = ["Non qualifié", "Perdu", "À recycler"];

const PRIORITY_META: Record<number, { label: string; badge: string }> = {
  0: { label: "A rappeler", badge: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  1: { label: "À prospecter", badge: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  2: { label: "En prospection", badge: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  3: { label: "Conversation", badge: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
};

const TONE_CLASSES: Record<string, string> = {
  emerald: "border-emerald-400/30 bg-emerald-400/5 text-emerald-200 hover:border-emerald-400/60 hover:bg-emerald-400/15",
  amber: "border-amber-400/30 bg-amber-400/5 text-amber-200 hover:border-amber-400/60 hover:bg-amber-400/15",
  slate: "border-white/15 bg-white/5 text-slate-300 hover:border-white/40 hover:bg-white/10",
  rose: "border-rose-400/30 bg-rose-400/5 text-rose-200 hover:border-rose-400/60 hover:bg-rose-400/15",
};

function toMs(value?: string | null) {
  if (!value) return NaN;
  const s = String(value).trim();
  const n = Number(s);
  const t = s.length >= 12 && Number.isFinite(n) ? n : NaN;
  const d = Number.isNaN(t) ? new Date(s).getTime() : t;
  return Number.isFinite(d) ? d : NaN;
}

export function ProspectionTasks({ segmentId, owner, owners, onOpenContact, onError, onUpdated }: Props) {
  const [candidates, setCandidates] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      let rows: Contact[] = [];
      if (segmentId) {
        const r = await fetch(`/api/segments/${segmentId}/members?objectTypeId=0-1`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Impossible de charger le segment");
        rows = d.results || [];
      } else {
        const p = new URLSearchParams();
        if (owner) p.set("owner", owner);
        const r = await fetch(`/api/tasks?${p}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Impossible de charger les tâches");
        rows = d.results || [];
      }
      setCandidates(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [segmentId, owner]);

  const queue = useMemo(() => {
    const scoped = candidates.filter(c => {
      const p = c.properties;
      const hasPhone = Boolean(p.phone || p.mobilephone);
      if (!hasPhone) return false;
      if (owner && p.hubspot_owner_id !== owner) return false;
      const call = (p.statut_de_lappel || "").trim();
      const prosp = (p.statut_prospection || "").trim();
      if (TERMINAL_CALL.includes(call)) return false;
      if (TERMINAL_PROSPECTION.includes(prosp)) return false;
      return true;
    });
    return scoped
      .map(c => {
        const p = c.properties;
        const call = (p.statut_de_lappel || "").trim();
        const prosp = (p.statut_prospection || "").trim();
        const prio = call === "A Rappeler" ? 0 : (STATUS_PRIORITY[prosp] ?? 3);
        const last = toMs(p.hs_last_sales_activity_timestamp) || toMs(p.createdate) || 0;
        return { c, prio, last };
      })
      .sort((a, b) => a.prio - b.prio || a.last - b.last);
  }, [candidates, owner]);

  async function setOutcome(c: Contact, outcome: Outcome) {
    const key = `${c.id}:${outcome.label}`;
    setSavingKey(key);
    try {
      const properties: Record<string, string> = { statut_de_lappel: outcome.label };
      if (outcome.advance) properties.statut_prospection = outcome.advance;
      const r = await fetch(`/api/contacts/${c.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "HubSpot a rejeté ce statut");
      }
      setCandidates(prev => prev.map(x => x.id === c.id ? { ...x, properties: { ...x.properties, statut_de_lappel: outcome.label, ...(outcome.advance ? { statut_prospection: outcome.advance } : {}) } } : x));
      onUpdated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Impossible d'enregistrer le résultat");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300"><PhoneCall size={15} /></span>
          <div className="leading-tight">
            <div className="font-semibold text-foreground">Calls à faire</div>
            <div className="text-xs text-muted-foreground">File priorisée pour le setter</div>
          </div>
          <Badge variant="outline" className="ml-2 border-violet-400/30 bg-violet-400/10 font-semibold text-violet-200">{queue.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh
        </Button>
      </div>

      {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <div className="min-h-0 flex-1 overflow-auto p-4 minari-scrollbar">
        {loading ? <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-violet-300" /></div>
          : queue.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-muted-foreground">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-300"><Check size={22} /></div>
              <p className="text-sm">Aucun appel à passer pour le moment.</p>
              <p className="max-w-sm text-center text-xs">Dès qu'un contact passe en « À prospecter », « A Rappeler » ou « En prospection », il apparaît ici dans l'ordre de priorité.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-2.5">
              {queue.map(({ c, prio }) => {
                const p = c.properties;
                const full = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Sans nom";
                const meta = PRIORITY_META[prio];
                const primaryPhone = p.phone || p.mobilephone || "";
                const secondaryPhone = p.mobilephone && p.mobilephone !== p.phone ? p.mobilephone : "";
                const ownerName = p.hubspot_owner_id ? owners[p.hubspot_owner_id] || "" : "";
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-violet-400/25">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0 rounded-xl border border-violet-400/25 bg-accent">
                          <AvatarFallback className="rounded-xl bg-accent text-sm font-bold text-violet-300">{initials(p.firstname, p.lastname)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => onOpenContact(c.id)} className="truncate text-left text-sm font-semibold text-foreground hover:text-violet-300 hover:underline">{full}</button>
                            <Badge variant="outline" className={`text-[10px] font-semibold ${meta.badge}`}>{meta.label}</Badge>
                            <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] font-medium text-slate-300">{p.statut_prospection || "À prospecter"}</Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {p.company ? <span className="flex items-center gap-1.5"><Building2 size={12} className="text-violet-300/80" /> {p.company}</span> : null}
                            {p.jobtitle ? <span className="flex items-center gap-1.5"><UserRound size={12} className="text-violet-300/80" /> {p.jobtitle}</span> : null}
                            <span className="flex items-center gap-1.5"><Clock size={12} className="text-violet-300/80" /> Dernier appel {formatDate(p.hs_last_sales_activity_timestamp)}</span>
                            {p.hubspot_owner_id && ownerName ? <span className="flex items-center gap-1.5"><UserRound size={12} className="text-violet-300/80" /> {ownerName}</span> : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button asChild size="sm" className="h-9 gap-1.5 px-3">
                          <a href={`tel:${primaryPhone}`}><Phone size={14} /> {primaryPhone || "Sans numéro"}</a>
                        </Button>
                        {secondaryPhone ? <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 px-3">
                          <a href={`tel:${secondaryPhone}`}><Phone size={14} /> {secondaryPhone}</a>
                        </Button> : null}
                        {p.email ? <Button asChild size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground">
                          <a href={`mailto:${p.email}`}><Mail size={15} /></a>
                        </Button> : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Résultat de l'appel</span>
                      {OUTCOMES.map(o => {
                        const active = savingKey === `${c.id}:${o.label}`;
                        return (
                          <Button key={o.label} size="sm" disabled={savingKey !== null} onClick={() => setOutcome(c, o)}
                            className={`h-8 gap-1 rounded-lg border px-2.5 text-xs font-medium ${TONE_CLASSES[o.tone]}`}>
                            {active ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {o.label}
                          </Button>
                        );
                      })}
                      <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-muted-foreground" onClick={() => onOpenContact(c.id)}>
                        <CalendarClock size={13} /> Fiche
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
