"use client";

import { useEffect, useState } from "react";
import { CalendarClock, FileText, ListTodo, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LaterFollowupPayload = {
  reminderAt: string;
  note: string;
  createTask: boolean;
  createCalendarEvent: boolean;
};

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  date.setHours(9, 0, 0, 0);
  return date;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
}

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function CompanyLaterFollowupDialog({
  open,
  companyName,
  saving = false,
  onOpenChange,
  onConfirm,
  title = "Planifier une relance",
  description,
  presetMode = "long",
  subjectLabel,
}: {
  open: boolean;
  companyName?: string;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: LaterFollowupPayload) => Promise<void> | void;
  title?: string;
  description?: string;
  presetMode?: "short" | "long";
  subjectLabel?: string;
}) {
  const [reminderAt, setReminderAt] = useState(() => localDateTimeValue(addMonths(3)));
  const [note, setNote] = useState("");
  const [createTask, setCreateTask] = useState(true);
  const [createCalendarEvent, setCreateCalendarEvent] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReminderAt(localDateTimeValue(presetMode === "short" ? addDays(1) : addMonths(3)));
    setNote("");
    setCreateTask(true);
    setCreateCalendarEvent(true);
    setError("");
  }, [open]);

  if (!open) return null;

  async function submit() {
    const parsed = new Date(reminderAt);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      setError("Choisis une date de relance dans le futur.");
      return;
    }
    setError("");
    await onConfirm({
      reminderAt: parsed.toISOString(),
      note: note.trim(),
      createTask,
      createCalendarEvent,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (!saving && event.currentTarget === event.target) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-popover p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {description || `${subjectLabel || companyName || "Ce prospect"} sera rappelé à la date choisie.`}
            </p>
          </div>
          <Button variant="ghost" size="icon" disabled={saving} onClick={() => onOpenChange(false)} aria-label="Fermer">
            <X size={17} />
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {(presetMode === "short"
            ? [
                { label: "Demain", date: addDays(1) },
                { label: "+ 3 jours", date: addDays(3) },
                { label: "+ 7 jours", date: addDays(7) },
              ]
            : [
                { label: "+ 1 mois", date: addMonths(1) },
                { label: "+ 3 mois", date: addMonths(3) },
                { label: "+ 6 mois", date: addMonths(6) },
              ]).map(preset => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setReminderAt(localDateTimeValue(preset.date))}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">Date de relance</label>
          <Input
            type="datetime-local"
            value={reminderAt}
            min={localDateTimeValue(new Date(Date.now() + 60_000))}
            onChange={event => setReminderAt(event.target.value)}
            className="mt-1.5"
            disabled={saving}
          />
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <FileText size={13} />
            Note associée <span className="font-normal">(optionnel)</span>
          </label>
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="Ex. recontacter après la saison, décision budgétaire en janvier, rappeler le directeur…"
            rows={3}
            disabled={saving}
            className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/55 focus:ring-2 focus:ring-ring/15 disabled:opacity-60"
          />
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <input
            type="checkbox"
            checked={createTask}
            onChange={event => setCreateTask(event.target.checked)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <ListTodo size={14} />
              Créer une tâche HubSpot
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              Une tâche de rappel sera créée à la même date, avec la note comme contexte si elle est renseignée.
            </span>
          </span>
        </label>

        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <input
            type="checkbox"
            checked={createCalendarEvent}
            onChange={event => setCreateCalendarEvent(event.target.checked)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <CalendarClock size={14} />
              Ajouter au calendrier Gando
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              Un créneau de rappel sera ajouté au calendrier partagé sales@gando.app lorsqu’il est connecté.
            </span>
          </span>
        </label>

        {error ? <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => void submit()} disabled={saving || !reminderAt}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            Planifier la relance
          </Button>
        </div>
      </div>
    </div>
  );
}
