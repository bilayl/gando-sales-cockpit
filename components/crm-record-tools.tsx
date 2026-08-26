"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Database, FilePlus2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Kind = "contact" | "company";

type Definition = {
  name: string;
  label?: string;
  description?: string;
  groupName?: string;
  type?: string;
  fieldType?: string;
  displayOrder?: number;
  hidden?: boolean;
  hubspotDefined?: boolean;
  options?: Array<{ label?: string; value?: string; hidden?: boolean; displayOrder?: number }>;
};

type Group = { name: string; label: string; displayOrder: number };

type PropertiesPayload = {
  properties: Record<string, unknown>;
  definitions: Definition[];
  groups: Group[];
};

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formattedValue(definition: Definition, raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return "—";
  const value = String(raw);
  const option = definition.options?.find(item => String(item.value) === value);
  if (option?.label) return option.label;

  if (definition.fieldType === "booleancheckbox" || definition.type === "bool") {
    if (value === "true") return "Oui";
    if (value === "false") return "Non";
  }

  if (definition.type === "date" || definition.fieldType === "date") {
    const date = new Date(/^\d+$/.test(value) ? Number(value) : value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
  }

  if (definition.type === "datetime") {
    const date = new Date(/^\d+$/.test(value) ? Number(value) : value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  return value;
}

export function NewCRMNoteButton({ kind, recordId, onCreated }: { kind: Kind; recordId: string; onCreated: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function createNote() {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/crm/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, recordId, body: body.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "HubSpot a refusé la note");
      setBody("");
      setOpen(false);
      toast.success("Note ajoutée dans HubSpot.");
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’ajouter la note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><FilePlus2 size={14} /> Nouvelle note</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter une note HubSpot</DialogTitle>
            <DialogDescription>Cette note sera enregistrée directement dans HubSpot et visible dans la timeline de la fiche.</DialogDescription>
          </DialogHeader>
          <textarea
            autoFocus
            value={body}
            onChange={event => setBody(event.target.value)}
            placeholder="Écrivez la note commerciale complète…"
            rows={10}
            className="min-h-48 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <div className="text-right text-[11px] text-muted-foreground">{body.length}/20 000</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={() => void createNote()} disabled={saving || !body.trim() || body.length > 20000}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />} Ajouter dans HubSpot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AllCRMProperties({ kind, recordId }: { kind: Kind; recordId: string }) {
  const [payload, setPayload] = useState<PropertiesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/crm/record-properties?kind=${kind}&id=${encodeURIComponent(recordId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de charger les propriétés HubSpot");
      setPayload(data);
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les propriétés HubSpot");
    } finally {
      setLoading(false);
    }
  }

  const visible = useMemo(() => {
    if (!payload) return [] as Definition[];
    const needle = normalize(query);
    return payload.definitions.filter(definition => {
      const raw = payload.properties[definition.name];
      if (!showEmpty && (raw === null || raw === undefined || raw === "")) return false;
      if (!needle) return true;
      return normalize(`${definition.label || ""} ${definition.name} ${raw ?? ""}`).includes(needle);
    });
  }, [payload, query, showEmpty]);

  const grouped = useMemo(() => {
    if (!payload) return [] as Array<{ group: Group; properties: Definition[] }>;
    const groupMap = new Map(payload.groups.map(group => [group.name, group]));
    const map = new Map<string, Definition[]>();
    for (const definition of visible) {
      const key = definition.groupName || "__other";
      map.set(key, [...(map.get(key) || []), definition]);
    }
    return Array.from(map.entries())
      .map(([name, properties]) => ({
        group: groupMap.get(name) || { name, label: name === "__other" ? "Autres propriétés" : name, displayOrder: 999999 },
        properties,
      }))
      .sort((a, b) => a.group.displayOrder - b.group.displayOrder);
  }, [payload, visible]);

  const filledCount = payload?.definitions.filter(definition => {
    const value = payload.properties[definition.name];
    return value !== null && value !== undefined && value !== "";
  }).length || 0;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={() => { if (!loaded) void load(); }}
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"><Database size={14} /> Toutes les propriétés HubSpot</div>
          <div className="mt-1 text-xs text-muted-foreground">{loaded ? `${filledCount} champs renseignés sur ${payload?.definitions.length || 0}` : "Charger toute la fiche HubSpot"}</div>
        </div>
        {loading ? <Loader2 size={16} className="animate-spin text-primary" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {loaded ? (
        <div className="border-t border-border p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un champ ou une valeur…" className="pl-9" /></div>
            <Button variant={showEmpty ? "secondary" : "outline"} size="sm" onClick={() => setShowEmpty(value => !value)}>{showEmpty ? "Masquer les champs vides" : "Voir les champs vides"}</Button>
          </div>
          {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">{error}</div> : null}
          <div className="max-h-[680px] space-y-4 overflow-auto pr-1 minari-scrollbar">
            {grouped.map(({ group, properties }) => (
              <section key={group.name}>
                <div className="sticky top-0 z-[1] mb-2 flex items-center gap-2 bg-card py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{group.label}<Badge variant="outline" className="text-[9px]">{properties.length}</Badge></div>
                <div className="grid gap-2">
                  {properties.map(definition => (
                    <div key={definition.name} className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="text-xs font-semibold">{definition.label || definition.name}</div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">{formattedValue(definition, payload?.properties[definition.name])}</div>
                      <div className="mt-1.5 break-all font-mono text-[9px] text-muted-foreground/70">{definition.name}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {!grouped.length ? <div className="py-8 text-center text-xs text-muted-foreground">Aucune propriété ne correspond à cette recherche.</div> : null}
          </div>
        </div>
      ) : error ? <div className="border-t border-border p-3 text-xs text-destructive">{error}</div> : null}
    </Card>
  );
}
