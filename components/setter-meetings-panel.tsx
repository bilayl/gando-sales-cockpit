"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  Check,
  Clock3,
  History,
  Loader2,
  PhoneCall,
  RefreshCw,
  Search,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type QualificationStatus = "qualified" | "not_qualified" | "pending";
type CommercialResult = "qualified" | "follow_up" | "not_qualified" | "no_show";
type MeetingBucket = "to_qualify" | "upcoming" | "history";

type HubSpotObject = { id: string; properties: Record<string, string | null> };
type SetterMeeting = HubSpotObject & {
  associations: {
    contact: HubSpotObject | null;
    company: HubSpotObject | null;
    deal: HubSpotObject | null;
  };
  derived: {
    status: string;
    startAt: string | null;
    endAt: string | null;
    isBrevo: boolean;
    isGandoPresentation: boolean;
  };
  setterTracking: {
    qualificationStatus: QualificationStatus;
    qualificationReason: string;
    commercialOutcome: string | null;
    commercialResult: CommercialResult | null;
    bucket: MeetingBucket;
    nextActionAt: string | null;
    manuallyReviewed: boolean;
    reviewNote: string | null;
    updatedByEmail: string | null;
    updatedAt: string | null;
  };
};

type ApiResponse = {
  results: SetterMeeting[];
  total: number;
  metrics: {
    total: number;
    toQualify: number;
    upcoming: number;
    history: number;
    qualified: number;
    followUp: number;
    notQualified: number;
    noShow: number;
    qualificationRate: number;
  };
  error?: string;
  message?: string;
};

const EMPTY_METRICS: ApiResponse["metrics"] = {
  total: 0,
  toQualify: 0,
  upcoming: 0,
  history: 0,
  qualified: 0,
  followUp: 0,
  notQualified: 0,
  noShow: 0,
  qualificationRate: 0,
};

const VIEW_META: Record<MeetingBucket, { label: string; description: string }> = {
  to_qualify: { label: "À qualifier", description: "Rendez-vous passés sans résultat commercial. C’est la priorité." },
  upcoming: { label: "À venir", description: "Prochains rendez-vous à préparer." },
  history: { label: "Historique", description: "Rendez-vous déjà qualifiés, relancés, refusés ou no-show." },
};

function formatDate(value?: string | null) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function tomorrowAtNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function personName(object: HubSpotObject | null) {
  if (!object) return "Contact non associé";
  const p = object.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function ResultBadge({ result }: { result: CommercialResult | null }) {
  if (result === "qualified") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><Check className="mr-1 h-3 w-3" /> Qualifié</Badge>;
  if (result === "follow_up") return <Badge variant="outline" className="border-primary/25 bg-primary/[0.06] text-primary"><CalendarClock className="mr-1 h-3 w-3" /> À relancer</Badge>;
  if (result === "no_show") return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><PhoneCall className="mr-1 h-3 w-3" /> No show</Badge>;
  if (result === "not_qualified") return <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700"><X className="mr-1 h-3 w-3" /> Non qualifié</Badge>;
  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><Clock3 className="mr-1 h-3 w-3" /> À qualifier</Badge>;
}

function ViewButton({ label, value, active, icon: Icon, onClick }: {
  label: string;
  value: number;
  active: boolean;
  icon: typeof Clock3;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[145px] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
        active ? "border-primary/30 bg-primary/[0.06] text-primary" : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" />{label}</span>
      <span className={cn("rounded-md bg-muted px-2 py-0.5 text-xs font-bold", active && "bg-primary/10")}>{value}</span>
    </button>
  );
}

export function SetterMeetingsPanel() {
  const [meetings, setMeetings] = useState<SetterMeeting[]>([]);
  const [metrics, setMetrics] = useState<ApiResponse["metrics"]>(EMPTY_METRICS);
  const [view, setView] = useState<MeetingBucket>("to_qualify");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [followUpMeeting, setFollowUpMeeting] = useState<SetterMeeting | null>(null);
  const [followUpAt, setFollowUpAt] = useState(tomorrowAtNine);
  const [followUpNote, setFollowUpNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/meetings/setter", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(data.message || data.error || "Impossible de charger les rendez-vous setter");
      setMeetings(data.results || []);
      setMetrics(data.metrics || EMPTY_METRICS);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return meetings.filter(meeting => {
      if (meeting.setterTracking.bucket !== view) return false;
      if (!needle) return true;
      const contact = meeting.associations.contact?.properties;
      const company = meeting.associations.company?.properties;
      return [meeting.properties.hs_meeting_title, contact?.firstname, contact?.lastname, contact?.email, company?.name, company?.domain]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [meetings, query, view]);

  async function saveResult(meeting: SetterMeeting, commercialResult: CommercialResult, options?: { reviewNote?: string; nextActionAt?: string }) {
    setSavingId(meeting.id);
    try {
      const response = await fetch("/api/meetings/setter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          commercialResult,
          reviewNote: options?.reviewNote || "",
          nextActionAt: options?.nextActionAt || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Modification impossible");

      if (commercialResult === "qualified") toast.success("RDV qualifié — il sort de la file à traiter.");
      if (commercialResult === "not_qualified") toast.success("RDV non qualifié — classé dans l’historique.");
      if (commercialResult === "no_show") toast.success(`No show enregistré${data.nextActionAt ? ` — rappel créé le ${formatDateTime(data.nextActionAt)}` : ""}.`);
      if (commercialResult === "follow_up") toast.success(`Relance programmée le ${formatDateTime(data.nextActionAt || options?.nextActionAt)}.`);

      setFollowUpMeeting(null);
      setFollowUpNote("");
      setFollowUpAt(tomorrowAtNine());
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Modification impossible");
    } finally {
      setSavingId(null);
    }
  }

  function openFollowUp(meeting: SetterMeeting) {
    setFollowUpMeeting(meeting);
    setFollowUpAt(tomorrowAtNine());
    setFollowUpNote("");
  }

  const meta = VIEW_META[view];

  return (
    <section className="px-5 pb-6 pt-4 lg:px-7">
      <Card className="mx-auto max-w-[1500px] overflow-hidden">
        <div className="border-b border-border px-5 py-5 lg:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary"><CalendarCheck2 className="h-4 w-4" /> Inbox commerciale</div>
              <h1 className="mt-2 text-xl font-bold tracking-[-0.025em]">Rendez-vous setter</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Un rendez-vous passé doit avoir un résultat. Pas de statut technique à interpréter : qualifie-le et passe au suivant.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-9 px-3 text-xs font-semibold">Taux qualifié : {metrics.qualificationRate}%</Badge>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void load()} disabled={loading} aria-label="Actualiser"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <ViewButton label="À qualifier" value={metrics.toQualify} active={view === "to_qualify"} icon={Clock3} onClick={() => setView("to_qualify")} />
            <ViewButton label="À venir" value={metrics.upcoming} active={view === "upcoming"} icon={CalendarCheck2} onClick={() => setView("upcoming")} />
            <ViewButton label="Historique" value={metrics.history} active={view === "history"} icon={History} onClick={() => setView("history")} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div>
            <div className="text-sm font-semibold">{meta.label}</div>
            <div className="text-xs text-muted-foreground">{meta.description}</div>
          </div>
          <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Contact, société ou rendez-vous" className="h-9 pl-9" /></div>
        </div>

        {error ? <div className="m-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        {loading ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : visible.length ? (
          <div className="divide-y divide-border">
            {visible.map(meeting => {
              const contact = meeting.associations.contact;
              const company = meeting.associations.company;
              const companyName = company?.properties.name || contact?.properties.company || "Société non associée";
              const busy = savingId === meeting.id;
              return (
                <article key={meeting.id} className={cn("grid gap-4 px-5 py-4 transition-colors hover:bg-muted/15 lg:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center lg:px-6", view === "to_qualify" && "bg-amber-50/20")}>
                  <div>
                    <div className="text-sm font-bold">{formatDate(meeting.derived.startAt)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatTime(meeting.derived.startAt)}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{companyName}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{personName(contact)}{contact?.properties.email ? ` · ${contact.properties.email}` : ""}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{meeting.properties.hs_meeting_title || "Rendez-vous"}</div>
                    {meeting.setterTracking.reviewNote ? <div className="mt-1 truncate text-xs text-muted-foreground">{meeting.setterTracking.reviewNote}</div> : null}
                    {view === "history" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ResultBadge result={meeting.setterTracking.commercialResult} />
                        {meeting.setterTracking.commercialResult === "follow_up" && meeting.setterTracking.nextActionAt ? <span className="text-xs font-medium text-primary">Relance : {formatDateTime(meeting.setterTracking.nextActionAt)}</span> : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-1.5 lg:justify-end">
                    {view === "to_qualify" ? (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => void saveResult(meeting, "qualified")}><Check className="h-3.5 w-3.5" /> Qualifié</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => openFollowUp(meeting)}><CalendarClock className="h-3.5 w-3.5" /> À relancer</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveResult(meeting, "not_qualified")}><UserX className="h-3.5 w-3.5" /> Non qualifié</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveResult(meeting, "no_show")}><PhoneCall className="h-3.5 w-3.5" /> No show</Button>
                      </>
                    ) : null}

                    {view === "upcoming" ? (
                      company ? <Button asChild size="sm" variant="outline"><a href={`/companies/${company.id}`}>Préparer <ArrowUpRight className="h-3.5 w-3.5" /></a></Button>
                        : contact ? <Button asChild size="sm" variant="outline"><a href={`/contacts/${contact.id}`}>Préparer <ArrowUpRight className="h-3.5 w-3.5" /></a></Button>
                          : <Badge variant="outline">À préparer</Badge>
                    ) : null}

                    {view === "history" ? <span className="text-xs text-muted-foreground">{meeting.setterTracking.updatedAt ? `Traité ${formatDateTime(meeting.setterTracking.updatedAt)}` : "Traité"}</span> : null}
                    {busy ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div>
              {view === "to_qualify" ? <Check className="mx-auto h-8 w-8 text-emerald-600" /> : <CalendarCheck2 className="mx-auto h-8 w-8 text-primary/60" />}
              <div className="mt-3 font-semibold">{view === "to_qualify" ? "Tout est qualifié" : "Aucun rendez-vous ici"}</div>
              <div className="mt-1 text-sm text-muted-foreground">{view === "to_qualify" ? "Aucun rendez-vous passé n’attend de décision commerciale." : "Change de vue ou de recherche."}</div>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={Boolean(followUpMeeting)} onOpenChange={open => !savingId && !open && setFollowUpMeeting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Programmer la relance</DialogTitle>
            <DialogDescription>Le rendez-vous sort de « À qualifier » et une tâche HubSpot est créée automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Date et heure</Label>
              <Input type="datetime-local" value={followUpAt} onChange={event => setFollowUpAt(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Note rapide <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
              <Input value={followUpNote} onChange={event => setFollowUpNote(event.target.value)} placeholder="Ex. rappeler avec le directeur, budget à confirmer…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowUpMeeting(null)} disabled={Boolean(savingId)}>Annuler</Button>
            <Button
              disabled={!followUpMeeting || !followUpAt || Boolean(savingId)}
              onClick={() => followUpMeeting && void saveResult(followUpMeeting, "follow_up", { reviewNote: followUpNote, nextActionAt: followUpAt })}
            >
              {savingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Programmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
