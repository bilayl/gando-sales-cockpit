"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  History,
  ListTodo,
  Loader2,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  RefreshCw,
  UserRound,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EditableCRMTaskCard } from "@/components/editable-crm-task-card";
import { ProfileSourcingButton } from "@/components/profile-sourcing-button";
import { AllCRMProperties, NewCRMNoteButton } from "@/components/crm-record-tools";
import { QualificationProperties } from "@/components/qualification-properties";
import { formatDate, initials } from "@/lib/utils";

type Kind = "contact" | "company";
type ActivityTab = "notes" | "calls" | "meetings" | "tasks";

type Props = {
  kind: Kind;
  recordId: string;
};

const TAB_LABELS: Array<{ value: ActivityTab; label: string }> = [
  { value: "notes", label: "Notes" },
  { value: "calls", label: "Appels" },
  { value: "meetings", label: "Rendez-vous" },
  { value: "tasks", label: "Tâches" },
];

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

function Info({ label, value, icon: Icon }: { label: string; value?: string | null; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Icon size={13} /> {label}</div>
      <div className="mt-1.5 break-words text-sm font-medium">{value || "—"}</div>
    </div>
  );
}

function NoteCard({ note, owners }: { note: any; owners: Record<string, string> }) {
  const p = note.properties || {};
  const body = plainText(p.hs_note_body);
  const date = p.hs_timestamp || p.hs_createdate || note.createdAt;
  const source = note.sourceContactName || (note.sourceType === "company" ? "Entreprise" : "Contact");
  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold"><FileText size={15} className="text-primary" /> Note HubSpot</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{source}</span>
            <span>{ownerLabel(owners, p.hubspot_owner_id)}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{date ? formatDate(date) : "Date inconnue"}</div>
      </div>
      <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
        {body || "Note vide."}
      </div>
    </article>
  );
}

function CallCard({ call, owners }: { call: any; owners: Record<string, string> }) {
  const p = call.properties || {};
  const body = plainText(p.hs_call_body);
  const summary = plainText(p.hs_call_summary);
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="font-semibold">{p.hs_call_title || "Appel"}</div><div className="mt-1 text-xs text-muted-foreground">{call.sourceContactName || ownerLabel(owners, p.hubspot_owner_id)}</div></div>
        <div className="text-xs text-muted-foreground">{p.hs_timestamp ? formatDate(p.hs_timestamp) : "—"}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{p.hs_call_disposition ? <Badge variant="outline">{p.hs_call_disposition}</Badge> : null}{p.hs_call_status ? <Badge variant="outline">{p.hs_call_status}</Badge> : null}</div>
      {body ? <div className="mt-4"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Notes de l’appel</div><div className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{body}</div></div> : null}
      {summary ? <div className="mt-4 rounded-lg bg-muted/55 p-3"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Synthèse HubSpot</div><div className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{summary}</div></div> : null}
    </article>
  );
}

function MeetingCard({ meeting }: { meeting: any }) {
  const p = meeting.properties || {};
  const notes = plainText(p.hs_internal_meeting_notes);
  const date = meeting.derived?.startAt || p.hs_meeting_start_time || p.hs_timestamp;
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="font-semibold">{p.hs_meeting_title || "Rendez-vous"}</div><div className="text-xs text-muted-foreground">{date ? formatDate(date) : "—"}</div></div>
      <div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="outline">{meeting.derived?.status || p.hs_meeting_outcome || "À traiter"}</Badge>{meeting.sourceContactName ? <Badge variant="outline">{meeting.sourceContactName}</Badge> : null}</div>
      {notes ? <div className="mt-4 whitespace-pre-wrap text-sm leading-6">{notes}</div> : null}
      {p.hs_meeting_location ? <div className="mt-3 text-xs text-muted-foreground">{p.hs_meeting_location}</div> : null}
    </article>
  );
}

function TaskCard({ task, owners }: { task: any; owners: Record<string, string> }) {
  const p = task.properties || {};
  const body = plainText(p.hs_task_body);
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="font-semibold">{p.hs_task_subject || "Tâche"}</div><div className="text-xs text-muted-foreground">{p.hs_timestamp ? formatDate(p.hs_timestamp) : "—"}</div></div>
      <div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="outline">{p.hs_task_status || "À faire"}</Badge><Badge variant="outline">{ownerLabel(owners, p.hubspot_owner_id)}</Badge></div>
      {body ? <div className="mt-3 whitespace-pre-wrap text-sm leading-6">{body}</div> : null}
    </article>
  );
}

export function CRMRecordPage({ kind, recordId }: Props) {
  const [data, setData] = useState<any>(null);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ActivityTab>("notes");

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
  const activities = data?.[tab] || [];
  const counts = data?.activitySummary || { notes: data?.notes?.length || 0, calls: data?.calls?.length || 0, meetings: data?.meetings?.length || 0, tasks: data?.tasks?.length || 0 };

  const linkedRecords = useMemo(() => kind === "company" ? data?.contacts || [] : data?.companies || [], [data, kind]);
  const associatedPhoneRecord = kind === "company"
    ? linkedRecords.find((item: any) => item?.properties?.phone || item?.properties?.mobilephone)
    : null;
  const associatedPhone = associatedPhoneRecord?.properties?.phone || associatedPhoneRecord?.properties?.mobilephone || "";
  const effectivePhone = p.phone || p.mobilephone || associatedPhone;
  const phoneLabel = p.phone || p.mobilephone ? "Téléphone" : associatedPhone ? "Téléphone contact associé" : "Téléphone";

  return (
    <div className="page-shell min-h-screen p-4 sm:p-6 lg:p-7">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/prospection"><ArrowLeft size={14} /> Retour à la prospection</Link></Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser HubSpot</Button>
        </div>

        {loading ? <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div> : error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 text-sm text-destructive">{error}</div>
        ) : (
          <div className="space-y-5">
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex min-w-0 items-start gap-4">
                  <Avatar className="h-14 w-14 shrink-0 rounded-xl border border-border bg-muted"><AvatarFallback className="rounded-xl bg-muted text-primary">{kind === "company" ? <Building2 size={25} /> : initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                  <div className="min-w-0"><div className="text-xs font-bold uppercase tracking-[0.15em] text-primary">{kind === "company" ? "Entreprise" : "Contact"}</div><h1 className="mt-1 break-words font-display text-2xl font-bold tracking-tight">{name}</h1><div className="mt-1 text-sm text-muted-foreground">{subtitle || "Fiche CRM HubSpot"}</div><div className="mt-3 flex flex-wrap gap-1.5">{p.statut_prospection ? <Badge>{p.statut_prospection}</Badge> : null}{p.statut_de_lappel ? <Badge variant="outline">{p.statut_de_lappel}</Badge> : null}<Badge variant="outline"><History size={11} /> {counts.notes + counts.calls + counts.meetings + counts.tasks} activités</Badge></div></div>
                </div>
                <div className="flex flex-wrap gap-2"><NewCRMNoteButton kind={kind} recordId={recordId} onCreated={async () => { setTab("notes"); await load(); }} /><ProfileSourcingButton entityType={kind} entityId={recordId} onCompleted={load} label="Enrichir cette fiche" />{effectivePhone ? <Button asChild><a href={`tel:${effectivePhone}`}><Phone size={14} /> Appeler</a></Button> : null}{p.email ? <Button asChild variant="outline"><a href={`mailto:${p.email}`}><Mail size={14} /> Email</a></Button> : null}{kind === "company" && (p.website || p.domain) ? <Button asChild variant="outline"><a href={(p.website || "").startsWith("http") ? p.website : `https://${p.domain || p.website}`} target="_blank" rel="noreferrer"><Globe size={14} /> Site web</a></Button> : null}</div>
              </div>
            </Card>

            <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
              <div className="space-y-5">
                <Card className="p-4"><div className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Informations</div><div className="grid gap-2">
                  <Info icon={UserRound} label="Commercial" value={ownerLabel(owners, p.hubspot_owner_id)} />
                  <Info icon={Phone} label={phoneLabel} value={effectivePhone} />
                  {kind === "contact" ? <Info icon={Mail} label="Email" value={p.email} /> : <Info icon={Globe} label="Domaine" value={p.domain || p.website} />}
                  <Info icon={MapPin} label="Localisation" value={[p.zip, p.city, p.state, p.country].filter(Boolean).join(" · ")} />
                  <Info icon={Clock} label="Dernière activité" value={p.hs_last_sales_activity_timestamp ? formatDate(p.hs_last_sales_activity_timestamp) : undefined} />
                </div></Card>

                <Card className="p-4"><QualificationProperties kind={kind} properties={{ ...p, __hubspot_id: p.__hubspot_id || recordId }} fallbackProperties={kind === "company" ? (data?.contacts?.[0]?.properties || {}) : {}} /></Card>

                <Card className="p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{kind === "company" ? <Users size={14} /> : <Building2 size={14} />} {kind === "company" ? "Contacts associés" : "Entreprises associées"}</div><div className="space-y-2">{linkedRecords.length ? linkedRecords.map((item: any) => { const lp = item.properties || {}; const label = kind === "company" ? [lp.firstname, lp.lastname].filter(Boolean).join(" ") || lp.email || "Contact" : lp.name || lp.domain || "Entreprise"; const href = kind === "company" ? `/contacts/${item.id}` : `/companies/${item.id}`; return <Link key={item.id} href={href} className="block rounded-lg border border-border bg-muted/25 p-3 transition hover:border-primary/30 hover:bg-muted/50"><div className="truncate text-sm font-semibold">{label}</div><div className="mt-1 truncate text-xs text-muted-foreground">{kind === "company" ? lp.phone || lp.mobilephone || lp.jobtitle || lp.email : lp.domain || lp.city}</div></Link>; }) : <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Aucun élément associé.</div>}</div></Card>
                <AllCRMProperties kind={kind} recordId={recordId} />
              </div>

              <Card className="min-w-0 overflow-hidden">
                <div className="border-b border-border p-4 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">Historique complet</div><div className="mt-0.5 text-xs text-muted-foreground">Les notes sont affichées intégralement, sans résumé ni troncature.</div></div><div className="flex flex-wrap rounded-lg border border-border bg-muted/30 p-0.5">{TAB_LABELS.map(item => <button key={item.value} onClick={() => setTab(item.value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${tab === item.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{item.label} <span className="ml-1 opacity-60">{counts[item.value] || 0}</span></button>)}</div></div>
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  {activities.length ? activities.map((activity: any) => tab === "notes" ? <NoteCard key={activity.id} note={activity} owners={owners} /> : tab === "calls" ? <CallCard key={activity.id} call={activity} owners={owners} /> : tab === "meetings" ? <MeetingCard key={activity.id} meeting={activity} /> : <EditableCRMTaskCard key={activity.id} task={activity} ownerName={ownerLabel(owners, activity.properties?.hubspot_owner_id)} onUpdated={load} />) : <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Aucun élément dans cette catégorie.</div>}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
