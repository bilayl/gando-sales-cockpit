"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlarmClock, ArrowUpRight, CalendarClock, Check, CheckCircle2, ChevronDown,
  ChevronRight, CirclePlus, Clock3, Loader2, RefreshCw, Search, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PageHeader } from "@/components/cockpit/page-header";

type Assignee = { email: string; displayName: string; role: string; hubspotOwnerId: string | null };
type CrmObject = { id: string; properties?: Record<string, string | null | undefined> };
type Followup = {
  id: string;
  properties: Record<string, string | null | undefined>;
  cockpitAssignee?: Assignee | null;
  associations?: { contact?: CrmObject | null; company?: CrmObject | null; deal?: CrmObject | null };
};
type Target = { id: string; type: "contact" | "company"; title: string; subtitle?: string };
type Period = "all" | "overdue" | "today" | "upcoming" | "completed";
type Scope = "followups" | "AE" | "CSM" | "other";
type Kind = "AE" | "CSM";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "overdue", label: "En retard" },
  { value: "today", label: "Aujourd'hui" },
  { value: "upcoming", label: "À venir" },
  { value: "completed", label: "Terminées" },
];

const CHANNELS = [
  { value: "CALL", label: "Appel" },
  { value: "EMAIL", label: "Email" },
  { value: "TODO", label: "Action" },
  { value: "MEETING", label: "Rendez-vous" },
];

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
    + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function initialDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return toLocalInput(date);
}

function taskKind(task: Followup): Kind | "other" {
  const title = task.properties.hs_task_subject || "";
  return /^\s*\[AE\]\s/i.test(title) ? "AE" : /^\s*\[CSM\]\s/i.test(title) ? "CSM" : "other";
}

function cleanTitle(task: Followup) {
  return (task.properties.hs_task_subject || "Relance sans titre").replace(/^\s*\[(AE|CSM)\]\s*/i, "");
}

function dueDate(task: Followup) {
  const value = task.properties.hs_timestamp || "";
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}

function isCompleted(task: Followup) {
  return task.properties.hs_task_status === "COMPLETED";
}

function timingLabel(task: Followup) {
  if (isCompleted(task)) return "Terminée";
  const timestamp = dueDate(task);
  if (timestamp === null) return "Sans date";
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  if (timestamp < start) return "En retard";
  if (timestamp < end) return "Aujourd'hui";
  return "À venir";
}

function readableDate(raw?: string | null) {
  if (!raw || Number.isNaN(Date.parse(raw))) return "Date inconnue";
  return new Date(raw).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function taskContact(task: Followup) {
  const props = task.associations?.contact?.properties;
  return props ? [props.firstname, props.lastname].filter(Boolean).join(" ") || props.email || "Contact" : "";
}

function taskCompany(task: Followup) {
  return task.associations?.company?.properties?.name || task.associations?.contact?.properties?.company || "";
}

function textOnly(value?: string | null) {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").trim();
}

function activityLabel(type?: string | null) {
  return CHANNELS.find(item => item.value === type)?.label || "Action";
}

export function FollowupsView() {
  const [rows, setRows] = useState<Followup[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [scope, setScope] = useState<Scope>("followups");
  const [ownerFilter, setOwnerFilter] = useState("team");
  const [query, setQuery] = useState("");
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [kind, setKind] = useState<Kind>("AE");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [channel, setChannel] = useState("CALL");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueAt, setDueAt] = useState(initialDate);
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [targetQuery, setTargetQuery] = useState("");
  const [targetResults, setTargetResults] = useState<Target[]>([]);
  const [targetBusy, setTargetBusy] = useState(false);
  const [editTask, setEditTask] = useState<Followup | null>(null);
  const [editDueAt, setEditDueAt] = useState("");

  const load = useCallback(async (after?: string, append = false) => {
    if (append) setMoreLoading(true);
    else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ period });
      if (after) params.set("after", after);
      const response = await fetch("/api/tasks?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de récupérer les relances HubSpot.");
      const result = Array.isArray(data.results) ? data.results as Followup[] : [];
      setRows(current => {
        if (!append) return result;
        const seen = new Map(current.map(item => [item.id, item]));
        result.forEach(item => seen.set(item.id, item));
        return [...seen.values()];
      });
      setTotal(Number(data.total || 0));
      setNextAfter(data.paging?.next?.after || null);
      setAssignees(data.assignees || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les relances.");
    } finally {
      setLoading(false);
      setMoreLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then(response => response.ok ? response.json() : null)
      .then(data => {
        const email = String(data?.email || "").toLowerCase().trim();
        setCurrentEmail(email);
        setAssigneeEmail(value => value || email);
      }).catch(() => undefined);
  }, []);

  // A CRM record can deep-link into the creation form with the correct association.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("contactId") ? "contact" : params.get("companyId") ? "company" : null;
    const id = params.get(type === "contact" ? "contactId" : "companyId") || "";
    if (!type || !/^\d{1,25}$/.test(id)) return;
    setCreateOpen(true);
    void fetch("/api/" + (type === "contact" ? "contacts" : "companies") + "/" + id, { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        const properties = type === "contact" ? result?.contact?.properties : result?.company?.properties;
        const title = type === "contact" ? [properties?.firstname, properties?.lastname].filter(Boolean).join(" ") || properties?.email : properties?.name;
        setTarget({ id, type, title: title || (type === "contact" ? "Contact" : "Entreprise") });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!createOpen || target || targetQuery.trim().length < 2) {
      setTargetResults([]);
      setTargetBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTargetBusy(true);
      try {
        const response = await fetch("/api/crm/search?q=" + encodeURIComponent(targetQuery.trim()), {
          signal: controller.signal, cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Recherche CRM indisponible");
        if (!controller.signal.aborted) {
          setTargetResults((data.results || []).filter((item: Target) => item.type === "company" || item.type === "contact"));
        }
      } catch {
        if (!controller.signal.aborted) setTargetResults([]);
      } finally {
        if (!controller.signal.aborted) setTargetBusy(false);
      }
    }, 260);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [createOpen, target, targetQuery]);

  const visible = useMemo(() => rows.filter(task => {
    const department = taskKind(task);
    if (scope === "followups" && department === "other") return false;
    if (scope !== "followups" && department !== scope) return false;
    if (ownerFilter !== "team") {
      const email = ownerFilter === "mine" ? currentEmail : ownerFilter;
      const assignee = task.cockpitAssignee?.email?.toLowerCase();
      const owner = assignees.find(member => member.email === email);
      if (assignee !== email && (!owner?.hubspotOwnerId || task.properties.hubspot_owner_id !== owner.hubspotOwnerId)) return false;
    }
    const haystack = [cleanTitle(task), task.properties.hs_task_body, taskContact(task), taskCompany(task),
      task.cockpitAssignee?.displayName, task.associations?.deal?.properties?.dealname].join(" ").toLocaleLowerCase("fr-FR");
    return !query.trim() || haystack.includes(query.trim().toLocaleLowerCase("fr-FR"));
  }), [rows, scope, ownerFilter, currentEmail, assignees, query]);

  const stats = useMemo(() => {
    const relevant = rows.filter(task => taskKind(task) !== "other");
    return {
      overdue: relevant.filter(task => timingLabel(task) === "En retard").length,
      today: relevant.filter(task => timingLabel(task) === "Aujourd'hui").length,
      upcoming: relevant.filter(task => timingLabel(task) === "À venir").length,
      completed: relevant.filter(isCompleted).length,
    };
  }, [rows]);

  async function patchTask(task: Followup, update: Record<string, string>, successMessage: string) {
    setSavingId(task.id);
    setError("");
    try {
      const response = await fetch("/api/tasks/" + encodeURIComponent(task.id), {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(update),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Échec de la mise à jour HubSpot.");
      setRows(current => current.map(item => item.id === task.id ? {
        ...item,
        properties: { ...item.properties, ...(data.properties || {}),
          ...(update.status ? { hs_task_status: update.status } : {}),
          ...(update.timestamp ? { hs_timestamp: update.timestamp } : {}) },
        ...(update.assigneeEmail !== undefined ? { cockpitAssignee: data.cockpitAssignee ?? null } : {}),
      } : item));
      toast.success(successMessage);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Modification impossible";
      setError(message);
      toast.error(message);
    } finally {
      setSavingId("");
    }
  }

  async function saveDeferred() {
    if (!editTask || !editDueAt || Number.isNaN(Date.parse(editDueAt))) return;
    const item = editTask;
    setEditTask(null);
    await patchTask(item, { timestamp: new Date(editDueAt).toISOString(), status: "NOT_STARTED" }, "Relance reportée dans HubSpot.");
  }

  function resetForm() {
    setSubject(""); setNotes(""); setChannel("CALL"); setPriority("MEDIUM");
    setDueAt(initialDate()); setKind("AE"); setTarget(null); setTargetQuery("");
    setAssigneeEmail(currentEmail); setCreateError("");
  }

  async function createFollowup() {
    if (!target || !subject.trim() || !assigneeEmail || !dueAt) {
      setCreateError("Renseignez une fiche CRM, un titre, une date et un responsable.");
      return;
    }
    if (Number.isNaN(Date.parse(dueAt))) {
      setCreateError("La date indiquée est invalide.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: "[" + kind + "] " + subject.trim(),
          body: notes.trim(),
          timestamp: new Date(dueAt).toISOString(),
          type: channel,
          priority,
          assigneeEmail,
          association: { type: target.type, id: target.id },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de créer la relance.");
      toast.success("Relance créée et associée à la fiche dans HubSpot.");
      setCreateOpen(false); resetForm(); setPeriod("all");
      await load();
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "Création impossible");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-shell min-h-screen">
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Suivi commercial & clients"
          title="Relances"
          description="Un espace partagé pour les AE et CSM : suivis de négociation, intégration, adoption, renouvellement et relation client. Les actions restent synchronisées avec HubSpot."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser
              </Button>
              <Button size="sm" onClick={() => { resetForm(); setCreateOpen(true); }}>
                <CirclePlus size={15} /> Planifier une relance
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "En retard", value: stats.overdue, icon: AlarmClock },
            { label: "Aujourd'hui", value: stats.today, icon: Clock3 },
            { label: "À venir", value: stats.upcoming, icon: CalendarClock },
            { label: "Terminées", value: stats.completed, icon: CheckCircle2 },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border border-border/75 bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{item.label}</span><Icon size={16} />
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</p>
              </div>
            );
          })}
        </div>
        <p className="-mt-4 text-[11px] text-muted-foreground">Compteurs calculés sur les relances AE/CSM actuellement chargées.</p>

        <section className="overflow-hidden rounded-xl border border-border/75 bg-card">
          <div className="space-y-3 border-b border-border/70 p-4">
            <div className="flex flex-wrap items-center gap-1">
              {PERIODS.map(item => (
                <Button key={item.value} size="sm" variant={period === item.value ? "secondary" : "ghost"}
                  onClick={() => setPeriod(item.value)} className="h-8 text-xs">{item.label}</Button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[170px_220px_minmax(220px,1fr)]">
              <Select value={scope} onValueChange={value => setScope(value as Scope)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="followups">AE + CSM</SelectItem>
                  <SelectItem value="AE">Relances AE</SelectItem>
                  <SelectItem value="CSM">Relances CSM</SelectItem>
                  <SelectItem value="other">Autres tâches HubSpot</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Toute l'équipe</SelectItem>
                  {currentEmail ? <SelectItem value="mine">Mes relances</SelectItem> : null}
                  {assignees.filter(member => member.email !== currentEmail).map(member =>
                    <SelectItem key={member.email} value={member.email}>{member.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" />
                <Input value={query} onChange={event => setQuery(event.target.value)}
                  placeholder="Rechercher une entreprise, un contact ou une action…" className="h-9 pl-9" />
              </div>
            </div>
          </div>

          {error ? <div role="alert" className="m-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}

          <div className="divide-y divide-border/65">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={18} /> Chargement des relances HubSpot…
              </div>
            ) : visible.length ? visible.map(task => {
              const p = task.properties;
              const kind = taskKind(task);
              const label = timingLabel(task);
              const disabled = savingId === task.id;
              const contact = task.associations?.contact;
              const company = task.associations?.company;
              const deal = task.associations?.deal;
              return (
                <article key={task.id} className="flex flex-col gap-3 p-4 transition hover:bg-muted/20 lg:flex-row lg:items-start lg:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{kind === "other" ? "Non catégorisée" : kind}</Badge>
                      <Badge variant={label === "En retard" ? "destructive" : "secondary"} className="text-[10px]">{label}</Badge>
                      {p.hs_task_priority === "HIGH" ? <Badge variant="outline" className="text-[10px]">Priorité haute</Badge> : null}
                      <span className="text-[11px] text-muted-foreground">{activityLabel(p.hs_task_type)}</span>
                    </div>
                    <div className="mt-2 text-[14px] font-semibold">{cleanTitle(task)}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {readableDate(p.hs_timestamp)}</span>
                      {company ? <Link href={"/companies/" + company.id} className="inline-flex items-center gap-1 hover:text-primary"><Users size={12}/>{taskCompany(task)} <ArrowUpRight size={11}/></Link> : taskCompany(task) ? <span>{taskCompany(task)}</span> : null}
                      {contact ? <Link href={"/contacts/" + contact.id} className="inline-flex items-center gap-1 hover:text-primary">{taskContact(task)} <ArrowUpRight size={11}/></Link> : null}
                      {deal ? <span>Opportunité : {deal.properties?.dealname || deal.id}</span> : null}
                    </div>
                    {p.hs_task_body ? <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{textOnly(p.hs_task_body)}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:w-[410px] lg:shrink-0 lg:justify-end">
                    <Select value={task.cockpitAssignee?.email || "__none__"} onValueChange={value =>
                      void patchTask(task, { assigneeEmail: value === "__none__" ? "" : value }, "Responsable mis à jour.")
                    } disabled={disabled}>
                      <SelectTrigger className="h-8 w-[175px] text-xs"><SelectValue placeholder="Responsable" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Non assignée</SelectItem>
                        {assignees.map(person => <SelectItem key={person.email} value={person.email}>{person.displayName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {isCompleted(task) ? (
                      <Button size="sm" variant="outline" disabled={disabled} onClick={() => void patchTask(task, { status: "NOT_STARTED" }, "Relance rouverte.")}>Réouvrir</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" disabled={disabled} onClick={() => {
                          setEditTask(task);
                          setEditDueAt(toLocalInput(new Date(dueDate(task) || Date.now())));
                        }}><CalendarClock size={13} /> Reporter</Button>
                        <Button size="sm" disabled={disabled} onClick={() => void patchTask(task, { status: "COMPLETED" }, "Relance terminée.")}>
                          {disabled ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />} Terminer
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            }) : (
              <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
                <CheckCircle2 className="text-muted-foreground/50" size={27} />
                <p className="mt-3 text-sm font-semibold">Aucune relance dans cette vue</p>
                <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                  Créez une relance AE/CSM ou modifiez les filtres. Les anciennes tâches HubSpot sont accessibles via « Autres tâches HubSpot ».
                </p>
                <Button className="mt-4" size="sm" variant="outline" onClick={() => { resetForm(); setCreateOpen(true); }}>Nouvelle relance</Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <span>{visible.length} affichée(s) sur {rows.length} tâches chargées · {total} dans cette période HubSpot</span>
            {nextAfter ? <Button variant="outline" size="sm" disabled={moreLoading} onClick={() => void load(nextAfter, true)}>
              {moreLoading ? <Loader2 className="animate-spin" size={14}/> : <ChevronRight size={14}/>} Charger les suivantes
            </Button> : <span>Fin des résultats</span>}
          </div>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Planifier une relance</DialogTitle>
            <DialogDescription>Associer une action à une entreprise ou un contact, puis l'assigner à un AE ou CSM. La relance est enregistrée dans HubSpot.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label>Équipe concernée</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["AE", "CSM"] as const).map(value =>
                  <button key={value} type="button" onClick={() => setKind(value)}
                    className={"rounded-lg border px-3 py-2.5 text-left text-xs transition " + (kind === value ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-muted")}>
                    <span className="block font-semibold">{value}</span>
                    <span className="mt-0.5 block text-muted-foreground">{value === "AE" ? "Opportunités & négociation" : "Clients & fidélisation"}</span>
                  </button>)}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Contact ou entreprise à relancer</Label>
              {target ? <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs">
                <div className="min-w-0"><span className="block font-semibold">{target.title}</span><span className="text-muted-foreground">{target.type === "contact" ? "Contact HubSpot" : "Entreprise HubSpot"}</span></div>
                <Button variant="ghost" size="sm" onClick={() => { setTarget(null); setTargetQuery(""); }}>Modifier <ChevronDown size={13}/></Button>
              </div> : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-muted-foreground"/>
                    <Input className="pl-9" value={targetQuery} onChange={event => setTargetQuery(event.target.value)}
                      placeholder="Rechercher un contact, une entreprise…" />
                  </div>
                  {targetQuery.length >= 2 ? (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                      {targetBusy ? <div className="p-3 text-xs text-muted-foreground"><Loader2 className="mr-2 inline animate-spin" size={13}/>Recherche en cours…</div>
                        : targetResults.length ? targetResults.map(item =>
                          <button key={item.type + item.id} type="button" onClick={() => { setTarget(item); setTargetResults([]); }}
                            className="flex w-full items-center justify-between gap-3 border-b border-border/50 p-3 text-left text-xs last:border-b-0 hover:bg-muted">
                            <span className="min-w-0"><span className="block truncate font-semibold">{item.title}</span><span className="mt-0.5 block truncate text-muted-foreground">{item.subtitle || (item.type === "company" ? "Entreprise" : "Contact")}</span></span>
                            <Badge variant="outline" className="text-[10px]">{item.type === "contact" ? "Contact" : "Entreprise"}</Badge>
                          </button>) : <div className="p-3 text-xs text-muted-foreground">Aucun résultat dans le CRM.</div>}
                    </div>
                  ) : <p className="text-[11px] text-muted-foreground">Recherchez au moins 2 caractères.</p>}
                </>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="followup-subject">Objet de la relance</Label>
              <Input id="followup-subject" value={subject} onChange={event => setSubject(event.target.value)} maxLength={440}
                placeholder={kind === "AE" ? "Faire le point sur la proposition commerciale" : "Vérifier la mise en place de l'intégration"} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="followup-notes">Contexte et prochaine action</Label>
              <textarea id="followup-notes" rows={3} value={notes} onChange={event => setNotes(event.target.value)}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Ce qui a été convenu, éléments en attente, prochaine étape…" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="followup-due">Date et heure</Label><Input id="followup-due" type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Responsable</Label>
                <Select value={assigneeEmail || "__none__"} onValueChange={value => setAssigneeEmail(value === "__none__" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">Sélectionner</SelectItem>
                    {assignees.map(member => <SelectItem value={member.email} key={member.email}>{member.displayName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Canal</Label>
                <Select value={channel} onValueChange={setChannel}><SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{CHANNELS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Priorité</Label>
                <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="LOW">Basse</SelectItem><SelectItem value="MEDIUM">Moyenne</SelectItem><SelectItem value="HIGH">Haute</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {createError ? <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">{createError}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button disabled={creating || !subject.trim() || !dueAt || !target || !assigneeEmail}
              onClick={() => void createFollowup()}>
              {creating ? <Loader2 size={14} className="animate-spin"/> : <CirclePlus size={14}/>} Créer la relance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTask)} onOpenChange={open => { if (!open) setEditTask(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reporter la relance</DialogTitle>
            <DialogDescription>La nouvelle échéance sera enregistrée dans HubSpot.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="followup-reschedule">Nouvelle date et heure</Label>
            <Input id="followup-reschedule" type="datetime-local" value={editDueAt} onChange={event => setEditDueAt(event.target.value)}/>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTask(null)}>Annuler</Button>
            <Button disabled={!editDueAt || Boolean(savingId)} onClick={() => void saveDeferred()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
