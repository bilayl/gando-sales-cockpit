"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check, ChevronRight, CirclePlus, Clock3, Loader2, Mail, Phone, RefreshCw, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  properties: Record<string, string | null | undefined>;
  associations?: {
    contact?: { id: string; properties?: Record<string, string | null | undefined> } | null;
    company?: { id: string; properties?: Record<string, string | null | undefined> } | null;
    deal?: { id: string; properties?: Record<string, string | null | undefined> } | null;
  };
};

type Period = "today" | "overdue" | "upcoming" | "completed" | "all";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "today", label: "Aujourd’hui" },
  { value: "overdue", label: "En retard" },
  { value: "upcoming", label: "À venir" },
  { value: "completed", label: "Terminées" },
  { value: "all", label: "Toutes" },
];

const TYPES = [
  { value: "all", label: "Tous" },
  { value: "CALL", label: "Appels" },
  { value: "EMAIL", label: "Emails" },
  { value: "MEETING", label: "RDV" },
  { value: "TODO", label: "Autres" },
];

const TYPE_LABEL: Record<string, string> = { CALL: "Appel", EMAIL: "Email", MEETING: "RDV", TODO: "Follow-up", LINKED_IN: "LinkedIn", LINKED_IN_CONNECT: "LinkedIn", LINKED_IN_MESSAGE: "LinkedIn" };
const STATUS_LABEL: Record<string, string> = { COMPLETED: "Terminée", DEFERRED: "Reportée", IN_PROGRESS: "En cours", NOT_STARTED: "À faire", WAITING: "En attente" };

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTaskDate(value?: string | null) {
  if (!value) return { date: "Sans date", time: "—" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Date invalide", time: "—" };
  return {
    date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date),
    time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function contactName(task: Task) {
  const p = task.associations?.contact?.properties;
  return p ? [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact" : "—";
}

function taskTypeIcon(type?: string | null) {
  if (type === "CALL") return Phone;
  if (type === "EMAIL") return Mail;
  if (type === "MEETING") return CalendarClock;
  return Clock3;
}

function priorityClass(priority?: string | null) {
  if (priority === "HIGH") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "LOW") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-border bg-muted text-muted-foreground";
}

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [period, setPeriod] = useState<Period>("today");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60_000)));
  const [newType, setNewType] = useState("CALL");
  const [priority, setPriority] = useState("NONE");

  const load = useCallback(async (after?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ period });
      if (type !== "all") params.set("type", type);
      if (query.trim()) params.set("q", query.trim());
      if (after) params.set("after", after);
      const response = await fetch(`/api/tasks?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de charger les tâches HubSpot");
      setTasks(data.results || []);
      setTotal(Number(data.total || 0));
      setNextAfter(data.paging?.next?.after || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les tâches HubSpot");
    } finally {
      setLoading(false);
    }
  }, [period, query, type]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [load, query]);

  async function complete(task: Task) {
    setSavingId(task.id);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "HubSpot a refusé la mise à jour");
      if (period === "completed" || period === "all") {
        setTasks(current => current.map(row => row.id === task.id ? { ...row, properties: { ...row.properties, hs_task_status: "COMPLETED" } } : row));
      } else {
        setTasks(current => current.filter(row => row.id !== task.id));
        setTotal(current => Math.max(0, current - 1));
      }
      toast.success("Tâche marquée comme terminée dans HubSpot.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de terminer la tâche");
      toast.error(reason instanceof Error ? reason.message : "Impossible de terminer la tâche");
    } finally {
      setSavingId(null);
    }
  }

  function resetCreateForm() {
    setSubject("");
    setBody("");
    setDueAt(toLocalInput(new Date(Date.now() + 60 * 60_000)));
    setNewType("CALL");
    setPriority("NONE");
    setCreateError("");
  }

  async function createNewTask() {
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, body, timestamp: dueAt, type: newType, priority }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de créer la tâche HubSpot");
      setCreateOpen(false);
      resetCreateForm();
      await load();
      toast.success("Tâche créée dans HubSpot.");
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : "Impossible de créer la tâche HubSpot");
      toast.error(reason instanceof Error ? reason.message : "Impossible de créer la tâche HubSpot");
    } finally {
      setCreating(false);
    }
  }

  const visibleTasks = useMemo(() => tasks, [tasks]);

  return (
    <div className="page-shell min-h-screen">
      <div className="flex h-screen min-h-0 flex-col">
        <header className="shrink-0 px-5 pb-4 pt-5 lg:px-7 lg:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-2xl font-bold tracking-[-0.035em]">Tâches</h1><p className="mt-1 text-sm text-muted-foreground">Toutes les actions HubSpot, synchronisées en temps réel.</p></div>
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => load()}><RefreshCw /> Actualiser</Button><Button size="sm" onClick={() => setCreateOpen(true)}><CirclePlus /> Nouvelle tâche</Button></div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
              {PERIODS.map(item => <Button key={item.value} size="sm" variant={period === item.value ? "secondary" : "ghost"} onClick={() => setPeriod(item.value)} className="h-8">{item.label}</Button>)}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une tâche…" className="w-full pl-9 sm:w-64" /></div>
              <Select value={type} onValueChange={setType}><SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
        </header>

        {error ? <div role="alert" className="mx-5 mt-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        <div className="minari-scrollbar min-h-0 flex-1 overflow-auto px-5 pb-5 lg:px-7">
          <Card className="overflow-hidden shadow-none">
            <Table>
              <TableHeader><TableRow><TableHead className="w-28">Heure</TableHead><TableHead>Action</TableHead><TableHead>Prospect</TableHead><TableHead>Entreprise</TableHead><TableHead>Priorité</TableHead><TableHead>Statut</TableHead><TableHead className="w-36 text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="h-56 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><span className="mt-2 block text-sm text-muted-foreground">Chargement depuis HubSpot…</span></TableCell></TableRow> : null}
                {!loading && visibleTasks.map(task => {
                  const p = task.properties;
                  const due = formatTaskDate(p.hs_timestamp);
                  const Icon = taskTypeIcon(p.hs_task_type);
                  const completed = p.hs_task_status === "COMPLETED";
                  return (
                    <TableRow key={task.id} className={cn(completed && "opacity-60")}>
                      <TableCell><div className="font-mono text-sm font-semibold">{due.time}</div><div className="text-[11px] text-muted-foreground">{due.date}</div></TableCell>
                      <TableCell><div className="flex items-start gap-2"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-muted text-primary"><Icon className="h-3.5 w-3.5" /></span><div><div className="max-w-sm font-medium">{p.hs_task_subject || "Tâche sans titre"}</div><div className="mt-0.5 text-xs text-muted-foreground">{TYPE_LABEL[p.hs_task_type || ""] || "Autre"}</div></div></div></TableCell>
                      <TableCell><span className="inline-flex items-center gap-1.5 text-sm"><UserRound className="h-3.5 w-3.5 text-muted-foreground" />{contactName(task)}</span></TableCell>
                      <TableCell>{task.associations?.company?.properties?.name || task.associations?.contact?.properties?.company || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={priorityClass(p.hs_task_priority)}>{p.hs_task_priority === "HIGH" ? "Haute" : p.hs_task_priority === "MEDIUM" ? "Moyenne" : p.hs_task_priority === "LOW" ? "Basse" : "Normale"}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{STATUS_LABEL[p.hs_task_status || ""] || p.hs_task_status || "À faire"}</Badge></TableCell>
                      <TableCell className="text-right">{completed ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" /> Terminée</span> : <Button size="sm" variant="outline" disabled={savingId === task.id} onClick={() => complete(task)}>{savingId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Terminer</Button>}</TableCell>
                    </TableRow>
                  );
                })}
                {!loading && !visibleTasks.length ? <TableRow><TableCell colSpan={7} className="h-56 text-center"><Check className="mx-auto h-7 w-7 text-emerald-300" /><div className="mt-3 font-medium">Aucune tâche dans cette vue</div><div className="mt-1 text-sm text-muted-foreground">Changez de période ou créez une nouvelle action.</div></TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </Card>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{total} tâche(s) HubSpot</span>{nextAfter ? <Button size="sm" variant="ghost" onClick={() => load(nextAfter)}>Page suivante <ChevronRight className="h-3.5 w-3.5" /></Button> : null}</div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer une tâche HubSpot</DialogTitle><DialogDescription>La tâche sera immédiatement créée dans HubSpot et apparaîtra dans le cockpit.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label htmlFor="task-subject">Titre</Label><Input id="task-subject" value={subject} onChange={event => setSubject(event.target.value)} placeholder="Rappeler le prospect…" /></div>
            <div className="grid gap-1.5"><Label htmlFor="task-body">Notes</Label><Input id="task-body" value={body} onChange={event => setBody(event.target.value)} placeholder="Contexte de l’action" /></div>
            <div className="grid gap-1.5"><Label htmlFor="task-due">Date et heure</Label><Input id="task-due" type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Type</Label><Select value={newType} onValueChange={setNewType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.filter(item => item.value !== "all").map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>Priorité</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Normale</SelectItem><SelectItem value="LOW">Basse</SelectItem><SelectItem value="MEDIUM">Moyenne</SelectItem><SelectItem value="HIGH">Haute</SelectItem></SelectContent></Select></div>
            </div>
            {createError ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{createError}</div> : null}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button><Button disabled={creating || !subject.trim() || !dueAt} onClick={createNewTask}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CirclePlus className="h-4 w-4" />} Créer dans HubSpot</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
