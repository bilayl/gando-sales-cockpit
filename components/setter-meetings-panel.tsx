"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Check, Clock3, Loader2, RefreshCw, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type QualificationStatus = "qualified" | "not_qualified" | "pending";
type QualificationFilter = "all" | QualificationStatus;

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
    qualified: number;
    notQualified: number;
    pending: number;
    qualificationRate: number;
  };
  error?: string;
  message?: string;
};

const OUTCOME_LABELS: Record<string, string> = {
  QUALIFIED: "Qualifié",
  INTERESTED: "Intéressé",
  PROPOSAL: "Proposition à envoyer",
  SECOND_MEETING: "Second rendez-vous",
  DECISION_MAKER: "Décideur à engager",
  NURTURE: "Nurture",
  TOO_EARLY: "Trop tôt",
  NOT_QUALIFIED: "Non qualifié",
  LOST: "Perdu",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Planifié",
  COMPLETED: "Terminé",
  NO_SHOW: "No-show",
  CANCELED: "Annulé",
  RESCHEDULED: "Replanifié",
  UNREVIEWED: "À traiter",
};

function formatDate(value?: string | null) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function personName(object: HubSpotObject | null) {
  if (!object) return "Contact non associé";
  const p = object.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function QualificationBadge({ status }: { status: QualificationStatus }) {
  if (status === "qualified") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><Check className="mr-1 h-3 w-3" /> Qualifié</Badge>;
  if (status === "not_qualified") return <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50"><X className="mr-1 h-3 w-3" /> Non qualifié</Badge>;
  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><Clock3 className="mr-1 h-3 w-3" /> À qualifier</Badge>;
}

function MetricButton({ label, value, detail, active, onClick }: { label: string; value: string | number; detail: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/30 hover:bg-muted/20", active && "border-primary/35 bg-primary/[0.04] ring-1 ring-primary/10")}>
      <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-bold", active && "text-primary")}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </button>
  );
}

export function SetterMeetingsPanel() {
  const [meetings, setMeetings] = useState<SetterMeeting[]>([]);
  const [metrics, setMetrics] = useState<ApiResponse["metrics"]>({ total: 0, qualified: 0, notQualified: 0, pending: 0, qualificationRate: 0 });
  const [filter, setFilter] = useState<QualificationFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/meetings/setter", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(data.message || data.error || "Impossible de charger les rendez-vous setter");
      setMeetings(data.results || []);
      setMetrics(data.metrics || { total: 0, qualified: 0, notQualified: 0, pending: 0, qualificationRate: 0 });
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
      if (filter !== "all" && meeting.setterTracking.qualificationStatus !== filter) return false;
      if (!needle) return true;
      const contact = meeting.associations.contact?.properties;
      const company = meeting.associations.company?.properties;
      return [
        meeting.properties.hs_meeting_title,
        contact?.firstname,
        contact?.lastname,
        contact?.email,
        company?.name,
        company?.domain,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [filter, meetings, query]);

  async function setQualification(meetingId: string, qualificationStatus: QualificationStatus) {
    setSavingId(meetingId);
    try {
      const response = await fetch("/api/meetings/setter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingId, qualificationStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Modification impossible");
      toast.success(qualificationStatus === "qualified" ? "Rendez-vous marqué qualifié" : qualificationStatus === "not_qualified" ? "Rendez-vous marqué non qualifié" : "Rendez-vous remis à qualifier");
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Modification impossible");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="px-5 pt-5 lg:px-7 lg:pt-6">
      <Card className="mx-auto max-w-[1500px] overflow-hidden">
        <div className="border-b border-border bg-primary/[0.025] p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary"><CalendarCheck2 className="h-4 w-4" /> Performance setter</div>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.025em]">Suivi des rendez-vous posés par le setter</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Rendez-vous issus des liens de réservation Brevo / présentation Gando, avec qualification commerciale et correction manuelle possible.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Actualiser</Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricButton label="RDV setter" value={metrics.total} detail="Tous les rendez-vous identifiés" active={filter === "all"} onClick={() => setFilter("all")} />
            <MetricButton label="Qualifiés" value={metrics.qualified} detail="Rendez-vous qualifiés" active={filter === "qualified"} onClick={() => setFilter("qualified")} />
            <MetricButton label="Non qualifiés" value={metrics.notQualified} detail="Inclut no-show et annulés" active={filter === "not_qualified"} onClick={() => setFilter("not_qualified")} />
            <MetricButton label="À qualifier" value={metrics.pending} detail="À venir ou résultat manquant" active={filter === "pending"} onClick={() => setFilter("pending")} />
            <MetricButton label="Taux de qualification" value={`${metrics.qualificationRate}%`} detail="Qualifiés / rendez-vous décidés" active={false} onClick={() => setFilter("all")} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold">{visible.length} rendez-vous affiché{visible.length > 1 ? "s" : ""}</div>
          <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Contact, société ou rendez-vous" className="h-9 pl-9" /></div>
        </div>

        {error ? <div className="m-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        {loading ? (
          <div className="grid min-h-56 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : visible.length ? (
          <div className="divide-y divide-border">
            {visible.map(meeting => {
              const contact = meeting.associations.contact;
              const company = meeting.associations.company;
              const outcome = meeting.setterTracking.commercialOutcome;
              return (
                <article key={meeting.id} className="grid gap-4 px-5 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[150px_minmax(220px,1fr)_minmax(240px,1.2fr)_auto] lg:items-center">
                  <div>
                    <div className="font-semibold">{formatDate(meeting.derived.startAt)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatTime(meeting.derived.startAt)} · {STATUS_LABELS[meeting.derived.status] || meeting.derived.status}</div>
                    <div className="mt-2"><QualificationBadge status={meeting.setterTracking.qualificationStatus} /></div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate font-semibold">{company?.properties.name || contact?.properties.company || "Société non associée"}</div>
                    <div className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><UserRound className="h-3.5 w-3.5 shrink-0" /> {personName(contact)}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{contact?.properties.email || company?.properties.domain || "Coordonnées non renseignées"}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{meeting.properties.hs_meeting_title || "Rendez-vous sans titre"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Résultat : <span className="font-medium text-foreground">{outcome ? OUTCOME_LABELS[outcome] || outcome : "Non renseigné"}</span></div>
                    <div className="mt-1 text-xs text-muted-foreground">{meeting.setterTracking.qualificationReason}{meeting.setterTracking.manuallyReviewed ? " · vérifié manuellement" : ""}</div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button size="sm" variant={meeting.setterTracking.qualificationStatus === "qualified" ? "default" : "outline"} disabled={savingId === meeting.id} onClick={() => void setQualification(meeting.id, "qualified")}><Check className="h-3.5 w-3.5" /> Qualifié</Button>
                    <Button size="sm" variant="outline" disabled={savingId === meeting.id} onClick={() => void setQualification(meeting.id, "not_qualified")}><X className="h-3.5 w-3.5" /> Non qualifié</Button>
                    {meeting.setterTracking.manuallyReviewed ? <Button size="sm" variant="ghost" disabled={savingId === meeting.id} onClick={() => void setQualification(meeting.id, "pending")}><Clock3 className="h-3.5 w-3.5" /> À revoir</Button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center px-6 text-center"><div><CalendarCheck2 className="mx-auto h-7 w-7 text-primary/60" /><div className="mt-3 font-semibold">Aucun rendez-vous dans ce filtre</div><div className="mt-1 text-sm text-muted-foreground">Change le filtre ou la recherche.</div></div></div>
        )}
      </Card>
    </section>
  );
}
