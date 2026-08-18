"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarClock, Loader2, Phone, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type Company = { id: string; properties: Record<string, string | null | undefined> };

type Props = {
  companies: Company[];
  ownerNames: Record<string, string>;
  loading?: boolean;
  onOpenCompany: (id: string) => void;
  onStatusChange: (companyId: string, status: string) => void;
  onError: (message: string) => void;
};

export const COMPANY_PIPELINE = [
  { value: "NEW", label: "À travailler" },
  { value: "OPEN", label: "À contacter" },
  { value: "ATTEMPTED_TO_CONTACT", label: "Tentative" },
  { value: "CONNECTED", label: "Contact établi" },
  { value: "BAD_TIMING", label: "À relancer" },
  { value: "OPEN_DEAL", label: "Opportunité" },
  { value: "UNQUALIFIED", label: "Non qualifié" },
] as const;

function callLabel(value?: string | null) {
  const labels: Record<string, string> = {
    interesse: "Intéressé",
    interesse_mais: "Intéressé mais",
    a_une_date_ulterieure: "À une date ultérieure",
    a_rappeler: "À rappeler",
    pas_interesse: "Pas intéressé",
    occupe: "Occupé",
    nrp: "NRP",
    hors_cible: "Hors cible",
    en_attente_decision: "En attente décision",
    numero_invalide: "Numéro invalide",
    autres: "Autres",
  };
  return value ? labels[value] || value : "Aucun appel";
}

export function CompanyProspectionBoard({ companies, ownerNames, loading, onOpenCompany, onStatusChange, onError }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Company[]>();
    for (const column of COMPANY_PIPELINE) map.set(column.value, []);
    for (const company of companies) {
      const status = company.properties.hs_lead_status || "NEW";
      (map.get(status) || map.get("NEW"))?.push(company);
    }
    return map;
  }, [companies]);

  async function move(company: Company, status: string) {
    if (company.properties.hs_lead_status === status) return;
    setSavingId(company.id);
    try {
      const response = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties: { hs_lead_status: status } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "HubSpot a rejeté le changement de statut");
      onStatusChange(company.id, status);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de déplacer l’entreprise");
    } finally {
      setSavingId(null);
      setDragId(null);
      setDragOver(null);
    }
  }

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden border-t border-border minari-scrollbar">
      <div className="flex h-full min-w-max items-start gap-3 p-4">
        {COMPANY_PIPELINE.map(column => {
          const cards = groups.get(column.value) || [];
          const isOver = dragOver === column.value;
          return (
            <section
              key={column.value}
              onDragOver={event => { if (dragId) { event.preventDefault(); setDragOver(column.value); } }}
              onDragLeave={() => setDragOver(current => current === column.value ? null : current)}
              onDrop={event => {
                event.preventDefault();
                const company = companies.find(item => item.id === dragId);
                if (company) void move(company, column.value);
              }}
              className={`flex h-full max-h-[calc(100vh-285px)] w-72 shrink-0 flex-col rounded-xl border ${isOver ? "border-primary bg-accent/50" : "border-border bg-muted/30"}`}
            >
              <header className="flex items-center gap-2 px-3 py-3">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <Badge variant="secondary" className="ml-auto text-[10px]">{cards.length}</Badge>
              </header>
              <div className="min-h-[120px] flex-1 space-y-2 overflow-y-auto px-3 pb-3 minari-scrollbar">
                {cards.map(company => {
                  const p = company.properties;
                  const contacts = Number(p.num_associated_contacts || 0);
                  const deals = Number(p.num_associated_deals || 0);
                  const reminder = p.date_de_rappel || p.notes_next_activity_date;
                  return (
                    <article
                      key={company.id}
                      draggable
                      onDragStart={event => { setDragId(company.id); event.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      className={`cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/30 hover:bg-muted/20 active:cursor-grabbing ${dragId === company.id || savingId === company.id ? "opacity-55" : ""}`}
                    >
                      <button onClick={() => onOpenCompany(company.id)} className="flex w-full items-start gap-2.5 text-left">
                        <Avatar className="h-8 w-8 shrink-0 rounded-lg bg-accent">
                          <AvatarFallback className="rounded-lg bg-accent text-primary"><Building2 size={15} /></AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold hover:text-primary">{p.name || "Entreprise sans nom"}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{p.domain || [p.city, p.country].filter(Boolean).join(", ") || "Compte HubSpot"}</span>
                        </span>
                      </button>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground"><Users size={10} /> {contacts} contact{contacts > 1 ? "s" : ""}</Badge>
                        {deals > 0 ? <Badge variant="outline" className="text-[10px] text-primary">{deals} deal{deals > 1 ? "s" : ""}</Badge> : null}
                        {p.statut_de_lappel ? <Badge variant="outline" className="text-[10px]">{callLabel(p.statut_de_lappel)}</Badge> : null}
                      </div>

                      {reminder ? (
                        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                          <CalendarClock size={12} /> Rappel {formatDate(reminder)}
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                        <span className="truncate">{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "Commercial" : "Non assigné"}</span>
                        {p.phone ? <a href={`tel:${p.phone}`} onClick={event => event.stopPropagation()} className="inline-flex shrink-0 items-center gap-1 hover:text-primary"><Phone size={11} /> Appeler</a> : <span>{formatDate(p.notes_last_updated || p.hs_last_sales_activity_timestamp)}</span>}
                      </div>
                    </article>
                  );
                })}
                {!cards.length ? <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Aucune entreprise</div> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
