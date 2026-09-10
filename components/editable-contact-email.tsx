"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Mail, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  contactId?: string;
  email?: string | null;
  associated?: boolean;
  compact?: boolean;
  onSaved?: () => void | Promise<void>;
};

export function EditableContactEmail({ contactId, email, associated = false, compact = false, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(email || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setValue(email || "");
  }, [email, editing]);

  async function save() {
    if (!contactId || saving) return;
    const next = value.trim();
    if (next && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error("Adresse email invalide.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties: { email: next } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de modifier l’email");
      setEditing(false);
      toast.success("Email mis à jour dans HubSpot.");
      await onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier l’email");
    } finally {
      setSaving(false);
    }
  }

  if (!contactId) {
    return email ? (
      <a href={`mailto:${email}`} className={cn("inline-flex max-w-full items-center gap-1.5 font-medium text-primary hover:underline", compact ? "text-xs" : "text-sm")}>
        <Mail size={compact ? 12 : 14} /><span className="truncate">{email}</span>{associated ? <span className="text-muted-foreground">· contact associé</span> : null}
      </a>
    ) : <span className="text-muted-foreground">—</span>;
  }

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          autoFocus
          type="email"
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") setEditing(false);
          }}
          placeholder="email@entreprise.fr"
          className={cn("min-w-0", compact ? "h-8 w-64 text-xs" : "h-9 w-full")}
          disabled={saving}
        />
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void save()} disabled={saving} aria-label="Enregistrer l’email">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(false)} disabled={saving} aria-label="Annuler">
          <X size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", compact && "mt-1.5")}>
      {email ? (
        <a href={`mailto:${email}`} className={cn("inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:underline", compact ? "text-xs" : "text-sm")}>
          <Mail size={compact ? 12 : 14} className="shrink-0" /><span className="truncate">{email}</span>{associated ? <span className="shrink-0 text-muted-foreground">· contact associé</span> : null}
        </a>
      ) : (
        <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", compact ? "text-xs" : "text-sm")}><Mail size={compact ? 12 : 14} /> Email à renseigner</span>
      )}
      <Button type="button" variant="ghost" size="sm" className={cn("shrink-0 gap-1 text-muted-foreground hover:text-foreground", compact ? "h-7 px-2 text-[11px]" : "h-8 px-2.5 text-xs")} onClick={() => setEditing(true)}>
        <Pencil size={12} /> Modifier
      </Button>
    </div>
  );
}
