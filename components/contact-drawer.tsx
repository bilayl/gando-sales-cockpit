"use client";
import { Mail, Phone, Building2, CalendarClock, FileText, Loader2, ArrowUpRight, Globe, MapPin, UserRound, Clock, PhoneCall, Circle, CheckCircle2, X, SlidersHorizontal, Pencil, Plus, PhoneOutgoing, ListTodo, CalendarPlus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { contactId: string | null; open: boolean; onOpenChange: (open: boolean)=>void; onUpdated?: ()=>void };

const PROSPECTION_STATUSES = ["À prospecter", "En prospection", "Conversation", "RDV booké", "À recycler", "Non qualifié", "Perdu"];
const CALL_STATUSES = ["Intéressé", "Intéressé mais", "A une date ultérieure", "A Rappeler", "pas intéressé", "Occupé", "NRP", "HORS CIBLE", "En attente décision", "Autres", "Numéro invalide"];
const RESULT_STATUSES = ["", "Contact", "Intéressé", "Devis envoyé", "RDV", "Signé", "Perdu"];

function SectionTitle({ icon: Icon, title, count, action }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-wider text-foreground">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-300"><Icon size={14} /></span>
        {title}
        {count !== undefined ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span> : null}
      </h3>
      {action}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <Icon size={15} className="shrink-0 text-violet-300" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium" title={value || ""}>{value || "—"}</div>
      </div>
    </div>
  );
}

function EditableField({ label, value, icon: Icon, onSave }: { label: string; value?: string | null; icon: React.ComponentType<{ size?: number; className?: string }>; onSave: (value: string) => Promise<void> }) {
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
    if (next === (value ?? "")) { editingRef.current = false; setEditing(false); return; }
    setBusy(true);
    setError("");
    try {
      await onSave(next);
      editingRef.current = false;
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer");
    } finally {
      setBusy(false);
    }
  }

  function startEdit() { editingRef.current = true; setEditing(true); }
  function cancelEdit() { editingRef.current = false; setEditing(false); }

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <Icon size={15} className="shrink-0 text-violet-300" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {editing ? (
          <div className="mt-1">
            <div className="flex items-center gap-1.5">
              <Input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancelEdit(); }}
                onBlur={() => commit()} className="h-8 text-sm" />
              {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-300" /> : null}
            </div>
            {error ? <p className="mt-1 text-[11px] font-medium text-destructive">{error}</p> : null}
          </div>
        ) : (
          <button onClick={startEdit} className="mt-0.5 flex w-full items-center justify-between gap-2 text-left text-sm font-medium hover:text-violet-200" title={`Modifier ${label.toLowerCase()}`}>
            <span className="truncate">{value || "—"}</span>
            <Pencil size={12} className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </div>
    </div>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContactDrawer({contactId, open, onOpenChange, onUpdated}: Props) {
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
      const r = await fetch(`/api/contacts/${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Impossible de charger la fiche");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger la fiche");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !contactId) return;
    setData(null);
    fetch("/api/owners").then(r => r.json()).then((o: any) => {
      setOwners(Object.fromEntries((o.results || []).map((x: any) => [x.id, [x.firstName, x.lastName].filter(Boolean).join(" ") || x.email || x.id])));
    }).catch(() => {});
    load(contactId);
  }, [open, contactId, load]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const p = data?.contact?.properties || {};
  const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || "Contact";
  const company = data?.companies?.[0]?.properties || (p.company ? { name: p.company } : {});
  const ownerName = owners[p.hubspot_owner_id] || "";

  const notes = useMemo(() => (data?.notes || []).slice().sort((a: any, b: any) => String(b.properties?.hs_timestamp || b.createdAt).localeCompare(String(a.properties?.hs_timestamp || a.createdAt))), [data]);

  const activities = useMemo(() => {
    const calls = (data?.calls || []).map((x: any) => ({
      date: x.properties?.hs_timestamp,
      type: "Appel" as const,
      title: x.properties?.hs_call_title || "Appel",
      status: x.properties?.hs_call_status,
      disposition: x.properties?.hs_call_disposition,
      body: x.properties?.hs_call_body,
    }));
    const meetings = (data?.meetings || []).map((x: any) => ({
      date: x.properties?.hs_meeting_start_time || x.properties?.hs_timestamp,
      type: "RDV" as const,
      title: x.properties?.hs_meeting_title || "Rendez-vous",
      status: x.properties?.hs_meeting_outcome,
      disposition: "",
      body: "",
    }));
    const tasks = (data?.tasks || []).map((x: any) => ({
      date: x.properties?.hs_timestamp,
      type: "Tâche" as const,
      title: x.properties?.hs_task_subject || "Tâche",
      status: x.properties?.hs_task_status,
      disposition: "",
      body: x.properties?.hs_task_body,
    }));
    return [...calls, ...meetings, ...tasks].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
  }, [data]);

  async function patch(key: string, value: string) {
    if (!contactId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/contacts/${contactId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ properties: { [key]: value } }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "HubSpot a rejeté la modification");
      }
      setData((d: any) => ({ ...d, contact: { ...d.contact, properties: { ...d.contact.properties, [key]: value } } }));
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
      const r = await fetch(`/api/contacts/${contactId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "note", properties: { hs_note_body: body } }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Impossible d'ajouter la note");
      }
      const created = await r.json();
      setData((d: any) => ({ ...d, notes: [...(d?.notes || []), { id: created.id, properties: { hs_note_body: body, hs_timestamp: new Date().toISOString(), hs_createdate: new Date().toISOString() } }] }));
      setNoteDraft("");
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter la note");
    } finally {
      setSavingNote(false);
    }
  }

  function openActivity() {
    setActOpen(v => {
      if (!v) {
        const d = new Date();
        setActType("call");
        setActTitle("");
        setActBody("");
        setActStatus("");
        setActDate(toLocalInput(d));
      }
      return !v;
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
      const r = await fetch(`/api/contacts/${contactId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: actType, properties }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Impossible de créer l'activité");
      }
      const created = await r.json();
      const listKey = actType === "call" ? "calls" : actType === "task" ? "tasks" : "meetings";
      setData((d: any) => ({ ...d, [listKey]: [...(d?.[listKey] || []), { id: created.id, properties }] }));
      setActOpen(false);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de créer l'activité");
    } finally {
      setSavingAct(false);
    }
  }

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border border-border bg-popover shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8),0_0_0_1px_rgba(115,93,243,0.08)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-gradient-to-br from-violet-500/10 via-transparent to-transparent px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar className="h-14 w-14 shrink-0 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/25 to-accent">
              <AvatarFallback className="rounded-2xl bg-transparent font-display text-xl font-bold text-violet-200">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold leading-tight">{name}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><Building2 size={13} className="shrink-0" /> {company?.name || "Aucune entreprise"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {ownerName ? <Badge variant="outline" className="gap-1 border-violet-400/25 bg-violet-400/5 text-xs text-violet-200"><UserRound size={11} /> {ownerName}</Badge> : null}
                {p.hs_object_source_label ? <Badge variant="outline" className="gap-1 border-white/10 bg-white/5 text-xs text-slate-300"><Globe size={11} /> {p.hs_object_source_label}</Badge> : null}
              </div>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 minari-scrollbar">
          {loading ? <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-violet-300" /></div>
            : error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
            : <div className="space-y-6">
              <div className="flex gap-2">
                <Button asChild className="flex-1"><a href={p.phone ? `tel:${p.phone}` : "#"}><Phone size={15} /> Appeler</a></Button>
                <Button variant="outline" asChild className="flex-1"><a href={p.email ? `mailto:${p.email}` : "#"}><Mail size={15} /> Email</a></Button>
              </div>

              <section>
                <SectionTitle icon={UserRound} title="Coordonnées" action={saving ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Sync…</span> : undefined} />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <EditableField icon={UserRound} label="Prénom" value={p.firstname} onSave={v => patch("firstname", v)} />
                  <EditableField icon={UserRound} label="Nom" value={p.lastname} onSave={v => patch("lastname", v)} />
                  <EditableField icon={Phone} label="Téléphone" value={p.phone} onSave={v => patch("phone", v)} />
                  <EditableField icon={PhoneCall} label="Mobile" value={p.mobilephone} onSave={v => patch("mobilephone", v)} />
                  <EditableField icon={Mail} label="Email" value={p.email} onSave={v => patch("email", v)} />
                  <EditableField icon={UserRound} label="Fonction" value={p.jobtitle} onSave={v => patch("jobtitle", v)} />
                  <EditableField icon={MapPin} label="Ville" value={p.city} onSave={v => patch("city", v)} />
                  <EditableField icon={MapPin} label="Région" value={p.state} onSave={v => patch("state", v)} />
                  <InfoRow icon={CalendarClock} label="Créé le" value={p.createdate ? formatDate(p.createdate) : undefined} />
                  <InfoRow icon={Clock} label="Dernier contact" value={(p.notes_last_contacted || p.hs_last_sales_activity_timestamp) ? formatDate(p.notes_last_contacted || p.hs_last_sales_activity_timestamp) : undefined} />
                  <InfoRow icon={PhoneOutgoing} label="Nombre de tentatives" value={String(Number(p.minari_call_count || 0))} />
                  <InfoRow icon={FileText} label="Motif de relance" value={p.referly_reason_to_reach_out} />
                </div>
              </section>

              {company?.name ? <section>
                <SectionTitle icon={Building2} title="Entreprise" />
                <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div className="font-semibold text-foreground">{company.name}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
                    {company.domain ? <span className="flex items-center gap-1.5 text-muted-foreground"><Globe size={12} className="text-violet-300" /> {company.domain}</span> : null}
                    {company.phone ? <span className="flex items-center gap-1.5 text-muted-foreground"><PhoneCall size={12} className="text-violet-300" /> {company.phone}</span> : null}
                    {[company.city, company.state].filter(Boolean).length ? <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin size={12} className="text-violet-300" /> {[company.city, company.state].filter(Boolean).join(", ")}</span> : null}
                  </div>
                </div>
              </section> : null}

              <section>
                <SectionTitle icon={SlidersHorizontal} title="Gestion" action={saving ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Sync…</span> : undefined} />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Statut prospection</Label>
                    <Select value={p.statut_prospection || "none"} onValueChange={v => { patch("statut_prospection", v === "none" ? "" : v).catch(() => {}); }}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {PROSPECTION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Statut appel</Label>
                    <Select value={p.statut_de_lappel || "none"} onValueChange={v => { patch("statut_de_lappel", v === "none" ? "" : v).catch(() => {}); }}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {CALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Résultat prospection</Label>
                    <Select value={p.resultat_prospection || "none"} onValueChange={v => { patch("resultat_prospection", v === "none" ? "" : v).catch(() => {}); }}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {RESULT_STATUSES.map(s => <SelectItem key={s} value={s}>{s || "Non défini"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Commercial</Label>
                    <Select value={p.hubspot_owner_id || "none"} onValueChange={v => { patch("hubspot_owner_id", v === "none" ? "" : v).catch(() => {}); }}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {Object.entries(owners).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Prochaine relance</Label>
                    <Input type="datetime-local" value={p.date_prochaine_relance ? toLocalInput(new Date(p.date_prochaine_relance)) : ""}
                      onChange={event => { const date = event.target.value ? new Date(event.target.value) : null; patch("date_prochaine_relance", date && !Number.isNaN(date.getTime()) ? date.toISOString() : "").catch(() => {}); }} />
                  </div>
                </div>
              </section>

              <section>
                <SectionTitle icon={FileText} title="Notes commerciales" count={notes.length} action={notes.length > 3 ? <button onClick={() => setShowAllNotes(v => !v)} className="text-xs font-medium text-violet-300 hover:text-violet-200">{showAllNotes ? "Voir moins" : "Tout afficher"}</button> : undefined} />
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-violet-400/25 bg-violet-400/5 p-3">
                    <textarea
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      placeholder="Ajouter une note commerciale…"
                      className="min-h-[72px] w-full resize-none rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-ring/25"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" className="gap-1.5" disabled={!noteDraft.trim() || savingNote} onClick={addNote}>
                        {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter la note
                      </Button>
                    </div>
                  </div>
                  {(showAllNotes ? notes : notes.slice(0, 3)).map((n: any, i: number) => (
                    <div key={i} className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="font-mono">{formatDate(n.properties?.hs_timestamp || n.createdAt)}</span><ArrowUpRight size={13} /></div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-card-foreground" dangerouslySetInnerHTML={{ __html: n.properties?.hs_note_body || "" }} />
                    </div>
                  ))}
                  {!notes.length ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucune note associée.</div> : null}
                </div>
              </section>

              <section>
                <SectionTitle icon={CalendarClock} title="Activité" count={activities.length} action={
                  <button onClick={openActivity} className="flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-400/10 px-2.5 py-1.5 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-400/20">
                    {actOpen ? <X size={12} /> : <Plus size={12} />} {actOpen ? "Fermer" : "Loguer"}
                  </button>
                } />
                {actOpen ? <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3">
                  <div className="grid gap-2.5">
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Type</Label>
                        <Select value={actType} onValueChange={v => setActType(v as "call" | "task" | "meeting")}>
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
                          <Select value={actStatus || "none"} onValueChange={v => setActStatus(v === "none" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {CALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select value={actType === "task" ? "MEDIUM" : "confirmed"} onValueChange={() => {}}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MEDIUM">—</SelectItem>
                              <SelectItem value="confirmed">Confirmé</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Titre</Label>
                      <Input value={actTitle} onChange={e => setActTitle(e.target.value)} placeholder={actType === "call" ? "Intitulé de l'appel" : actType === "task" ? "Intitulé de la tâche" : "Intitulé du rendez-vous"} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{actType === "meeting" ? "Lieu" : "Détails"}</Label>
                      <textarea value={actBody} onChange={e => setActBody(e.target.value)} placeholder={actType === "meeting" ? "Adresse ou lien de visio…" : "Notes libres…"} className="min-h-[56px] w-full resize-none rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-ring/25" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Date</Label>
                      <Input type="datetime-local" value={actDate} onChange={e => setActDate(e.target.value)} />
                    </div>
                    {savingAct ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Création…</span> : null}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={openActivity}>Annuler</Button>
                      <Button size="sm" className="gap-1.5" disabled={savingAct} onClick={createActivity}>
                        {actType === "call" ? <PhoneOutgoing size={14} /> : actType === "task" ? <ListTodo size={14} /> : <CalendarPlus size={14} />}
                        {actType === "call" ? "Loguer l'appel" : actType === "task" ? "Créer la tâche" : "Créer le RDV"}
                      </Button>
                    </div>
                  </div>
                </div> : null}
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1 minari-scrollbar">
                  {activities.map((x: any, i: number) => (
                    <div key={i} className="rounded-xl border border-border bg-muted/20 px-3 py-3 transition-colors hover:border-violet-400/25">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 font-medium">
                          {x.type === "Appel" ? <PhoneCall size={14} className="shrink-0 text-violet-300" />
                            : x.type === "RDV" ? <CalendarClock size={14} className="shrink-0 text-emerald-300" />
                            : <Circle size={14} className="shrink-0 text-sky-300" />}
                          <span className="truncate">{x.title}</span>
                        </span>
                        <Badge variant={x.type === "RDV" ? "default" : "outline"} className="shrink-0 font-medium">{x.type}</Badge>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDate(x.date)}</span>
                      </div>
                      {(x.status || x.disposition) ? <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 size={11} className="text-violet-300" /> {[x.status, x.disposition].filter(Boolean).join(" · ")}
                      </div> : null}
                      {x.body ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-card-foreground/80">{x.body}</p> : null}
                    </div>
                  ))}
                  {!activities.length ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucune activité enregistrée.</div> : null}
                </div>
              </section>
            </div>}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
