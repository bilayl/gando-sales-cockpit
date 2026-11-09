"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CockpitAssignment } from "@/hooks/queries/use-prospection-reference-data";

type Company = { id: string; properties: Record<string, string | null | undefined> };
type Member = { email: string; name: string; role: string };
type Props = {
  companies: Company[];
  assignments: CockpitAssignment[];
  onAssigned: () => void;
};

export function ProspectionAssignmentManager({ companies, assignments, onAssigned }: Props) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const membersQuery = useQuery({
    queryKey: ["prospection", "assignment-management-team"],
    queryFn: async (): Promise<Member[]> => {
      const response = await fetch("/api/prospection/assignments/manage", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) return [];
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de charger les commerciaux.");
      return Array.isArray(payload.members) ? payload.members : [];
    },
    staleTime: 60_000,
    retry: false,
  });

  const assignedIds = useMemo(() => new Set(assignments.map(item => item.company_id)), [assignments]);
  const unassigned = useMemo(() => companies.filter(company => (
    !assignedIds.has(company.id)
    && Boolean(String(company.properties.phone || company.properties.mobilephone || "").trim())
  )), [companies, assignedIds]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return unassigned.filter(company => (
      !needle || [company.properties.name, company.properties.city, company.properties.domain]
        .filter(Boolean).join(" ").toLowerCase().includes(needle)
    ));
  }, [unassigned, search]);
  const selectedIds = new Set(selected);

  function toggle(companyId: string) {
    setSelected(current => current.includes(companyId)
      ? current.filter(id => id !== companyId)
      : [...current, companyId]);
  }

  async function submit() {
    if (!recipient || selected.length === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/prospection/assignments/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assigneeEmail: recipient, companyIds: selected }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Attribution impossible.");
      if (payload.assignedCount > 0) toast.success(`${payload.assignedCount} entreprise${payload.assignedCount > 1 ? "s" : ""} attribuée${payload.assignedCount > 1 ? "s" : ""} au commercial.`);
      if (payload.skippedAssignedCount || payload.skippedIneligibleCount) {
        toast.info(`${(payload.skippedAssignedCount || 0) + (payload.skippedIneligibleCount || 0)} entreprise(s) ignorée(s) : déjà attribuées ou non éligibles.`);
      }
      onAssigned();
      setSelected([]);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur lors de l'attribution.");
    } finally {
      setBusy(false);
    }
  }

  if (!membersQuery.data?.length) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <UserRoundPlus size={14} /> Attribuer à un SDR
      </Button>
      <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); setError(""); } }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attribuer des entreprises à un SDR</DialogTitle>
            <DialogDescription>
              Choisissez des entreprises non attribuées et disposant d'un téléphone. Les comptes des autres commerciaux sont protégés.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Commercial destinataire</label>
              <Select value={recipient} onValueChange={setRecipient}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner un membre de l'équipe" /></SelectTrigger>
                <SelectContent>
                  {membersQuery.data.map(member => (
                    <SelectItem key={member.email} value={member.email}>
                      {member.name} · {member.role === "commercial" ? "SDR" : "Administrateur"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{unassigned.length} entreprises disponibles dans la sélection · {selected.length} cochée(s)</span>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="outline" disabled={!filtered.length} onClick={() => setSelected(filtered.slice(0, 40).map(company => company.id))}>Sélectionner 40</Button>
                <Button type="button" size="sm" variant="outline" disabled={!filtered.length} onClick={() => setSelected(filtered.slice(0, 80).map(company => company.id))}>Sélectionner 80</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>Effacer</Button>
              </div>
            </div>
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une entreprise, une ville…" />
            <div className="max-h-[310px] overflow-y-auto rounded-lg border border-border">
              {filtered.slice(0, 150).map(company => (
                <label key={company.id} className="flex cursor-pointer items-start gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0 hover:bg-muted/40">
                  <input type="checkbox" className="mt-1 accent-violet-600" checked={selectedIds.has(company.id)} onChange={() => toggle(company.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{company.properties.name || company.properties.domain || "Entreprise sans nom"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[company.properties.city, company.properties.country, company.properties.phone].filter(Boolean).join(" · ")}</span>
                  </span>
                </label>
              ))}
              {!filtered.length ? <p className="p-5 text-sm text-muted-foreground">Aucune entreprise non attribuée et joignable avec ces filtres. Essayez « Toutes les entreprises » ou retirez les filtres.</p> : null}
            </div>
            {filtered.length > 150 ? <p className="text-xs text-muted-foreground">Les 150 premières entreprises sont affichées. Affinez la recherche pour en choisir d'autres.</p> : null}
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
              <Button onClick={() => void submit()} disabled={busy || !recipient || selected.length === 0 || selected.length > 100}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Attribuer {selected.length} entreprise{selected.length > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
