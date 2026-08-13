"use client";
import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void };

const EMPTY = { firstname: "", lastname: "", email: "", phone: "", mobilephone: "", jobtitle: "", company: "", city: "", state: "" };

const FIELDS: { key: keyof typeof EMPTY; label: string; required?: boolean }[] = [
  { key: "firstname", label: "Prénom" },
  { key: "lastname", label: "Nom" },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Téléphone" },
  { key: "mobilephone", label: "Mobile" },
  { key: "jobtitle", label: "Fonction" },
  { key: "company", label: "Entreprise" },
  { key: "city", label: "Ville" },
  { key: "state", label: "Région" },
];

export function NewContactDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof typeof EMPTY, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const properties = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, v.trim()]));
    if (!properties.firstname && !properties.lastname && !properties.email && !properties.phone) {
      setError("Renseignez au moins un nom, un email ou un téléphone.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ properties }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "HubSpot a rejeté la création");
      }
      setForm(EMPTY);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><UserPlus size={18} className="text-violet-300" /> Nouveau contact</DialogTitle>
          <DialogDescription>Créer un contact dans HubSpot. Il pourra ensuite être affecté à une liste.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                <Input value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.label} />
              </div>
            ))}
          </div>
          {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div> : null}
          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
            <Button type="submit" className="gap-1.5" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Créer le contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
