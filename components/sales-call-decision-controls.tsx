"use client";

import { useMemo, useState } from "react";
import { Ban, CalendarClock, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  contactId: string;
  decision?: string | null;
  snoozedUntil?: string | null;
  reason?: string | null;
  onChanged: () => void;
};

const EXCLUSION_REASONS = [
  "Demande explicite de ne plus être appelé",
  "Hors cible",
  "Déjà client / déjà traité",
  "Mauvais numéro",
  "Doublon",
  "Contact non pertinent",
  "Autre",
];

function defaultSnoozeValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SalesCallDecisionControls({ contactId, decision, snoozedUntil, reason, onChanged }: Props) {
  const [mode, setMode] = useState<"SNOOZED" | "EXCLUDED" | null>(null);
  const [saving, setSaving] = useState(false);
  const [snoozeValue, setSnoozeValue] = useState(defaultSnoozeValue);
  const [snoozeReason, setSnoozeReason] = useState(reason || "");
  const [excludeReason, setExcludeReason] = useState(reason || EXCLUSION_REASONS[0]);
  const isManual = decision === "SNOOZED" || decision === "EXCLUDED";

  const manualLabel = useMemo(() => {
    if (decision === "EXCLUDED") return "Ne plus appeler";
    if (decision === "SNOOZED") {
      const date = snoozedUntil ? new Date(snoozedUntil) : null;
      return date && !Number.isNaN(date.getTime())
        ? `Rappel ${date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`
        : "Rappel ultérieur";
    }
    return null;
  }, [decision, snoozedUntil]);

  async function save(nextDecision: "ACTIVE" | "SNOOZED" | "EXCLUDED") {
    if (saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { contactId, decision: nextDecision };
      if (nextDecision === "SNOOZED") {
        body.snoozedUntil = new Date(snoozeValue).toISOString();
        body.reason = snoozeReason.trim() || "À rappeler ultérieurement";
      }
      if (nextDecision === "EXCLUDED") body.reason = excludeReason;
      const response = await fetch("/api/call-recommendations/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || "Impossible d’enregistrer la décision Sales");
      setMode(null);
      toast.success(nextDecision === "ACTIVE" ? "Contact remis en prospection." : nextDecision === "SNOOZED" ? "Contact retiré de la session jusqu’à la date choisie." : "Contact exclu des futurs appels.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer la décision Sales");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex min-w-[210px] flex-wrap items-center gap-1.5" onClick={event => event.stopPropagation()}>
        {isManual ? (
          <>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/[0.05] px-2.5 text-[11px] font-semibold text-primary">
              <ShieldCheck size={13} /> {manualLabel}
            </span>
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2" disabled={saving} onClick={() => void save("ACTIVE")}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Réactiver
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2" onClick={() => setMode("SNOOZED")}>
              <CalendarClock size={13} /> Plus tard
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2 text-destructive hover:text-destructive" onClick={() => setMode("EXCLUDED")}>
              <Ban size={13} /> Ne plus appeler
            </Button>
          </>
        )}
      </div>

      <Dialog open={mode === "SNOOZED"} onOpenChange={open => !saving && !open && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock size={18} className="text-primary" /> Rappeler plus tard</DialogTitle>
            <DialogDescription>Le contact disparaît immédiatement de la session et revient automatiquement dans le scoring après cette date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5"><Label>Date et heure de rappel</Label><Input type="datetime-local" value={snoozeValue} onChange={event => setSnoozeValue(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Raison</Label><Input value={snoozeReason} onChange={event => setSnoozeReason(event.target.value)} placeholder="Ex. rappeler après les vacances" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
            <Button onClick={() => void save("SNOOZED")} disabled={saving || !snoozeValue}>{saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}Programmer le rappel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "EXCLUDED"} onOpenChange={open => !saving && !open && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban size={18} className="text-destructive" /> Ne plus appeler ce contact</DialogTitle>
            <DialogDescription>Cette décision passe au-dessus du score automatique. Le contact restera dans le CRM mais n’entrera plus dans une session d’appels.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label>Raison de l’exclusion</Label>
            <Select value={excludeReason} onValueChange={setExcludeReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXCLUSION_REASONS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
            <Button variant="destructive" onClick={() => void save("EXCLUDED")} disabled={saving}>{saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}Exclure des appels</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
