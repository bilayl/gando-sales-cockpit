"use client";

import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void };

const EMPTY = { name: "", domain: "", phone: "", website: "", industry: "", city: "", zip: "", state: "", country: "", description: "" };
const FIELDS: Array<{ key: keyof typeof EMPTY; label: string; placeholder?: string }> = [
  { key: "name", label: "Nom de l’entreprise", placeholder: "ACME Location" },
  { key: "domain", label: "Domaine", placeholder: "acme.fr" },
  { key: "phone", label: "Téléphone" },
  { key: "website", label: "Site web", placeholder: "https://…" },
  { key: "industry", label: "Secteur" },
  { key: "city", label: "Ville" },
  { key: "zip", label: "Code postal" },
  { key: "state", label: "Région" },
  { key: "country", label: "Pays" },
];

export function NewCompanyDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof typeof EMPTY, value: string) { setForm(current => ({ ...current, [key]: value })); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const properties = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
    if (!properties.name && !properties.domain) {
      setError("Renseignez au moins le nom de l’entreprise ou son domaine.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/companies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ properties }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "HubSpot a rejeté la création de l’entreprise.");
      setForm(EMPTY);
      onOpenChange(false);
      onCreated();
      toast.success("Entreprise créée dans HubSpot.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible de créer l’entreprise.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Nouvelle entreprise</DialogTitle><DialogDescription>Crée l’entreprise directement dans HubSpot et la rend disponible dans le Sales Cockpit.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map(field => <div key={field.key} className="space-y-1.5"><Label className="text-xs text-muted-foreground">{field.label}</Label><Input value={form[field.key]} onChange={event => set(field.key, event.target.value)} placeholder={field.placeholder || field.label} /></div>)}</div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Description</Label><textarea value={form.description} onChange={event => set("description", event.target.value)} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Contexte ou description de l’entreprise" /></div>
        {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}Créer l’entreprise</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
