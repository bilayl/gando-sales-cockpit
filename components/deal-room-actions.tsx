"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ClosingPlanStatus,
  DealRoomAction,
  DealRoomActionInput,
  DealRoomContact,
  StakeholderRole,
} from "@/lib/deal-room-types";
import { cn } from "@/lib/utils";

export type DealActionKind = DealRoomAction;

export async function runDealAction(dealId: string, input: DealRoomActionInput) {
  const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "HubSpot a rejeté l’action");
  return data as { ok: boolean; warnings?: string[]; [key: string]: unknown };
}

const ACTION_TITLES: Record<DealActionKind, string> = {
  log_call: "Log Call",
  note: "Ajouter une note",
  task: "Créer une tâche",
  meeting: "Planifier un RDV",
  stage: "Modifier le stage",
  next_step: "Définir la prochaine action",
  blocker: "Ajouter un blocker",
  contact: "Associer un contact",
  stakeholder_role: "Rôle du contact",
  closing_plan: "Plan de closing",
};

const CALL_OUTCOMES = [
  "Intéressé", "Intéressé mais", "À rappeler", "Occupé", "NRP", "Pas intéressé",
  "Hors cible", "Numéro invalide", "A une date ultérieure", "RDV pris", "Décision obtenue", "Autre",
];

const TASK_TYPES = ["CALL", "EMAIL", "MEETING", "TODO", "LINKED_IN"];

const ROLES: Array<{ value: StakeholderRole; label: string }> = [
  { value: "Champion", label: "Champion" },
  { value: "Decision Maker", label: "Decision Maker" },
  { value: "Economic Buyer", label: "Economic Buyer" },
  { value: "Technical", label: "Technical" },
  { value: "Legal", label: "Legal" },
  { value: "Operational", label: "Operational" },
  { value: "Blocker", label: "Blocker" },
];

function toDateTimeLocal(date = new Date(Date.now() + 24 * 60 * 60 * 1000)) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function ContactPicker({ contacts, value, onChange }: { contacts: DealRoomContact[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DealRoomContact[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/contacts?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
        const data = await response.json();
        setResults((data.results || []).map((row: { id: string; properties: Record<string, string | null> }) => {
          const p = row.properties;
          return {
            id: row.id,
            name: [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom",
            jobtitle: p.jobtitle || null,
            email: p.email || null,
            phone: p.mobilephone || p.phone || null,
            company: p.company || null,
            lastActivityAt: null,
          };
        }).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const selected = contacts.find(contact => contact.id === value);

  return (
    <div className="space-y-2">
      <Label>Contact</Label>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un contact HubSpot…" className="h-9 pl-9" />
      </div>
      {searching ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Recherche…</div> : null}
      {results.length ? (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-1 minari-scrollbar">
          {results.map(candidate => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => { onChange(candidate.id); setQuery(""); setResults([]); }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{candidate.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{[candidate.jobtitle, candidate.email, candidate.company].filter(Boolean).join(" · ")}</span>
              </span>
              {value === candidate.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {!query.trim() && contacts.length ? (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-1 minari-scrollbar">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Contacts déjà associés au deal</div>
          {contacts.map(contact => (
            <button
              key={contact.id}
              type="button"
              onClick={() => onChange(contact.id)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted", value === contact.id && "bg-primary/10")}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{contact.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{[contact.jobtitle, contact.email].filter(Boolean).join(" · ")}</span>
              </span>
              {value === contact.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            <span className="block truncate font-semibold">{selected.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{[selected.jobtitle, selected.email].filter(Boolean).join(" · ")}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => onChange("")}><X className="h-4 w-4" /></Button>
        </div>
      ) : null}
    </div>
  );
}

export function DealActionDialog({ open, action, dealId, dealName, contacts, stageOptions, onOpenChange, onDone }: {
  open: boolean;
  action: DealActionKind | null;
  dealId: string;
  dealName: string;
  contacts: DealRoomContact[];
  stageOptions: Array<{ id: string; label: string; probability: number | null }>;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [contactId, setContactId] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [followUpAt, setFollowUpAt] = useState(() => toDateTimeLocal());
  const [subject, setSubject] = useState("");
  const [dueAt, setDueAt] = useState(() => toDateTimeLocal());
  const [taskType, setTaskType] = useState("TODO");
  const [priority, setPriority] = useState("MEDIUM");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(() => toDateTimeLocal());
  const [endAt, setEndAt] = useState(() => toDateTimeLocal());
  const [stageId, setStageId] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDueAt, setNextStepDueAt] = useState(() => toDateTimeLocal());
  const [blocker, setBlocker] = useState("");
  const [role, setRole] = useState<StakeholderRole | "">("");

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setError("");
    setOutcome("");
    setNotes("");
    setContactId("");
    setFollowUp(false);
    setSubject("");
    setTaskType("TODO");
    setPriority("MEDIUM");
    setTitle("");
    setStageId(stageOptions[0]?.id || "");
    setNextStep("");
    setBlocker("");
    setRole("");
    setFollowUpAt(toDateTimeLocal());
    setDueAt(toDateTimeLocal());
    setStartAt(toDateTimeLocal());
    setEndAt(toDateTimeLocal());
    setNextStepDueAt(toDateTimeLocal());
  }, [open, action, stageOptions]);

  async function submit() {
    if (!action) return;
    setSaving(true);
    setError("");
    try {
      const input: DealRoomActionInput = { action };
      switch (action) {
        case "log_call":
          if (!outcome.trim()) throw new Error("Résultat de l’appel obligatoire");
          if (!notes.trim()) throw new Error("Notes de l’appel obligatoires");
          input.outcome = outcome.trim();
          input.notes = notes.trim();
          input.contactId = contactId || undefined;
          input.followUp = followUp;
          input.followUpAt = followUp ? new Date(followUpAt).toISOString() : undefined;
          input.subject = followUp ? subject.trim() : undefined;
          break;
        case "note":
          if (!notes.trim()) throw new Error("Texte de la note obligatoire");
          input.notes = notes.trim();
          input.contactId = contactId || undefined;
          break;
        case "task":
          if (!subject.trim()) throw new Error("Sujet de la tâche obligatoire");
          input.subject = subject.trim();
          input.notes = notes.trim() || undefined;
          input.dueAt = new Date(dueAt).toISOString();
          input.taskType = taskType;
          input.priority = priority;
          input.contactId = contactId || undefined;
          break;
        case "meeting":
          if (!title.trim()) throw new Error("Titre du rendez-vous obligatoire");
          input.title = title.trim();
          input.startAt = new Date(startAt).toISOString();
          input.endAt = endAt ? new Date(endAt).toISOString() : undefined;
          input.contactId = contactId || undefined;
          input.notes = notes.trim() || undefined;
          break;
        case "stage":
          if (!stageId) throw new Error("Stage obligatoire");
          input.stageId = stageId;
          break;
        case "next_step":
          if (!nextStep.trim()) throw new Error("Prochaine action obligatoire");
          input.nextStep = nextStep.trim();
          input.dueAt = new Date(nextStepDueAt).toISOString();
          break;
        case "blocker":
          if (!blocker) throw new Error("Catégorie de blocage obligatoire");
          input.blocker = blocker;
          break;
        case "contact":
          if (!contactId) throw new Error("Contact obligatoire");
          input.contactId = contactId;
          input.role = role || undefined;
          break;
        default:
          break;
      }
      const result = await runDealAction(dealId, input);
      onOpenChange(false);
      const warnings = Array.isArray(result.warnings) && result.warnings.length ? ` ${result.warnings.join(" ")}` : "";
      onDone(`Enregistré dans HubSpot.${warnings}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer l’action");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openValue => !openValue && !saving && onOpenChange(false)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto minari-scrollbar">
        <DialogHeader>
          <DialogTitle>{action ? ACTION_TITLES[action] : "Action"}</DialogTitle>
          <DialogDescription>Deal : {dealName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {action === "log_call" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="callOutcome">Résultat de l’appel</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger id="callOutcome"><SelectValue placeholder="Sélectionner le résultat" /></SelectTrigger>
                  <SelectContent>{CALL_OUTCOMES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="callNotes">Notes de l’appel</Label>
                <textarea
                  id="callNotes"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Ce qui s’est dit, objections, suite…"
                  className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} />
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={followUp} onChange={event => setFollowUp(event.target.checked)} className="h-4 w-4 accent-violet-600" />
                Créer une relance automatique (tâche + prochaine action)
              </label>
              {followUp ? (
                <div className="grid gap-4 rounded-lg border border-border bg-muted/35 p-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="followUpSubject">Relance</Label>
                    <Input id="followUpSubject" value={subject} onChange={event => setSubject(event.target.value)} placeholder="Ex. Rappeler — Société — Contact" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="followUpAt">Date de relance</Label>
                    <Input id="followUpAt" type="datetime-local" value={followUpAt} onChange={event => setFollowUpAt(event.target.value)} />
                  </div>
                </div>
              ) : null}
              <p className="text-xs leading-5 text-muted-foreground">L’appel est créé dans HubSpot avec le résultat, puis associé au deal. La relance crée une tâche et met à jour la prochaine action du deal.</p>
            </>
          ) : null}

          {action === "note" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="noteBody">Note</Label>
                <textarea
                  id="noteBody"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  rows={5}
                  placeholder="Contexte, décision, engagement…"
                  className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} />
            </>
          ) : null}

          {action === "task" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="taskSubject">Sujet</Label>
                <Input id="taskSubject" value={subject} onChange={event => setSubject(event.target.value)} placeholder="Ex. Envoyer la proposition commerciale" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskDue">Échéance</Label>
                <Input id="taskDue" type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={taskType} onValueChange={setTaskType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priorité</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">Haute</SelectItem>
                      <SelectItem value="MEDIUM">Moyenne</SelectItem>
                      <SelectItem value="LOW">Basse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskNotes">Détail (facultatif)</Label>
                <textarea
                  id="taskNotes"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} />
            </>
          ) : null}

          {action === "meeting" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="meetingTitle">Titre</Label>
                <Input id="meetingTitle" value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex. Démo produit — Gando" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="meetingStart">Début</Label>
                  <Input id="meetingStart" type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meetingEnd">Fin</Label>
                  <Input id="meetingEnd" type="datetime-local" value={endAt} onChange={event => setEndAt(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meetingBody">Contexte / ordre du jour (facultatif)</Label>
                <textarea
                  id="meetingBody"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} />
            </>
          ) : null}

          {action === "stage" ? (
            <div className="space-y-2">
              <Label>Nouveau stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un stage" /></SelectTrigger>
                <SelectContent>
                  {stageOptions.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.label}{stage.probability !== null ? ` · ${Math.round(stage.probability * 100)} %` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Le stage est mis à jour dans HubSpot (source de vérité du pipeline).</p>
            </div>
          ) : null}

          {action === "next_step" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="nextStep">Prochaine action</Label>
                <Input id="nextStep" value={nextStep} onChange={event => setNextStep(event.target.value)} placeholder="Ex. Envoyer le contrat pour signature" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextStepDue">Échéance</Label>
                <Input id="nextStepDue" type="datetime-local" value={nextStepDueAt} onChange={event => setNextStepDueAt(event.target.value)} />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">La propriété « prochaine étape » du deal est mise à jour et une tâche HubSpot est créée à l’échéance indiquée.</p>
            </>
          ) : null}

          {action === "blocker" ? (
            <div className="space-y-2">
              <Label>Catégorie de blocage</Label>
              <Select value={blocker} onValueChange={setBlocker}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                <SelectContent>
                  {["Pricing", "Juridique", "Sécurité", "Technique", "API", "ERP", "Décision interne", "Budget", "Timing", "Concurrence", "Absence de champion", "Absence de décideur"].map(item => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">Le blocage est enregistré sur le deal (propriété dr_blockers) et rend le deal plus visible s’il est critique.</p>
            </div>
          ) : null}

          {action === "contact" ? (
            <>
              <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} />
              <div className="space-y-2">
                <Label>Rôle (facultatif)</Label>
                <Select value={role} onValueChange={value => setRole(value as StakeholderRole)}>
                  <SelectTrigger><SelectValue placeholder="Aucun rôle défini" /></SelectTrigger>
                  <SelectContent>{ROLES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Champion et Decision Maker / Economic Buyer sont enregistrés sur le deal (propriétés dr_champion_id, dr_decisionmaker_id).</p>
              </div>
            </>
          ) : null}
        </div>

        {error ? <div role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-300"><AlertCircle className="mr-1.5 inline h-4 w-4" />{error}</div> : null}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={saving || !action} onClick={() => void submit()}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />} Enregistrer dans HubSpot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StakeholderRoleDialog({ open, contact, currentRole, dealId, onOpenChange, onDone }: {
  open: boolean;
  contact: DealRoomContact | null;
  currentRole: "champion" | "decision" | null;
  dealId: string;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<"champion" | "decision">("champion");

  useEffect(() => {
    if (open) {
      setError("");
      setRole(currentRole === "decision" ? "decision" : "champion");
    }
  }, [open, currentRole]);

  async function submit() {
    if (!contact) return;
    setSaving(true);
    setError("");
    try {
      await runDealAction(dealId, { action: "stakeholder_role", contactId: contact.id, role: role === "champion" ? "Champion" : "Decision Maker" });
      onOpenChange(false);
      onDone(`« ${contact.name} » est désormais ${role === "champion" ? "champion" : "décideur"} du deal (HubSpot).`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer le rôle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openValue => !openValue && !saving && onOpenChange(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> Rôle de {contact?.name || "contact"}</DialogTitle>
          <DialogDescription>Le rôle sera enregistré sur le deal dans HubSpot.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Rôle</Label>
          <Select value={role} onValueChange={value => setRole(value as "champion" | "decision")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="champion">Champion</SelectItem>
              <SelectItem value="decision">Decision Maker</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? <div role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-300"><AlertCircle className="mr-1.5 inline h-4 w-4" />{error}</div> : null}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={saving} onClick={() => void submit()}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClosingPlanStepDialog({ open, stepLabel, currentStatus, dealId, stepKey, onOpenChange, onDone }: {
  open: boolean;
  stepLabel: string;
  currentStatus: ClosingPlanStatus;
  dealId: string;
  stepKey: string;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ClosingPlanStatus>(currentStatus);

  useEffect(() => {
    if (open) { setError(""); setStatus(currentStatus); }
  }, [open, currentStatus]);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await runDealAction(dealId, { action: "closing_plan", stepKey, stepStatus: status });
      onOpenChange(false);
      onDone(`Étape « ${stepLabel} » enregistrée (${status === "done" ? "terminée" : status === "in_progress" ? "en cours" : "non démarrée"}) dans HubSpot.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer l’étape");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openValue => !openValue && !saving && onOpenChange(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Étape du plan : {stepLabel}</DialogTitle>
          <DialogDescription>Le statut est enregistré sur le deal dans HubSpot (propriété dr_closing_plan).</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={status} onValueChange={value => setStatus(value as ClosingPlanStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Non démarrée</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="done">Terminée</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? <div role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-300"><AlertCircle className="mr-1.5 inline h-4 w-4" />{error}</div> : null}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={saving} onClick={() => void submit()}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}