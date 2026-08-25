"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Check, Clock3, Loader2, RefreshCw, Search, X } from "lucide-react";
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
  if (status === "qualified") return <Badge className="whitespace-nowrap border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><Check className="mr-1 h-3 w-3" /> Qualifié</Badge>;
  if (status === "not_qualified") return <Badge className="whitespace-nowrap border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50"><X className="mr-1 h-3 w-3" /> Non qualifié</Badge>;
  return <Badge variant="outline" className="whitespace-nowrap border-amber-200 bg-amber-50 text-amber-700"><Clock3 className="mr-1 h-3 w-3" /> À qualifier</Badge>;
}

function FilterButton({ label, value, active, onClick }: { label: string; value: string | number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground",
        active && "border-primary/30 bg-primary/[0.07] text-primary",
      )}
    >
      {label}
      <span className={cn("rounded-md bg-muted px-1.5 py-0.5 text-[10px]", active && "bg-primary/10")}>{value}</span>
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
    <section className="px-5 pb-6 pt-4 lg:px-7">
      <Card className="mx-auto max-w-[1500px] overflow-hidden">
        <div className="border-b border-border px-5 py-5 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary"><CalendarCheck2 className="h-4 w-4" /> Performance setter</div>
              <h1 className="mt-2 text-xl font-bold tracking-[-0.025em]">Rendez-vous setter</h1>
              <p className="mt-1 text-sm text-muted-foreground">Tous les rendez-vous posés par le setter, avec leur qualification commerciale.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterButton label="Tous" value={metrics.total} active={filter === "all"} onClick={() => setFilter("all")} />
              <FilterButton label="Qualifiés" value={metrics.qualified} active={filter === "qualified"} onClick={() => setFilter("qualified")} />
              <FilterButton label="Non qualifiés" value={metrics.notQualified} active={filter === "not_qualified"} onClick={() => setFilter("not_qualified")} />
              <FilterButton label="À qualifier" value={metrics.pending} active={filter === "pending"} onClick={() => setFilter("pending")} />
              <Badge variant="outline" className="h-9 px-3 text-xs font-semibold">Taux de qualification : {metrics.qualificationRate}%</Badge>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void load()} disabled={loading} aria-label="Actualiser"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="text-xs text-muted-foreground"><strong className="text-foreground">{visible.length}</strong> rendez-vous affiché{visible.length > 1 ? "s" : ""}</div>
          <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Contact, société ou rendez-vous" className="h-9 pl-9" /></div>
        </div>

        {error ? <div className="m-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        {loading ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : visible.length ? (
          <div className="overflow-x-auto minari-scrollbar">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead className="bg-muted/35 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="border-b border-border px-5 py-3">Date</th>
                  <th className="border-b border-border px-4 py-3">Société</th>
                  <th className="border-b border-border px-4 py-3">Contact</th>
                  <th className="border-b border-border px-4 py-3">Rendez-vous</th>
                  <th className="border-b border-border px-4 py-3">Statut</th>
                  <th className="border-b border-border px-4 py-3">Résultat</th>
                  <th className="border-b border-border px-4 py-3">Qualification</th>
                  <th className="border-b border-border px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(meeting => {
                  const contact = meeting.associations.contact;
                  const company = meeting.associations.company;
                  const outcome = meeting.setterTracking.commercialOutcome;
                  return (
                    <tr key={meeting.id} className="align-middle transition-colors hover:bg-muted/20">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="text-sm font-semibold">{formatDate(meeting.derived.startAt)}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{formatTime(meeting.derived.startAt)}</div>
                      </td>
                      <td className="max-w-[190px] px-4 py-4">
                        <div className="truncate text-sm font-semibold">{company?.properties.name || contact?.properties.company || "Société non associée"}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{company?.properties.domain || "—"}</div>
                      </td>
                      <td className="max-w-[210px] px-4 py-4">
                        <div className="truncate text-sm font-medium">{personName(contact)}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{contact?.properties.email || "—"}</div>
                      </td>
                      <td className="max-w-[280px] px-4 py-4">
                        <div className="truncate text-sm font-medium">{meeting.properties.hs_meeting_title || "Rendez-vous sans titre"}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{meeting.setterTracking.qualificationReason}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4"><Badge variant="outline">{STATUS_LABELS[meeting.derived.status] || meeting.derived.status}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">{outcome ? OUTCOME_LABELS[outcome] || outcome : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-4"><QualificationBadge status={meeting.setterTracking.qualificationStatus} /></td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant={meeting.setterTracking.qualificationStatus === "qualified" ? "default" : "outline"} disabled={savingId === meeting.id} onClick={() => void setQualification(meeting.id, "qualified")}><Check className="h-3.5 w-3.5" /> Qualifié</Button>
                          <Button size="sm" variant="outline" disabled={savingId === meeting.id} onClick={() => void setQualification(meeting.id, "not_qualified")}><X className="h-3.5 w-3.5" /> Non qualifié</Button>
                          {meeting.setterTracking.manuallyReviewed ? <Button size="sm" variant="ghost" disabled={savingId === meeting.id} onClick={() => void setQualification(meeting.id, "pending")}><Clock3 className="h-3.5 w-3.5" /> À revoir</Button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center"><div><CalendarCheck2 className="mx-auto h-7 w-7 text-primary/60" /><div className="mt-3 font-semibold">Aucun rendez-vous dans ce filtre</div><div className="mt-1 text-sm text-muted-foreground">Change le filtre ou la recherche.</div></div></div>
        )}
      </Card>
    </section>
  );
}
