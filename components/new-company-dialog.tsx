"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void };
type ContactOption = { id: string; label: string; properties: Record<string, string | null | undefined> };

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

function contactLabel(properties: Record<string, string | null | undefined>) {
  return [properties.firstname, properties.lastname].filter(Boolean).join(" ") || properties.email || properties.phone || "Contact";
}

export function NewCompanyDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactOption[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<ContactOption[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  function set(key: keyof typeof EMPTY, value: string) { setForm(current => ({ ...current, [key]: value })); }

  useEffect(() => {
    if (!open || contactQuery.trim().length < 2) {
      setContactResults([]);
      setSearchingContacts(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingContacts(true);
      try {
        const response = await fetch(`/api/contacts?q=${encodeURIComponent(contactQuery.trim())}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Recherche de contacts impossible");
        setContactResults((payload.results || []).map((item: any) => ({
          id: String(item.id),
          properties: item.properties || {},
          label: contactLabel(item.properties || {}),
        })));
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Recherche de contacts impossible");
      } finally {
        if (!controller.signal.aborted) setSearchingContacts(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, contactQuery]);

  function toggleContact(contact: ContactOption) {
    setSelectedContacts(current => current.some(item => item.id === contact.id)
      ? current.filter(item => item.id !== contact.id)
      : [...current, contact]);
  }

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

      let failedAssociations = 0;
      await Promise.all(selectedContacts.map(async contact => {
        const association = await fetch(`/api/companies/${encodeURIComponent(String(payload.id))}/contacts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contactId: contact.id }),
        });
        if (!association.ok) failedAssociations += 1;
      }));

      setForm(EMPTY);
      setContactQuery("");
      setContactResults([]);
      setSelectedContacts([]);
      onOpenChange(false);
      onCreated();
      toast.success(selectedContacts.length ? "Entreprise créée et contacts associés dans HubSpot." : "Entreprise créée dans HubSpot.");
      if (failedAssociations) toast.warning(`${failedAssociations} association${failedAssociations > 1 ? "s" : ""} n’a pas pu être enregistrée.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible de créer l’entreprise.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Nouvelle entreprise</DialogTitle><DialogDescription>Crée l’entreprise dans HubSpot et associe immédiatement les contacts concernés.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map(field => <div key={field.key} className="space-y-1.5"><Label className="text-xs text-muted-foreground">{field.label}</Label><Input value={form[field.key]} onChange={event => set(field.key, event.target.value)} placeholder={field.placeholder || field.label} /></div>)}</div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Description</Label><textarea value={form.description} onChange={event => set("description", event.target.value)} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Contexte ou description de l’entreprise" /></div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><UserRound size={15} className="text-primary" /> Contacts associés <span className="text-xs font-normal text-muted-foreground">(optionnel)</span></div>
          {selectedContacts.length ? <div className="mt-2 flex flex-wrap gap-2">{selectedContacts.map(contact => <button type="button" key={contact.id} onClick={() => toggleContact(contact)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">{contact.label}<X size={11} /></button>)}</div> : null}
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={contactQuery} onChange={event => setContactQuery(event.target.value)} placeholder="Rechercher un contact par nom, email ou téléphone…" className="pl-9" />
            {searchingContacts ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" /> : null}
          </div>
          {contactQuery.trim().length >= 2 ? <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border bg-card">
            {contactResults.length ? contactResults.map(contact => {
              const selected = selectedContacts.some(item => item.id === contact.id);
              return <button type="button" key={contact.id} onClick={() => toggleContact(contact)} className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/60"><div className="min-w-0"><div className="truncate text-sm font-semibold">{contact.label}</div><div className="truncate text-xs text-muted-foreground">{[contact.properties.email, contact.properties.phone || contact.properties.mobilephone, contact.properties.jobtitle].filter(Boolean).join(" · ") || "Contact HubSpot"}</div></div>{selected ? <Check size={15} className="shrink-0 text-primary" /> : <UserRound size={14} className="shrink-0 text-muted-foreground" />}</button>;
            }) : !searchingContacts ? <div className="px-3 py-4 text-center text-xs text-muted-foreground">Aucun contact trouvé.</div> : null}
          </div> : null}
        </div>

        {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}Créer l’entreprise</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
