"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void };
type CompanyOption = { id: string; label: string; properties: Record<string, string | null | undefined> };

const EMPTY = { firstname: "", lastname: "", email: "", phone: "", mobilephone: "", jobtitle: "", city: "", state: "" };

const FIELDS: { key: keyof typeof EMPTY; label: string }[] = [
  { key: "firstname", label: "Prénom" },
  { key: "lastname", label: "Nom" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Téléphone" },
  { key: "mobilephone", label: "Mobile" },
  { key: "jobtitle", label: "Fonction" },
  { key: "city", label: "Ville" },
  { key: "state", label: "Région" },
];

function companyLabel(properties: Record<string, string | null | undefined>) {
  return properties.name || properties.domain || "Entreprise";
}

export function NewContactDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<CompanyOption[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<CompanyOption[]>([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);

  function set(key: keyof typeof EMPTY, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    if (!open || companyQuery.trim().length < 2) {
      setCompanyResults([]);
      setSearchingCompanies(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingCompanies(true);
      try {
        const response = await fetch(`/api/companies?q=${encodeURIComponent(companyQuery.trim())}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Recherche d’entreprises impossible");
        setCompanyResults((payload.results || []).map((item: any) => ({
          id: String(item.id),
          properties: item.properties || {},
          label: companyLabel(item.properties || {}),
        })));
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Recherche d’entreprises impossible");
      } finally {
        if (!controller.signal.aborted) setSearchingCompanies(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, companyQuery]);

  function toggleCompany(company: CompanyOption) {
    setSelectedCompanies(current => current.some(item => item.id === company.id)
      ? current.filter(item => item.id !== company.id)
      : [...current, company]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const properties = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== "").map(([key, value]) => [key, value.trim()]));
    if (!properties.firstname && !properties.lastname && !properties.email && !properties.phone) {
      setError("Renseignez au moins un nom, un email ou un téléphone.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ properties }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "HubSpot a rejeté la création");

      let failedAssociations = 0;
      await Promise.all(selectedCompanies.map(async company => {
        const association = await fetch(`/api/contacts/${encodeURIComponent(String(payload.id))}/companies`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ companyId: company.id }),
        });
        if (!association.ok) failedAssociations += 1;
      }));

      setForm(EMPTY);
      setCompanyQuery("");
      setCompanyResults([]);
      setSelectedCompanies([]);
      onCreated();
      onOpenChange(false);
      toast.success(selectedCompanies.length ? "Contact créé et associé dans HubSpot." : "Contact créé dans HubSpot.");
      if (failedAssociations) toast.warning(`${failedAssociations} association${failedAssociations > 1 ? "s" : ""} n’a pas pu être enregistrée.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible de créer le contact";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><UserPlus size={18} className="text-primary" /> Nouveau contact</DialogTitle>
          <DialogDescription>Crée le contact dans HubSpot et associe-le immédiatement à une ou plusieurs entreprises.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
                <Input value={form[field.key]} onChange={event => set(field.key, event.target.value)} placeholder={field.label} />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Building2 size={15} className="text-primary" /> Entreprises associées <span className="text-xs font-normal text-muted-foreground">(optionnel)</span></div>
            {selectedCompanies.length ? <div className="mt-2 flex flex-wrap gap-2">{selectedCompanies.map(company => <button type="button" key={company.id} onClick={() => toggleCompany(company)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">{company.label}<X size={11} /></button>)}</div> : null}
            <div className="relative mt-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={companyQuery} onChange={event => setCompanyQuery(event.target.value)} placeholder="Rechercher une entreprise par nom, domaine ou ville…" className="pl-9" />
              {searchingCompanies ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" /> : null}
            </div>
            {companyQuery.trim().length >= 2 ? <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border bg-card">
              {companyResults.length ? companyResults.map(company => {
                const selected = selectedCompanies.some(item => item.id === company.id);
                return <button type="button" key={company.id} onClick={() => toggleCompany(company)} className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/60"><div className="min-w-0"><div className="truncate text-sm font-semibold">{company.label}</div><div className="truncate text-xs text-muted-foreground">{[company.properties.domain, company.properties.city].filter(Boolean).join(" · ") || "Entreprise HubSpot"}</div></div>{selected ? <Check size={15} className="shrink-0 text-primary" /> : <Building2 size={14} className="shrink-0 text-muted-foreground" />}</button>;
              }) : !searchingCompanies ? <div className="px-3 py-4 text-center text-xs text-muted-foreground">Aucune entreprise trouvée.</div> : null}
            </div> : null}
          </div>

          {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div> : null}
          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
            <Button type="submit" className="gap-1.5" disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Créer le contact</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
