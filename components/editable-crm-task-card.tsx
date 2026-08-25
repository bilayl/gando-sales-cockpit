"use client";

import { useEffect, useState } from "react";
import { Check, Edit3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Terminée",
  DEFERRED: "Reportée",
  IN_PROGRESS: "En cours",
  NOT_STARTED: "À faire",
  WAITING: "En attente",
};

const TYPES = [
  ["CALL", "Appel"],
  ["EMAIL", "Email"],
  ["MEETING", "Rendez-vous"],
  ["TODO", "À faire"],
  ["LINKED_IN", "LinkedIn"],
] as const;

const PRIORITIES = [
  ["NONE", "Aucune"],
  ["LOW", "Basse"],
  ["MEDIUM", "Moyenne"],
  ["HIGH", "Haute"],
] as const;

function toLocalInput(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function stripHtml(value?: string | null) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function EditableCRMTaskCard({ task, ownerName, onUpdated }: { task: any; ownerName: string; onUpdated: () => void | Promise<void> }) {
  const p = task.properties || {};
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [priority, setPriority] = useState("NONE");
  const [type, setType] = useState("TODO");
  const completed = p.hs_task_status === "COMPLETED";

  useEffect(() => {
    if (!open) return;
    setSubject(String(p.hs_task_subject || ""));
    setBody(stripHtml(p.hs_task_body));
    setTimestamp(toLocalInput(p.hs_timestamp));
    setPriority(String(p.hs_task_priority || "NONE"));
    setType(String(p.hs_task_type || "TODO"));
  }, [open, p.hs_task_subject, p.hs_task_body, p.hs_timestamp, p.hs_task_priority, p.hs_task_type]);

  async function patch(payload: Record<string, unknown>, success: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "HubSpot a refusé la mise à jour");
      toast.success(success);
      await onUpdated();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier la tâche");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    await patch({ status: "COMPLETED" }, "Tâche terminée dans HubSpot.");
  }

  async function save() {
    if (!subject.trim()) {
      toast.error("Le titre de la tâche est obligatoire.");
      return;
    }
    const ok = await patch({
      subject: subject.trim(),
      body,
      timestamp,
      priority,
      type,
    }, "Tâche modifiée dans HubSpot.");
    if (ok) setOpen(false);
  }

  return (
    <>
      <article className={`rounded-xl border border-border bg-card p-4 ${completed ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold">{p.hs_task_subject || "Tâche"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{ownerName}</div>
          </div>
          <div className="text-xs text-muted-foreground">{p.hs_timestamp ? formatDate(p.hs_timestamp) : "—"}</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant={completed ? "secondary" : "outline"}>{STATUS_LABEL[p.hs_task_status] || p.hs_task_status || "À faire"}</Badge>
          {p.hs_task_priority && p.hs_task_priority !== "NONE" ? <Badge variant="outline">Priorité {String(p.hs_task_priority).toLowerCase()}</Badge> : null}
          {p.hs_task_type ? <Badge variant="outline">{TYPES.find(([value]) => value === p.hs_task_type)?.[1] || p.hs_task_type}</Badge> : null}
        </div>
        {stripHtml(p.hs_task_body) ? <div className="mt-3 whitespace-pre-wrap text-sm leading-6">{stripHtml(p.hs_task_body)}</div> : null}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={saving}><Edit3 size={14} /> Modifier</Button>
          {!completed ? <Button size="sm" onClick={() => void complete()} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Terminer</Button> : null}
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
            <DialogDescription>Les modifications sont enregistrées directement dans HubSpot.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label htmlFor={`task-subject-${task.id}`}>Titre</Label><Input id={`task-subject-${task.id}`} value={subject} onChange={event => setSubject(event.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor={`task-date-${task.id}`}>Date et heure</Label><Input id={`task-date-${task.id}`} type="datetime-local" value={timestamp} onChange={event => setTimestamp(event.target.value)} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label>Type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>Priorité</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-1.5"><Label htmlFor={`task-body-${task.id}`}>Détail</Label><textarea id={`task-body-${task.id}`} value={body} onChange={event => setBody(event.target.value)} rows={7} className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button><Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
