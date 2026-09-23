"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  Check,
  CircleSlash2,
  Clock3,
  Loader2,
  MessageSquare,
  Pencil,
  PhoneCall,
  RotateCcw,
  Search,
  Target,
  ThumbsDown,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CrmRecordKind = "contact" | "company";
export type CrmStatusOption = { value: string; label: string };

type StatusMeta = {
  value: string;
  label: string;
  description: string;
  icon: typeof PhoneCall;
};

const COMPANY_STATUSES: StatusMeta[] = [
  { value: "À contacter", label: "À contacter", description: "Compte à appeler ou qualifier.", icon: Search },
  { value: "Tentative", label: "Tentative", description: "Une première tentative a déjà été faite.", icon: PhoneCall },
  { value: "Contact établi", label: "Contact établi", description: "Un échange a eu lieu avec le prospect.", icon: MessageSquare },
  { value: "À relancer", label: "À relancer", description: "Une nouvelle prise de contact est nécessaire.", icon: CalendarClock },
  { value: "Ultérieur", label: "Ultérieur", description: "Reporter le compte à une date choisie.", icon: Clock3 },
  { value: "Démo prévue", label: "Démo prévue", description: "Un rendez-vous ou une démonstration est planifié.", icon: CalendarCheck2 },
  { value: "Opportunité", label: "Opportunité", description: "Le besoin est qualifié et le deal est ouvert.", icon: Target },
  { value: "Gagné", label: "Gagné", description: "Le prospect est devenu client.", icon: Trophy },
  { value: "Pas intéressé", label: "Pas intéressé", description: "Le prospect ne souhaite pas poursuivre.", icon: ThumbsDown },
  { value: "Perdu", label: "Perdu", description: "L'opportunité est clôturée sans suite.", icon: XCircle },
];

const CONTACT_STATUSES: StatusMeta[] = [
  { value: "À prospecter", label: "À prospecter", description: "Contact à traiter pour la première fois.", icon: Search },
  { value: "En prospection", label: "En prospection", description: "La prise de contact est en cours.", icon: PhoneCall },
  { value: "Conversation", label: "Conversation", description: "Un échange est en cours avec ce contact.", icon: MessageSquare },
  { value: "RDV booké", label: "RDV booké", description: "Un rendez-vous est planifié.", icon: CalendarCheck2 },
  { value: "À recycler", label: "À recycler", description: "À reprendre plus tard dans la prospection.", icon: RotateCcw },
  { value: "Non qualifié", label: "Non qualifié", description: "Le contact ne correspond pas à la cible.", icon: CircleSlash2 },
  { value: "Pas intéressé", label: "Pas intéressé", description: "Le contact ne souhaite pas poursuivre.", icon: ThumbsDown },
  { value: "Perdu", label: "Perdu", description: "Le contact est sorti du cycle commercial.", icon: XCircle },
  { value: "Gagné", label: "Gagné", description: "Le contact a contribué à une conversion gagnée.", icon: Trophy },
];

function statusCatalog(kind: CrmRecordKind) {
  return kind === "company" ? COMPANY_STATUSES : CONTACT_STATUSES;
}

export function CRMProspectionStatusEditor({
  kind,
  value,
  options = [],
  disabled = false,
  onSave,
}: {
  kind: CrmRecordKind;
  value: string;
  options?: CrmStatusOption[];
  disabled?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [open, value]);

  const statuses = useMemo(() => {
    const canonical = statusCatalog(kind);
    const canonicalValues = new Set(canonical.map(item => item.value));
    const extra = options
      .filter(option => option.value && option.value !== "À travailler" && !canonicalValues.has(option.value))
      .map(option => ({
        value: option.value,
        label: option.label || option.value,
        description: "Statut disponible dans HubSpot.",
        icon: Target,
      }));
    return [...canonical, ...extra];
  }, [kind, options]);

  const currentLabel = statuses.find(item => item.value === value)?.label || value || "À qualifier";

  async function save() {
    if (!draft || draft === value || saving) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="group rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <Target size={13} className="shrink-0 text-primary" />
            <span className="truncate">Statut prospection</span>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraft(value);
              setOpen(true);
            }}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            title="Modifier le statut"
          >
            <Pencil size={13} />
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{currentLabel}</span>
          {value ? <Badge variant="outline" className="h-5 px-1.5 text-[9px]">Actuel</Badge> : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={next => !saving && setOpen(next)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le statut de prospection</DialogTitle>
            <DialogDescription>
              Choisissez le statut à appliquer à {kind === "company" ? "cette entreprise" : "ce contact"}. La modification sera synchronisée avec HubSpot.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-2">
            {statuses.map(item => {
              const Icon = item.icon;
              const active = draft === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDraft(item.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                    active
                      ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                      : "border-border bg-card hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      {value === item.value ? <Badge variant="outline" className="text-[9px]">Actuel</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={() => void save()} disabled={saving || !draft || draft === value}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Enregistrer le statut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
