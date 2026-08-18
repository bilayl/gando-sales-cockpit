"use client";

import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Globe,
  ListTodo,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  PhoneOutgoing,
  Plus,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { PostCallEmailButton } from "@/components/post-call-email-button";
import { QualificationProperties } from "@/components/qualification-properties";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type Props = {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

type CallActivity = {
  id: string;
  date?: string;
  type: "Appel";
  title: string;
  status?: string;
  disposition?: string;
  body?: string;
  transcription: string;
};

type GenericActivity = {
  id: string;
  date?: string;
  type: "RDV" | "Tâche";
  title: string;
  status?: string;
  disposition?: string;
  body?: string;
  transcription: "";
};

type Activity = CallActivity | GenericActivity;

const PROSPECTION_STATUSES = ["À prospecter", "En prospection", "Conversation", "RDV booké", "À recycler", "Non qualifié", "Perdu"];
const CALL_STATUSES = ["Intéressé", "Intéressé mais", "A une date ultérieure", "A Rappeler", "pas intéressé", "Occupé", "NRP", "HORS CIBLE", "En attente décision", "Autres", "Numéro invalide"];
const RESULT_STATUSES = ["", "Contact", "Intéressé", "Devis envoyé", "RDV", "Signé", "Perdu"];

function SectionTitle({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon size={14} className="text-primary" />
        {title}
        {count !== undefined ? (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span>
        ) : null}
      </h3>
      {action}
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/80 py-2.5">
      <Icon size={15} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium" title={value || ""}>{value || "—"}</div>
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  icon: Icon,
  onSave,
}: {
  label: string;
  value?: string | null;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  async function commit() {
    if (!editingRef.current || busy) return;
    const next = draft.trim();
    if (next === (value ?? "")) {
      editingRef.current = false;
      setEditing(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(next);
      editingRef.current = false;
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d'enregistrer");
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    editingRef.current = true;
    setEditing(true);
  }

  function cancelEdit() {
    editingRef.current = false;
    setEditing(false);
  }

  return (
    <div className="group flex items-center gap-3 border-b border-border/80 py-2.5">
      <Icon size={15} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {editing ? (
          <div className="mt-1">
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") void commit();
                  if (event.key === "Escape") cancelEdit();
                }}
                onBlur={() => void commit()}
                className="h-8 text-sm"
              />
              {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" /> : null}
            </div>
            {error ? <p className="mt-1 text-[11px] font-medium text-destructive">{error}</p> : null}
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="mt-0.5 flex w-full items-center justify-between gap-2 text-left text-sm font-medium hover:text-primary"
            title={`Modifier ${label.toLowerCase()}`}
          >
            <span className="truncate">{value || "—"}</span>
            <Pencil size={12} className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </div>
    </div>
  );
}

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function noteBodyText(value?: string | null) {
  if (!value) return "";
  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(value, "text/html");
    parsed.querySelectorAll("script, style, iframe, object, embed").forEach(element => element.remove());
    return parsed.body.textContent?.trim() || "";
  }
  return value
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isTaskDone(status?: string | null) {
  return ["COMPLETED", "DONE"].includes(String(status || "").toUpperCase());
}

export function ContactDrawer({ contactId, open, onOpenChange, onUpdated }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [actType, setActType] = useState<"call" | "task" | "meeting">("call");
  const [actTitle, setActTitle] = useState("");
  const [actBody, setActBody] = useState("");
  const [actDate, setActDate] = useState("");
  const [actStatus, setActStatus] = useState("");
  const [savingAct, setSavingAct] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/contacts/${id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de charger la fiche");
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger la fiche");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !contactId) return;
    setData(null);
    fetch("/api/owners")
      .then(response => response.json())
      .then((payload: any) => {
        setOwners(Object.fromEntries((payload.results || []).map((owner: any) => [
          owner.id,
          [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || owner.id,
        ])));
      })
      .catch(() => {});
    void load(contactId);
  }, [open, contactId, load]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const p = data?.contact?.properties || {};
  const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || "Contact";
  const company = data?.companies?.[0]?.properties || (p.company ? { name: p.company } : {});
  const ownerName = owners[p.hubspot_owner_id] || "";

  const notes = useMemo(
    () => (data?.notes || []).slice().sort((a: any, b: any) =>
      String(b.properties?.hs_timestamp || b.createdAt).localeCompare(String(a.properties?.hs_timestamp || a.createdAt))),
    [data],
  );

  const sentEmailCallIds = useMemo(() => {
    const ids = new Set<string>();
    for (const note of notes) {
      const text = noteBodyText(note.properties?.hs_note_body);
      const match = text.match(/\[GANDO_POST_CALL_EMAIL:([^\]]+)\]/);
      if (match?.[1]) ids.add(match[1]);
    }
    return ids;
  }, [notes]);

  const calls = useMemo<CallActivity[]>(() => (data?.calls || []).map((call: any) => {
    const date = call.properties?.hs_timestamp;
    const callTime = date ? new Date(date).getTime() : Number.NaN;
    const body = call.properties?.hs_call_body || "";
    const nearbyTranscript = Number.isFinite(callTime)
      ? notes
          .map((note: any) => {
            const text = noteBodyText(note.properties?.hs_note_body);
            const noteDate = note.properties?.hs_timestamp || note.createdAt;
            const noteTime = noteDate ? new Date(noteDate).getTime() : Number.NaN;
            return { text, delta: Number.isFinite(noteTime) ? noteTime - callTime : Number.POSITIVE_INFINITY };
          })
          .filter((note: { text: string; delta: number }) =>
            note.text.length >= 80 &&
            !note.text.startsWith("[GANDO_POST_CALL_EMAIL:") &&
            note.delta >= -10 * 60 * 1000 &&
            note.delta <= 12 * 60 * 60 * 1000,
          )
          .sort((a: { delta: number }, b: { delta: number }) => Math.abs(a.delta) - Math.abs(b.delta))[0]?.text || ""
      : "";
    return {
      id: String(call.id),
      date,
      type: "Appel" as const,
      title: call.properties?.hs_call_title || "Appel",
      status: call.properties?.hs_call_status,
      disposition: call.properties?.hs_call_disposition,
      body,
      transcription: nearbyTranscript || (body.length >= 80 ? body : ""),
    };
  }).sort((a: CallActivity, b: CallActivity) => String(b.date || "").localeCompare(String(a.date || ""))), [data, notes]);

  const hubspotTasks = useMemo(() => (data?.tasks || []).map((task: any) => ({
    id: String(task.id),
    date: task.properties?.hs_timestamp,
    title: task.properties?.hs_task_subject || "Tâche",
    status: task.properties?.hs_task_status,
    body: task.properties?.hs_task_body,
  })).sort((a: any, b: any) => String(b.date || "").localeCompare(String(a.date || ""))), [data]);

  const emailTasks = useMemo(
    () => calls.filter(call => call.transcription && !sentEmailCallIds.has(call.id)).slice(0, 3),
    [calls, sentEmailCallIds],
  );

  const activities = useMemo<Activity[]>(() => {
    const meetings: GenericActivity[] = (data?.meetings || []).map((meeting: any) => ({
      id: String(meeting.id),
      date: meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp,
      type: "RDV" as const,
      title: meeting.properties?.hs_meeting_title || "Rendez-vous",
      status: meeting.properties?.hs_meeting_outcome,
      disposition: "",
      body: "",
      transcription: "",
    }));
    const tasks: GenericActivity[] = hubspotTasks.map((task: any) => ({
      id: task.id,
      date: task.date,
      type: "Tâche" as const,
      title: task.title,
      status: task.status,
      disposition: "",
      body: task.body,
      transcription: "",
    }));
    return [...calls, ...meetings, ...tasks]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 8);
  }, [calls, data, hubspotTasks]);

  const openTaskCount = hubspotTasks.filter((task: any) => !isTaskDone(task.status)).length + (p.email ? emailTasks.length : 0);

  async function patch(key: string, value: string) {
    if (!contactId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties: { [key]: value } }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "HubSpot a rejeté la modification");
      }
      setData((current: any) => ({
        ...current,
        contact: { ...current.contact, properties: { ...current.contact.properties, [key]: value } },
      }));
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!contactId || !noteDraft.trim()) return;
    setSavingNote(true);
    setError("");
    try {
      const body = noteDraft.trim();
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "note", properties: { hs_note_body: body } }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Impossible d'ajouter la note");
      }
      const created = await response.json();
      setData((current: any) => ({
        ...current,
        notes: [...(current?.notes || []), {
          id: created.id,
          properties: {
            hs_note_body: body,
            hs_timestamp: new Date().toISOString(),
            hs_createdate: new Date().toISOString(),
          },
        }],
      }));
      setNoteDraft("");
      onUpdated?.();
      toast.success("Note ajoutée au contact dans HubSpot.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible d'ajouter la note";
      setError(message);
      toast.error(message);
    } finally {
      setSavingNote(false);
    }
  }

  function openActivity(preferredType?: "call" | "task" | "meeting") {
    setActOpen(value => {
      const next = !value || Boolean(preferredType);
      if (next) {
        const date = new Date();
        setActType(preferredType || "call");
        setActTitle(preferredType === "task" ? "" : "");
        setActBody("");
        setActStatus("");
        setActDate(toLocalInput(date));
      }
      return preferredType ? true : !value;
    });
  }

  async function createActivity() {
    if (!contactId) return;
    setSavingAct(true);
    setError("");
    try {
      const properties: Record<string, string> = {};
      const now = new Date().toISOString();
      if (actType === "call") {
        properties.hs_timestamp = actDate ? new Date(actDate).toISOString() : now;
        properties.hs_call_title = actTitle.trim() || "Appel";
        if (actBody.trim()) properties.hs_call_body = actBody.trim();
        properties.hs_call_status = "COMPLETED";
        if (actStatus) properties.hs_call_disposition = actStatus;
      } else if (actType === "task") {
        properties.hs_timestamp = actDate ? new Date(actDate).toISOString() : now;
        properties.hs_task_subject = actTitle.trim() || "Tâche";
        if (actBody.trim()) properties.hs_task_body = actBody.trim();
        properties.hs_task_status = "NOT_STARTED";
      } else {
        const start = actDate ? new Date(actDate).toISOString() : now;
        properties.hs_timestamp = start;
        properties.hs_meeting_title = actTitle.trim() || "Rendez-vous";
        properties.hs_meeting_start_time = start;
        if (actBody.trim()) properties.hs_meeting_location = actBody.trim();
      }

      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: actType, properties }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Impossible de créer l'activité");
      }
      const created = await response.json();
      const listKey = actType === "call" ? "calls" : actType === "task" ? "tasks" : "meetings";
      setData((current: any) => ({
        ...current,
        [listKey]: [...(current?.[listKey] || []), { id: created.id, properties }],
      }));
      setActOpen(false);
      onUpdated?.();
      toast.success(actType === "call" ? "Appel enregistré sur le contact." : actType === "task" ? "Tâche créée sur le contact." : "Rendez-vous créé sur le contact.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible de créer l'activité";
      setError(message);
      toast.error(message);
    } finally {
      setSavingAct(false);
    }
  }

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]" onClick={() => onOpenChange(false)} />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_28px_80px_-34px_rgba(15,35,42,0.42)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar className="h-11 w-11 shrink-0 rounded-lg border border-border bg-muted">
              <AvatarFallback className="rounded-lg bg-muted text-base font-bold text-primary">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-tight tracking-tight">{name}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Building2 size={13} className="shrink-0" /> {company?.name || "Aucune entreprise"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {ownerName ? <Badge variant="outline" className="gap-1 text-xs"><UserRound size={11} /> {ownerName}</Badge> : null}
                {p.hs_object_source_label ? <Badge variant="outline" className="gap-1 text-xs text-muted-foreground"><Globe size={11} /> {p.hs_object_source_label}</Badge> : null}
              </div>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto minari-scrollbar">
          {loading ? (
            <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : error ? (
            <div className="m-5 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
          ) : (
            <div className="grid min-h-full lg:grid-cols-[390px_1fr]">
              <div className="space-y-6 bg-muted/45 p-5 lg:border-r lg:border-border">
                <div className="flex gap-2">
                  <Button asChild className="flex-1"><a href={p.phone || p.mobilephone ? `tel:${p.phone || p.mobilephone}` : "#"}><Phone size={15} /> Appeler</a></Button>
                  <Button variant="outline" asChild className="flex-1"><a href={p.email ? `mailto:${p.email}` : "#"}><Mail size={15} /> Email</a></Button>
                </div>

                <section>
                  <SectionTitle
                    icon={UserRound}
                    title="Coordonnées"
                    action={saving ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Sync…</span> : undefined}
                  />
                  <div className="mt-2 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <EditableField icon={UserRound} label="Prénom" value={p.firstname} onSave={value => patch("firstname", value)} />
                    <EditableField icon={UserRound} label="Nom" value={p.lastname} onSave={value => patch("lastname", value)} />
                    <EditableField icon={Phone} label="Téléphone" value={p.phone} onSave={value => patch("phone", value)} />
                    <EditableField icon={PhoneCall} label="Mobile" value={p.mobilephone} onSave={value => patch("mobilephone", value)} />
                    <EditableField icon={Mail} label="Email" value={p.email} onSave={value => patch("email", value)} />
                    <EditableField icon={UserRound} label="Fonction" value={p.jobtitle} onSave={value => patch("jobtitle", value)} />
                    <EditableField icon={MapPin} label="Ville" value={p.city} onSave={value => patch("city", value)} />
                    <EditableField icon={MapPin} label="Région" value={p.state} onSave={value => patch("state", value)} />
                    <InfoRow icon={CalendarClock} label="Créé le" value={p.createdate ? formatDate(p.createdate) : undefined} />
                    <InfoRow icon={Clock} label="Dernier contact" value={(p.notes_last_contacted || p.hs_last_sales_activity_timestamp) ? formatDate(p.notes_last_contacted || p.hs_last_sales_activity_timestamp) : undefined} />
                    <InfoRow icon={PhoneOutgoing} label="Nombre de tentatives" value={String(Number(p.minari_call_count || 0))} />
                    <InfoRow icon={FileText} label="Motif de relance" value={p.referly_reason_to_reach_out} />
                  </div>
                </section>

                <QualificationProperties kind="contact" properties={p} />

                {company?.name ? (
                  <section>
                    <SectionTitle icon={Building2} title="Entreprise" />
                    <div className="mt-3 rounded-lg border border-border bg-card p-4">
                      <div className="font-semibold text-foreground">{company.name}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
                        {company.domain ? <span className="flex items-center gap-1.5 text-muted-foreground"><Globe size={12} /> {company.domain}</span> : null}
                        {company.phone ? <span className="flex items-center gap-1.5 text-muted-foreground"><PhoneCall size={12} /> {company.phone}</span> : null}
                        {[company.city, company.state].filter(Boolean).length ? <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin size={12} /> {[company.city, company.state].filter(Boolean).join(", ")}</span> : null}
                      </div>
                    </div>
                  </section>
                ) : null}

                <section>
                  <SectionTitle
                    icon={SlidersHorizontal}
                    title="Gestion"
                    action={saving ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Sync…</span> : undefined}
                  />
                  <div className="mt-3 grid gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Statut prospection</Label>
                      <Select value={p.statut_prospection || "none"} onValueChange={value => { void patch("statut_prospection", value === "none" ? "" : value); }}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent><SelectItem value="none">—</SelectItem>{PROSPECTION_STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Statut appel</Label>
                      <Select value={p.statut_de_lappel || "none"} onValueChange={value => { void patch("statut_de_lappel", value === "none" ? "" : value); }}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent><SelectItem value="none">—</SelectItem>{CALL_STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Résultat prospection</Label>
                      <Select value={p.resultat_prospection || "none"} onValueChange={value => { void patch("resultat_prospection", value === "none" ? "" : value); }}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent><SelectItem value="none">—</SelectItem>{RESULT_STATUSES.map(status => <SelectItem key={status} value={status}>{status || "Non défini"}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Commercial</Label>
                      <Select value={p.hubspot_owner_id || "none"} onValueChange={value => { void patch("hubspot_owner_id", value === "none" ? "" : value); }}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent><SelectItem value="none">—</SelectItem>{Object.entries(owners).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Prochaine relance</Label>
                      <Input
                        type="datetime-local"
                        value={p.date_prochaine_relance ? toLocalInput(new Date(p.date_prochaine_relance)) : ""}
                        onChange={event => {
                          const date = event.target.value ? new Date(event.target.value) : null;
                          void patch("date_prochaine_relance", date && !Number.isNaN(date.getTime()) ? date.toISOString() : "");
                        }}
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-7 bg-card p-5 lg:p-6">
                <section>
                  <SectionTitle
                    icon={ListTodo}
                    title="Tâches"
                    count={openTaskCount}
                    action={(
                      <button
                        onClick={() => openActivity("task")}
                        className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-muted"
                      >
                        <Plus size={12} /> Nouvelle tâche
                      </button>
                    )}
                  />
                  <div className="mt-3 space-y-2">
                    {p.email && emailTasks.map(call => (
                      <div key={`email-${call.id}`} className="rounded-lg border border-primary/25 bg-primary/[0.045] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Mail size={15} /></span>
                              <div className="min-w-0">
                                <div className="text-sm font-bold">Envoyer l’email de récap</div>
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">Après {call.title} · {call.date ? formatDate(call.date) : "appel récent"}</div>
                              </div>
                            </div>
                            <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{call.transcription}</p>
                          </div>
                          <Badge className="shrink-0">À faire</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-primary/15 pt-3">
                          <span className="text-xs text-muted-foreground">Destinataire : {p.email}</span>
                          {contactId ? (
                            <PostCallEmailButton
                              contactId={contactId}
                              callId={call.id}
                              email={p.email}
                              firstName={p.firstname}
                              companyName={company?.name}
                              senderName={ownerName}
                              callTitle={call.title}
                              callBody={call.body}
                              transcription={call.transcription}
                              onSent={() => { if (contactId) void load(contactId); }}
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {hubspotTasks.filter((task: any) => !isTaskDone(task.status)).slice(0, 4).map((task: any) => (
                      <div key={`task-${task.id}`} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-semibold"><ListTodo size={14} className="text-primary" /> <span className="truncate">{task.title}</span></div>
                            {task.body ? <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.body}</p> : null}
                            {task.date ? <div className="mt-1.5 text-[11px] text-muted-foreground">{formatDate(task.date)}</div> : null}
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{task.status || "À faire"}</Badge>
                        </div>
                      </div>
                    ))}

                    {!p.email && emailTasks.length ? (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground">Une transcription est disponible, mais ce contact n’a pas d’adresse email.</div>
                    ) : null}

                    {!emailTasks.length && !hubspotTasks.some((task: any) => !isTaskDone(task.status)) ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Aucune tâche en attente pour ce contact.</div>
                    ) : null}
                  </div>
                </section>

                <section>
                  <SectionTitle
                    icon={FileText}
                    title="Notes commerciales"
                    count={notes.length}
                    action={notes.length > 3 ? (
                      <button onClick={() => setShowAllNotes(value => !value)} className="text-xs font-medium text-primary hover:underline">
                        {showAllNotes ? "Voir moins" : "Tout afficher"}
                      </button>
                    ) : undefined}
                  />
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg border border-border bg-muted/45 p-3">
                      <textarea
                        value={noteDraft}
                        onChange={event => setNoteDraft(event.target.value)}
                        placeholder="Ajouter une note commerciale…"
                        className="min-h-[72px] w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary/55 focus:outline-none focus:ring-2 focus:ring-ring/15"
                      />
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" className="gap-1.5" disabled={!noteDraft.trim() || savingNote} onClick={() => void addNote()}>
                          {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter la note
                        </Button>
                      </div>
                    </div>
                    {(showAllNotes ? notes : notes.slice(0, 3)).map((note: any, index: number) => (
                      <div key={note.id || index} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="font-mono">{formatDate(note.properties?.hs_timestamp || note.createdAt)}</span><ArrowUpRight size={13} /></div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-card-foreground">{noteBodyText(note.properties?.hs_note_body)}</div>
                      </div>
                    ))}
                    {!notes.length ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucune note associée.</div> : null}
                  </div>
                </section>

                <section>
                  <SectionTitle
                    icon={CalendarClock}
                    title="Activité"
                    count={activities.length}
                    action={(
                      <button onClick={() => openActivity()} className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-muted">
                        {actOpen ? <X size={12} /> : <Plus size={12} />} {actOpen ? "Fermer" : "Loguer"}
                      </button>
                    )}
                  />

                  {actOpen ? (
                    <div className="mt-3 rounded-lg border border-border bg-muted/45 p-3">
                      <div className="grid gap-2.5">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Type</Label>
                            <Select value={actType} onValueChange={value => setActType(value as "call" | "task" | "meeting")}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="call">Appel</SelectItem>
                                <SelectItem value="task">Tâche</SelectItem>
                                <SelectItem value="meeting">Rendez-vous</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">{actType === "call" ? "Résultat" : "Priorité"}</Label>
                            {actType === "call" ? (
                              <Select value={actStatus || "none"} onValueChange={value => setActStatus(value === "none" ? "" : value)}>
                                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent><SelectItem value="none">—</SelectItem>{CALL_STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : (
                              <Select value={actType === "task" ? "MEDIUM" : "confirmed"} onValueChange={() => {}}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="MEDIUM">—</SelectItem><SelectItem value="confirmed">Confirmé</SelectItem></SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Titre</Label>
                          <Input value={actTitle} onChange={event => setActTitle(event.target.value)} placeholder={actType === "call" ? "Intitulé de l'appel" : actType === "task" ? "Intitulé de la tâche" : "Intitulé du rendez-vous"} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">{actType === "meeting" ? "Lieu" : "Détails"}</Label>
                          <textarea
                            value={actBody}
                            onChange={event => setActBody(event.target.value)}
                            placeholder={actType === "meeting" ? "Adresse ou lien de visio…" : "Notes libres…"}
                            className="min-h-[56px] w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary/55 focus:outline-none focus:ring-2 focus:ring-ring/15"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Date</Label>
                          <Input type="datetime-local" value={actDate} onChange={event => setActDate(event.target.value)} />
                        </div>
                        {savingAct ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Création…</span> : null}
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setActOpen(false)}>Annuler</Button>
                          <Button size="sm" className="gap-1.5" disabled={savingAct} onClick={() => void createActivity()}>
                            {actType === "call" ? <PhoneOutgoing size={14} /> : actType === "task" ? <ListTodo size={14} /> : <CalendarPlus size={14} />}
                            {actType === "call" ? "Loguer l'appel" : actType === "task" ? "Créer la tâche" : "Créer le RDV"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1 minari-scrollbar">
                    {activities.map(activity => (
                      <div key={`${activity.type}-${activity.id}`} className="rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/35">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            {activity.type === "Appel" ? <PhoneCall size={14} className="shrink-0 text-primary" /> : activity.type === "RDV" ? <CalendarClock size={14} className="shrink-0 text-emerald-300" /> : <Circle size={14} className="shrink-0 text-sky-300" />}
                            <span className="truncate">{activity.title}</span>
                          </span>
                          <Badge variant={activity.type === "RDV" ? "default" : "outline"} className="shrink-0 font-medium">{activity.type}</Badge>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{activity.date ? formatDate(activity.date) : "—"}</span>
                        </div>
                        {(activity.status || activity.disposition) ? (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 size={11} className="text-primary" /> {[activity.status, activity.disposition].filter(Boolean).join(" · ")}
                          </div>
                        ) : null}
                        {activity.body ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-card-foreground/80">{activity.body}</p> : null}
                        {activity.type === "Appel" && activity.transcription ? <div className="mt-2 text-[11px] font-medium text-muted-foreground">Transcription disponible · l’action email est dans la section Tâches.</div> : null}
                      </div>
                    ))}
                    {!activities.length ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucune activité enregistrée.</div> : null}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
