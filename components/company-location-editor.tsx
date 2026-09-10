"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MapPin, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Location = {
  address: string;
  address2: string;
  zip: string;
  city: string;
  state: string;
  country: string;
};

type ApiPayload = { location?: Location; error?: string };

const EMPTY_LOCATION: Location = {
  address: "",
  address2: "",
  zip: "",
  city: "",
  state: "",
  country: "",
};

function locationLabel(location: Location) {
  const street = [location.address, location.address2].filter(Boolean).join(", ");
  const city = [location.zip, location.city].filter(Boolean).join(" ");
  return [street, city, location.state, location.country].filter(Boolean).join(" · ") || "Localisation non renseignée";
}

export function CompanyLocationEditor({ recordId }: { recordId: string }) {
  const [location, setLocation] = useState<Location>(EMPTY_LOCATION);
  const [draft, setDraft] = useState<Location>(EMPTY_LOCATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/companies/${encodeURIComponent(recordId)}/location`, { cache: "no-store" });
        const payload: ApiPayload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Impossible de charger la localisation.");
        if (!cancelled) {
          const next = { ...EMPTY_LOCATION, ...(payload.location || {}) };
          setLocation(next);
          setDraft(next);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Impossible de charger la localisation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [recordId]);

  const label = useMemo(() => locationLabel(location), [location]);

  function cancel() {
    setDraft(location);
    setEditing(false);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(recordId)}/location`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location: draft }),
      });
      const payload: ApiPayload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible d'enregistrer la localisation.");
      const next = { ...EMPTY_LOCATION, ...(payload.location || draft) };
      setLocation(next);
      setDraft(next);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d'enregistrer la localisation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell px-4 pt-4 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><MapPin size={13} /> Localisation entreprise</div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {loading ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 size={13} className="animate-spin" /> Chargement…</span> : label}
              </div>
            </div>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={loading} className="h-8 gap-1.5"><Pencil size={13} /> Modifier</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancel} disabled={saving} className="h-8 gap-1.5"><X size={13} /> Annuler</Button>
                <Button size="sm" onClick={() => void save()} disabled={saving} className="h-8 gap-1.5">{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer</Button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="grid gap-3 border-t border-border bg-muted/20 px-4 py-4 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2"><span className="text-[10px] font-semibold text-muted-foreground">Adresse</span><Input className="mt-1 h-9" value={draft.address} onChange={event => setDraft(current => ({ ...current, address: event.target.value }))} placeholder="12 rue…" /></label>
              <label><span className="text-[10px] font-semibold text-muted-foreground">Complément</span><Input className="mt-1 h-9" value={draft.address2} onChange={event => setDraft(current => ({ ...current, address2: event.target.value }))} placeholder="Bâtiment, étage…" /></label>
              <label><span className="text-[10px] font-semibold text-muted-foreground">Code postal</span><Input className="mt-1 h-9" value={draft.zip} onChange={event => setDraft(current => ({ ...current, zip: event.target.value }))} placeholder="75001" /></label>
              <label><span className="text-[10px] font-semibold text-muted-foreground">Ville</span><Input className="mt-1 h-9" value={draft.city} onChange={event => setDraft(current => ({ ...current, city: event.target.value }))} placeholder="Paris" /></label>
              <label><span className="text-[10px] font-semibold text-muted-foreground">Région / État</span><Input className="mt-1 h-9" value={draft.state} onChange={event => setDraft(current => ({ ...current, state: event.target.value }))} placeholder="Île-de-France" /></label>
              <label className="xl:col-span-2"><span className="text-[10px] font-semibold text-muted-foreground">Pays</span><Input className="mt-1 h-9" value={draft.country} onChange={event => setDraft(current => ({ ...current, country: event.target.value }))} placeholder="France" /></label>
            </div>
          ) : null}

          {error ? <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">{error}</div> : null}
        </Card>
      </div>
    </div>
  );
}
