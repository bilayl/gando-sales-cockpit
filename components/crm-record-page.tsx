"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  History,
  LayoutDashboard,
  ListTodo,
  Loader2,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  RefreshCw,
  Sparkles,
  StickyNote,
  UserRound,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CallObjectionCoachPanel } from "@/components/call-objection-coach-panel";
import { EditableContactEmail } from "@/components/editable-contact-email";
import { EditableCRMTaskCard } from "@/components/editable-crm-task-card";
import { PostCallEmailButton } from "@/components/post-call-email-button";
import { ProfileSourcingButton } from "@/components/profile-sourcing-button";
import { AllCRMProperties, NewCRMNoteButton } from "@/components/crm-record-tools";
import { QualificationProperties } from "@/components/qualification-properties";
import { buildCallObjectionCoach } from "@/lib/call-objection-coach";
import { formatDate, initials } from "@/lib/utils";

type Kind = "contact" | "company";
type WorkspaceTab = "overview" | "activity" | "calls" | "notes" | "tasks";

type Props = {
  kind: Kind;
  recordId: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function plainText(value?: string | null) {
  if (!value) return "";
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|ul|ol)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ownerLabel(owners: Record<string, string>, id?: string | null) {
  if (!id) return "Non assigné";
  return owners[id] || `Owner ${id}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function DetailRow({ label, value, icon: Icon, children }: {
  label: string;
  value?: string | null;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[22px_112px_minmax(0,1fr)] items-start gap-2 border-b border-border/70 py-3 last:border-b-0">
      <Icon size={15} className="mt-0.5 text-muted-foreground" />
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-[13px] font-medium text-foreground">{children || value || "—"}</div>
    </div>
  );
}

function NoteCard({ note, owners }: { note: any; owners: Record<string, string> }) {
  const p = note.properties || {};
  const body = plainText(p.hs_note_body);
  const date = p.hs_timestamp || p.hs_createdate || note.createdAt;
  const source = note.sourceContactName || (note.sourceType === "company" ? "Entreprise" : "Contact");
  return (
    <article className="border-b border-border px-1 py-5 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground"><StickyNote size={14} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold">Note</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{source} · {ownerLabel(owners, p.hubspot_owner_id)}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">{date ? formatDate(date) : "Date inconnue"}</div>
          </div>
          <div className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-6 text-foreground/90">{body || "Note vide."}</div>
        </div>
      </div>
    </article>
  );
}

function CallCard({ call, owners }: { call: any; owners: Record<string, string> }) {
  const p = call.properties || {};
  const body = plainText(p.hs_call_body);
  const summary = plainText(p.hs_call_summary || p.hs_ai_summary || call.onoffAiAnalysis?.summary);
  const transcript = plainText(call.transcript);
  const recordingUrl = String(p.hs_call_recording_url || "").trim();
  return (
    <article className="border-b border-border px-1 py-5 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground"><PhoneCall size={14} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold">{p.hs_call_title || "Appel"}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{call.sourceContactName || ownerLabel(owners, p.hubspot_owner_id)}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">{p.hs_timestamp ? formatDate(p.hs_timestamp) : "—"}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.hs_call_disposition ? <Badge variant="outline" className="text-[10px]">{p.hs_call_disposition}</Badge> : null}
            {p.hs_call_status ? <Badge variant="outline" className="text-[10px]">{p.hs_call_status}</Badge> : null}
            {transcript ? <Badge variant="secondary" className="text-[10px]">Transcription disponible</Badge> : null}
          </div>
          {summary ? <div className="mt-3 rounded-lg border border-border bg-muted/25 p-3"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Synthèse</div><div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-5">{summary}</div></div> : null}
          {body ? <div className="mt-3"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Notes de l’appel</div><div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-5">{body}</div></div> : null}
          {transcript ? (
            <details className="mt-3 rounded-lg border border-border bg-background">
              <summary className="cursor-pointer px-3 py-2.5 text-[12px] font-semibold">Voir la transcription complète</summary>
              <div className="max-h-[420px] overflow-y-auto border-t border-border px-3 py-3 whitespace-pre-wrap text-[12px] leading-5 text-foreground/90 minari-scrollbar">{transcript}</div>
            </details>
          ) : p.hs_call_has_transcript === "true" ? <div className="mt-3 text-[11px] text-muted-foreground">HubSpot indique qu’une transcription existe, mais aucun texte n’a encore été synchronisé dans le Cockpit.</div> : null}
          {recordingUrl ? <a href={recordingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"><Phone size={12} /> Écouter l’enregistrement</a> : null}
        </div>
      </div>
    </article>
  );
}

function MeetingCard({ meeting }: { meeting: any }) {
  const p = meeting.properties || {};
  const notes = plainText(p.hs_internal_meeting_notes);
  const date = meeting.derived?.startAt || p.hs_meeting_start_time || p.hs_timestamp;
  return (
    <article className="border-b border-border px-1 py-5 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground"><CalendarClock size={14} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="text-[13px] font-semibold">{p.hs_meeting_title || "Rendez-vous"}</div><div className="text-[11px] text-muted-foreground">{date ? formatDate(date) : "—"}</div></div>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant="outline" className="text-[10px]">{meeting.derived?.status || p.hs_meeting_outcome || "À traiter"}</Badge>{meeting.sourceContactName ? <Badge variant="outline" className="text-[10px]">{meeting.sourceContactName}</Badge> : null}</div>
          {notes ? <div className="mt-3 whitespace-pre-wrap text-[13px] leading-5">{notes}</div> : null}
          {p.hs_meeting_location ? <div className="mt-2 text-[11px] text-muted-foreground">{p.hs_meeting_location}</div> : null}
        </div>
      </div>
    </article>
  );
}

function activityTimestamp(item: { kind: string; record: any }) {
  const p = item.record?.properties || {};
  if (item.kind === "meeting") return item.record?.derived?.startAt || p.hs_meeting_start_time || p.hs_timestamp || "";
  return p.hs_timestamp || p.hs_createdate || item.record?.createdAt || "";
}

export function CRMRecordPage({ kind, recordId }: Props) {
  const [data, setData] = useState<any>(null);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = kind === "company" ? `/api/companies/${recordId}/centralized` : `/api/contacts/${recordId}/centralized`;
      const [response, ownerResponse] = await Promise.all([
        fetch(endpoint, { cache: "no-store" }),
        fetch("/api/owners", { cache: "no-store" }),
      ]);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de charger la fiche");
      setData(payload);
      if (ownerResponse.ok) {
        const ownerPayload = await ownerResponse.json();
        setOwners(Object.fromEntries((ownerPayload.results || []).map((owner: any) => [owner.id, [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || owner.id])));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger la fiche");
    } finally {
      setLoading(false);
    }
  }, [kind, recordId]);

  useEffect(() => { void load(); }, [load]);

  const record = kind === "company" ? data?.company : data?.contact;
  const p = record?.properties || {};
  const name = kind === "company"
    ? p.name || "Entreprise"
    : [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact";
  const subtitle = kind === "company" ? p.domain || p.website : p.jobtitle || p.company || p.email;
  const counts = data?.activitySummary || { notes: data?.notes?.length || 0, calls: data?.calls?.length || 0, meetings: data?.meetings?.length || 0, tasks: data?.tasks?.length || 0, total: 0 };

  const linkedRecords = useMemo(() => kind === "company" ? data?.contacts || [] : data?.companies || [], [data, kind]);
  const associatedPhoneRecord = kind === "company" ? linkedRecords.find((item: any) => item?.properties?.phone || item?.properties?.mobilephone) : null;
  const associatedPhone = associatedPhoneRecord?.properties?.phone || associatedPhoneRecord?.properties?.mobilephone || "";
  const effectivePhone = p.phone || p.mobilephone || associatedPhone;
  const phoneLabel = p.phone || p.mobilephone ? "Téléphone" : associatedPhone ? "Téléphone associé" : "Téléphone";

  const associatedEmailRecord = kind === "company" ? linkedRecords.find((item: any) => item?.properties?.email) : null;
  const effectiveEmail = p.email || associatedEmailRecord?.properties?.email || "";
  const emailContactId = kind === "contact" ? recordId : associatedEmailRecord?.id ? String(associatedEmailRecord.id) : "";
  const emailContactProperties = kind === "contact" ? p : associatedEmailRecord?.properties || {};
  const emailFirstName = emailContactProperties.firstname || undefined;
  const companyName = kind === "company" ? name : linkedRecords[0]?.properties?.name || p.company || "";

  const coach = useMemo(() => buildCallObjectionCoach({
    properties: { ...p, ...(kind === "company" ? emailContactProperties : {}) },
    notes: data?.notes || [],
    calls: data?.calls || [],
  }), [data, p, kind, emailContactProperties]);
  const latestCall = coach.latestCall;
  const latestCallProperties = latestCall?.properties || {};
  const warm = coach.signalsAnalyzed > 0 || Boolean(coach.latestCall);

  const timeline = useMemo(() => {
    const items = [
      ...(data?.notes || []).map((record: any) => ({ kind: "note", record })),
      ...(data?.calls || []).map((record: any) => ({ kind: "call", record })),
      ...(data?.meetings || []).map((record: any) => ({ kind: "meeting", record })),
      ...(data?.tasks || []).map((record: any) => ({ kind: "task", record })),
    ];
    return items.sort((a, b) => new Date(activityTimestamp(b) || 0).getTime() - new Date(activityTimestamp(a) || 0).getTime());
  }, [data]);

  const nextAction = p.date_prochaine_relance || p.date_recyclage || p.date_de_rappel || p.qualification_next_action_at;
  const lifecycle = p.lifecyclestage === "customer" ? "Client" : p.statut_prospection || p.qualification_status || p.hs_lead_status || "À qualifier";
  const location = [p.zip || p.postal_code, p.city, p.state, p.country || p.hs_country_region_code].filter(Boolean).join(" · ");

  const tabs: Array<{ value: WorkspaceTab; label: string; icon: React.ComponentType<{ size?: number }>; count?: number }> = [
    { value: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
    { value: "activity", label: "Activité", icon: Activity, count: timeline.length },
    { value: "calls", label: "Appels", icon: PhoneCall, count: counts.calls || 0 },
    { value: "notes", label: "Notes", icon: StickyNote, count: counts.notes || 0 },
    { value: "tasks", label: "Tâches", icon: ListTodo, count: counts.tasks || 0 },
  ];

  function renderTimelineItem(item: { kind: string; record: any }) {
    if (item.kind === "note") return <NoteCard key={`note-${item.record.id}`} note={item.record} owners={owners} />;
    if (item.kind === "call") return <CallCard key={`call-${item.record.id}`} call={item.record} owners={owners} />;
    if (item.kind === "meeting") return <MeetingCard key={`meeting-${item.record.id}`} meeting={item.record} />;
    return <div key={`task-${item.record.id}`} className="py-2"><EditableCRMTaskCard task={item.record} ownerName={ownerLabel(owners, item.record.properties?.hubspot_owner_id)} onUpdated={load} /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[1680px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0"><Link href="/prospection"><ArrowLeft size={15} /></Link></Button>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{name}</div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{kind === "company" ? "Entreprise" : "Contact"}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {effectivePhone ? <Button asChild size="sm" className="h-8"><a href={`tel:${effectivePhone}`}><Phone size={13} /> Appeler</a></Button> : null}
            {effectiveEmail ? <Button asChild variant="outline" size="sm" className="h-8"><a href={`mailto:${effectiveEmail}`}><Mail size={13} /> Email</a></Button> : null}
            <NewCRMNoteButton kind={kind} recordId={recordId} onCreated={async () => { setTab("notes"); await load(); }} />
            <ProfileSourcingButton entityType={kind} entityId={recordId} onCompleted={load} label="Enrichir" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></Button>
          </div>
        </div>
      </div>

      {loading ? <div className="grid min-h-[75vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div> : error ? (
        <div className="mx-auto max-w-3xl p-6"><div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 text-sm text-destructive">{error}</div></div>
      ) : (
        <div className="mx-auto grid max-w-[1680px] xl:grid-cols-[350px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-muted/[0.08] xl:min-h-[calc(100vh-57px)] xl:border-b-0 xl:border-r">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 shrink-0 rounded-xl border border-border bg-background"><AvatarFallback className="rounded-xl bg-muted text-primary">{kind === "company" ? <Building2 size={22} /> : initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[20px] font-semibold tracking-[-0.025em]">{name}</h1>
                  <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{subtitle || "Fiche CRM"}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{lifecycle}</Badge>
                    <Badge variant="outline" className="text-[10px]">{warm ? "Warm" : "Cold"}</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {effectivePhone ? <a href={`tel:${effectivePhone}`} className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-2.5 text-[10px] font-medium transition hover:bg-muted"><Phone size={15} />Appeler</a> : <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted/20 px-2 py-2.5 text-[10px] text-muted-foreground"><Phone size={15} />Sans tél.</div>}
                {effectiveEmail ? <a href={`mailto:${effectiveEmail}`} className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-2.5 text-[10px] font-medium transition hover:bg-muted"><Mail size={15} />Email</a> : <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted/20 px-2 py-2.5 text-[10px] text-muted-foreground"><Mail size={15} />Sans email</div>}
                <button type="button" onClick={() => setTab("notes")} className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-2.5 text-[10px] font-medium transition hover:bg-muted"><StickyNote size={15} />Notes</button>
              </div>

              <div className="mt-6 border-t border-border pt-2">
                <div className="py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Informations</div>
                <DetailRow icon={UserRound} label="Commercial" value={ownerLabel(owners, p.hubspot_owner_id)} />
                <DetailRow icon={Phone} label={phoneLabel} value={effectivePhone} />
                <DetailRow icon={Mail} label={kind === "company" ? "Email associé" : "Email"}>
                  <EditableContactEmail contactId={emailContactId || undefined} email={effectiveEmail} associated={kind === "company"} onSaved={load} />
                </DetailRow>
                {kind === "company" ? <DetailRow icon={Globe} label="Domaine" value={p.domain || p.website} /> : null}
                <DetailRow icon={MapPin} label="Localisation" value={location} />
                <DetailRow icon={Clock} label="Dernière activité" value={p.hs_last_sales_activity_timestamp ? formatDate(p.hs_last_sales_activity_timestamp) : undefined} />
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <QualificationProperties kind={kind} properties={{ ...p, __hubspot_id: p.__hubspot_id || recordId }} fallbackProperties={kind === "company" ? (data?.contacts?.[0]?.properties || {}) : {}} />
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{kind === "company" ? <Users size={13} /> : <Building2 size={13} />} {kind === "company" ? "Contacts associés" : "Entreprises associées"}</div>
                <div className="space-y-1">
                  {linkedRecords.length ? linkedRecords.slice(0, 8).map((item: any) => {
                    const lp = item.properties || {};
                    const label = kind === "company" ? [lp.firstname, lp.lastname].filter(Boolean).join(" ") || lp.email || "Contact" : lp.name || lp.domain || "Entreprise";
                    const href = kind === "company" ? `/contacts/${item.id}` : `/companies/${item.id}`;
                    return <Link key={item.id} href={href} className="block rounded-md px-2 py-2 transition hover:bg-muted"><div className="truncate text-[12px] font-medium">{label}</div><div className="mt-0.5 truncate text-[10px] text-muted-foreground">{kind === "company" ? lp.jobtitle || lp.email || lp.phone || lp.mobilephone : lp.domain || lp.city}</div></Link>;
                  }) : <div className="px-2 py-3 text-[11px] text-muted-foreground">Aucun élément associé.</div>}
                </div>
              </div>

              <div className="mt-5"><AllCRMProperties kind={kind} recordId={recordId} /></div>
            </div>
          </aside>

          <main className="min-w-0">
            <nav className="sticky top-[57px] z-20 flex gap-1 overflow-x-auto border-b border-border bg-background px-4 sm:px-6">
              {tabs.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.value} type="button" onClick={() => setTab(item.value)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[12px] font-medium transition ${tab === item.value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    <Icon size={14} />{item.label}{typeof item.count === "number" ? <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{item.count}</span> : null}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 sm:p-6 lg:p-7">
              {tab === "overview" ? (
                <div className="space-y-6">
                  <section>
                    <div className="mb-3 flex items-center justify-between"><div className="text-[13px] font-semibold">Highlights</div><div className="text-[11px] text-muted-foreground">Synchronisé avec HubSpot + Onoff</div></div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-border p-4"><div className="text-[11px] text-muted-foreground">Statut commercial</div><div className="mt-3 text-[16px] font-semibold">{lifecycle}</div><div className="mt-1 text-[10px] text-muted-foreground">{p.statut_de_lappel || "Dernier résultat non renseigné"}</div></div>
                      <div className="rounded-xl border border-border p-4"><div className="text-[11px] text-muted-foreground">Prochaine action</div><div className="mt-3 text-[16px] font-semibold">{nextAction ? formatDateTime(nextAction) : "Aucune planifiée"}</div><div className="mt-1 text-[10px] text-muted-foreground">Relance / tâche commerciale</div></div>
                      <div className="rounded-xl border border-border p-4"><div className="text-[11px] text-muted-foreground">Contexte d’appel</div><div className="mt-3 flex items-center gap-2 text-[16px] font-semibold"><span className={`h-2 w-2 rounded-full ${warm ? "bg-amber-500" : "bg-sky-500"}`} />{warm ? "Warm call" : "Cold call"}</div><div className="mt-1 text-[10px] text-muted-foreground">{coach.transcriptCalls} transcription(s) · {coach.notesAnalyzed} note(s)</div></div>
                      <div className="rounded-xl border border-border p-4"><div className="text-[11px] text-muted-foreground">Activité CRM</div><div className="mt-3 text-[16px] font-semibold">{timeline.length} activité{timeline.length > 1 ? "s" : ""}</div><div className="mt-1 text-[10px] text-muted-foreground">{counts.calls || 0} appels · {counts.notes || 0} notes · {counts.tasks || 0} tâches</div></div>
                    </div>
                  </section>

                  <CallObjectionCoachPanel coach={coach} />

                  <section className="rounded-xl border border-border">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                      <div><div className="text-[13px] font-semibold">Activité récente</div><div className="mt-0.5 text-[10px] text-muted-foreground">Derniers échanges, notes, appels et tâches</div></div>
                      <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => setTab("activity")}>Voir toute l’activité</Button>
                    </div>
                    <div className="px-4">{timeline.length ? timeline.slice(0, 6).map(renderTimelineItem) : <div className="py-10 text-center text-[12px] text-muted-foreground">Aucune activité enregistrée.</div>}</div>
                  </section>

                  <section className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><div className="flex items-center gap-2 text-[13px] font-semibold"><Sparkles size={14} className="text-primary" /> Actions rapides</div><div className="mt-1 text-[10px] text-muted-foreground">Chaque action est séparée pour éviter de mélanger qualification et exécution.</div></div>
                      <div className="flex flex-wrap gap-2">
                        {effectivePhone ? <Button asChild size="sm"><a href={`tel:${effectivePhone}`}><Phone size={13} /> Appeler</a></Button> : null}
                        <NewCRMNoteButton kind={kind} recordId={recordId} onCreated={async () => { setTab("notes"); await load(); }} />
                        <PostCallEmailButton
                          contactId={emailContactId || undefined}
                          callId={latestCall?.id ? String(latestCall.id) : undefined}
                          email={effectiveEmail}
                          firstName={emailFirstName}
                          companyName={companyName}
                          callTitle={latestCallProperties.hs_call_title || undefined}
                          callBody={latestCallProperties.hs_call_body || latestCallProperties.hs_call_summary || undefined}
                          transcription={coach.transcript}
                          buttonLabel="Email de suivi IA"
                          buttonClassName="h-9 gap-1.5"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              ) : null}

              {tab === "activity" ? (
                <section className="rounded-xl border border-border">
                  <div className="border-b border-border px-4 py-3"><div className="text-[13px] font-semibold">Toute l’activité</div><div className="mt-0.5 text-[10px] text-muted-foreground">Historique chronologique centralisé HubSpot + Onoff</div></div>
                  <div className="px-4">{timeline.length ? timeline.map(renderTimelineItem) : <div className="py-12 text-center text-[12px] text-muted-foreground">Aucune activité.</div>}</div>
                </section>
              ) : null}

              {tab === "calls" ? (
                <section className="rounded-xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><div className="text-[13px] font-semibold">Appels</div><div className="mt-0.5 text-[10px] text-muted-foreground">Notes, synthèses, enregistrements et transcriptions associés</div></div><Badge variant="outline">{counts.calls || 0}</Badge></div>
                  <div className="px-4">{(data?.calls || []).length ? (data.calls || []).map((call: any) => <CallCard key={call.id} call={call} owners={owners} />) : <div className="py-12 text-center text-[12px] text-muted-foreground">Aucun appel associé.</div>}</div>
                </section>
              ) : null}

              {tab === "notes" ? (
                <section className="rounded-xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><div className="text-[13px] font-semibold">Notes</div><div className="mt-0.5 text-[10px] text-muted-foreground">Les nouvelles notes sont écrites directement dans HubSpot et utilisées dans le brief d’appel.</div></div><NewCRMNoteButton kind={kind} recordId={recordId} onCreated={load} /></div>
                  <div className="px-4">{(data?.notes || []).length ? (data.notes || []).map((note: any) => <NoteCard key={note.id} note={note} owners={owners} />) : <div className="py-12 text-center"><StickyNote className="mx-auto h-5 w-5 text-muted-foreground" /><div className="mt-2 text-[12px] font-medium">Aucune note</div><div className="mt-1 text-[10px] text-muted-foreground">Ajoute la première note pour enrichir le contexte commercial.</div></div>}</div>
                </section>
              ) : null}

              {tab === "tasks" ? (
                <section className="rounded-xl border border-border">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><div className="text-[13px] font-semibold">Tâches</div><div className="mt-0.5 text-[10px] text-muted-foreground">Actions HubSpot associées à cette fiche</div></div><Badge variant="outline">{counts.tasks || 0}</Badge></div>
                  <div className="space-y-3 p-4">{(data?.tasks || []).length ? (data.tasks || []).map((task: any) => <EditableCRMTaskCard key={task.id} task={task} ownerName={ownerLabel(owners, task.properties?.hubspot_owner_id)} onUpdated={load} />) : <div className="py-10 text-center"><CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" /><div className="mt-2 text-[12px] text-muted-foreground">Aucune tâche associée.</div></div>}</div>
                </section>
              ) : null}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
