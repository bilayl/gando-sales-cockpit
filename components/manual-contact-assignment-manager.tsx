"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Contact = { id: string; properties: Record<string, string | null | undefined> };
type Member = { email: string; name: string; role: string };
type Assignment = { contact_id: string; assignee_cockpit_email: string };
type Payload = {
  assignments: Assignment[];
  members: Member[];
  canManageTeam: boolean;
  currentUserEmail: string;
};

function label(contact: Contact) {
  const p = contact.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || p.phone || "Contact sans nom";
}

export function ManualContactAssignmentManager({ contacts }: { contacts: Contact[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [assignee, setAssignee] = useState("__unassigned__");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const data = useQuery({
    queryKey: ["prospection", "manual-contact-assignments"],
    queryFn: async (): Promise<Payload> => {
      const response = await fetch("/api/prospection/contact-assignments", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Impossible de charger les attributions.");
      return body as Payload;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const assignmentById = useMemo(
    () => new Map((data.data?.assignments || []).map(row => [row.contact_id, row.assignee_cockpit_email])),
    [data.data?.assignments],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(contact => {
      if (!q) return true;
      const p = contact.properties;
      return [p.firstname, p.lastname, p.email, p.phone, p.company, p.city]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    }).slice(0, 60);
  }, [contacts, search]);

  if (!data.data?.canManageTeam) return null;

  async function save() {
    if (!selectedId || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/prospection/contact-assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactId: selectedId,
          assigneeEmail: assignee === "__unassigned__" ? "" : assignee,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Attribution impossible.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prospection", "manual-contact-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["today", "dashboard"] }),
      ]);
      setOpen(false);
      setSelectedId("");
      setSearch("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Attribution impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <UserRoundPlus size={14} /> Attribuer un contact
      </Button>
      <Dialog open={open} onOpenChange={next => { if (!saving) { setOpen(next); setError(""); } }}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attribuer un contact à un SDR</DialogTitle>
            <DialogDescription>
              L'attribution est uniquement manuelle et porte sur un contact, jamais sur l'entreprise.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un contact, téléphone, société…" />
            <div className="max-h-[250px] overflow-y-auto rounded-lg border border-border">
              {filtered.map(contact => {
                const assigned = assignmentById.get(contact.id);
                return (
                  <button key={contact.id} type="button" onClick={() => {
                    setSelectedId(contact.id);
                    setAssignee(assigned || "__unassigned__");
                  }} className={`block w-full border-b border-border/50 px-3 py-2 text-left last:border-0 hover:bg-muted/50 ${selectedId === contact.id ? "bg-primary/10" : ""}`}>
                    <span className="block text-sm font-semibold">{label(contact)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[contact.properties.company, contact.properties.phone || contact.properties.mobilephone, assigned ? `Déjà attribué : ${assigned}` : "Non attribué"].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                );
              })}
              {!filtered.length ? <p className="p-4 text-xs text-muted-foreground">Aucun contact trouvé dans cette sélection.</p> : null}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">{selectedId ? "SDR responsable du contact" : "Sélectionnez d'abord un contact"}</p>
              <Select value={assignee} onValueChange={setAssignee} disabled={!selectedId}>
                <SelectTrigger><SelectValue placeholder="Choisir un SDR" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Non attribué</SelectItem>
                  {(data.data?.members || []).map(member => (
                    <SelectItem key={member.email} value={member.email}>{member.name} · {member.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Annuler</Button>
              <Button size="sm" disabled={saving || !selectedId} onClick={() => void save()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Enregistrer l'attribution
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
