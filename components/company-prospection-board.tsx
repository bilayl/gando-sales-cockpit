"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarClock, CheckCircle2, Clock3, Loader2, Phone, RotateCcw, Trophy, Users, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

type Company = { id: string; properties: Record<string, string | null | undefined> };
export type CompanyStage = "NEW" | "OPEN" | "ATTEMPTED_TO_CONTACT" | "CONNECTED" | "FOLLOW_UP" | "LATER" | "OPEN_DEAL" | "WON" | "LOST";

type Props = {
  companies: Company[];
  ownerNames: Record<string, string>;
  loading?: boolean;
  onOpenCompany: (id: string) => void;
  onStatusChange: (companyId: string, stage: CompanyStage, properties?: Record<string, string | null | undefined>) => void;
  onError: (message: string) => void;
};

export const COMPANY_PIPELINE: Array<{ value: CompanyStage; label: string; tone?: "later" | "won" | "lost" }> = [
  { value: "NEW", label: "À travailler" },
  { value: "OPEN", label: "À contacter" },
  { value: "ATTEMPTED_TO_CONTACT", label: "Tentative" },
  { value: "CONNECTED", label: "Contact établi" },
  { value: "FOLLOW_UP", label: "À relancer" },
  { value: "LATER", label: "Ultérieur", tone: "later" },
  { value: "OPEN_DEAL", label: "Opportunité" },
  { value: "WON", label: "Gagné", tone: "won" },
  { value: "LOST", label: "Perdu", tone: "lost" },
];

const QUALIFICATION_STAGE: Record<string, CompanyStage> = {
  "À travailler": "NEW",
  "À contacter": "OPEN",
  "Tentative": "ATTEMPTED_TO_CONTACT",
  "Contact établi": "CONNECTED",
  "À relancer": "FOLLOW_UP",
  "Ultérieur": "LATER",
  "Opportunité": "OPEN_DEAL",
  "Gagné": "WON",
  "Perdu": "LOST",
};

function dateMs(value?: string | null) {
  if (!value) return NaN;
  const n = Number(value);
  return Number.isFinite(n) && String(value).length >= 12 ? n : Date.parse(value);
}

export function deriveCompanyStage(company: Company, now = Date.now()): CompanyStage {
  const p = company.properties;
  const consolidated = p.qualification_status || p.prospecting_status;
  if (consolidated && QUALIFICATION_STAGE[consolidated]) return QUALIFICATION_STAGE[consolidated];
  if ((p.lifecyclestage || "").toLowerCase() === "customer") return "WON";
  if (p.hs_lead_status === "UNQUALIFIED") return "LOST";
  if (p.hs_lead_status === "BAD_TIMING") {
    const reminder = dateMs(p.date_de_rappel || p.notes_next_activity_date);
    if (p.statut_de_lappel === "a_une_date_ulterieure" && Number.isFinite(reminder) && reminder > now) return "LATER";
    return "FOLLOW_UP";
  }
  if (p.hs_lead_status === "OPEN_DEAL") return "OPEN_DEAL";
  if (p.hs_lead_status === "CONNECTED") return "CONNECTED";
  if (p.hs_lead_status === "ATTEMPTED_TO_CONTACT") return "ATTEMPTED_TO_CONTACT";
  if (p.hs_lead_status === "OPEN") return "OPEN";
  return "NEW";
}

function callLabel(value?: string | null) {
  const labels: Record<string, string> = {
    interesse: "Intéressé", interesse_mais: "Intéressé mais", a_une_date_ulterieure: "À une date ultérieure",
    a_rappeler: "À rappeler", pas_interesse: "Pas intéressé", occupe: "Occupé", nrp: "NRP",
    hors_cible: "Hors cible", en_attente_decision: "En attente décision", numero_invalide: "Numéro invalide", autres: "Autres",
  };
  return value ? labels[value] || value : "Aucun appel";
}

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  date.setHours(9, 0, 0, 0);
  return date;
}

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function CompanyProspectionBoard({ companies, ownerNames, loading, onOpenCompany, onStatusChange, onError }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [laterCompany, setLaterCompany] = useState<Company | null>(null);
  const [laterAt, setLaterAt] = useState(() => localDateTimeValue(addMonths(3)));
  const [laterReason, setLaterReason] = useState("");

  const groups = useMemo(() => {
    const map = new Map<CompanyStage, Company[]>();
    for (const column of COMPANY_PIPELINE) map.set(column.value, []);
    for (const company of companies) map.get(deriveCompanyStage(company))?.push(company);
    return map;
  }, [companies]);

  async function applyStage(company: Company, stage: CompanyStage, reminderAt?: string, reason?: string) {
    if (deriveCompanyStage(company) === stage && stage !== "FOLLOW_UP") return;
    setSavingId(company.id);
    try {
      const response = await fetch(`/api/companies/${company.id}/workflow`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: stage, reminderAt, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "HubSpot a rejeté le changement de workflow");
      onStatusChange(company.id, stage, data.company?.properties || undefined);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de déplacer l’entreprise");
    } finally {
      setSavingId(null);
      setDragId(null);
      setDragOver(null);
    }
  }

  function move(company: Company, stage: CompanyStage) {
    if (stage === "LATER") {
      setLaterCompany(company);
      setLaterAt(localDateTimeValue(addMonths(3)));
      setLaterReason("");
      setDragId(null);
      setDragOver(null);
      return;
    }
    void applyStage(company, stage);
  }

  async function confirmLater() {
    if (!laterCompany || !laterAt) return;
    const company = laterCompany;
    setLaterCompany(null);
    await applyStage(company, "LATER", new Date(laterAt).toISOString(), laterReason);
  }

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden border-t border-border minari-scrollbar">
        <div className="flex h-full min-w-max items-start gap-3 p-4">
          {COMPANY_PIPELINE.map(column => {
            const cards = groups.get(column.value) || [];
            const isOver = dragOver === column.value;
            const terminal = column.tone === "won" || column.tone === "lost";
            return (
              <section
                key={column.value}
                onDragOver={event => { if (dragId) { event.preventDefault(); setDragOver(column.value); } }}
                onDragLeave={() => setDragOver(current => current === column.value ? null : current)}
                onDrop={event => {
                  event.preventDefault();
                  const company = companies.find(item => item.id === dragId);
                  if (company) move(company, column.value);
                }}
                className={`flex h-full max-h-[calc(100vh-285px)] w-72 shrink-0 flex-col rounded-xl border ${isOver ? "border-primary bg-accent/50" : terminal ? "border-border bg-muted/15" : "border-border bg-muted/30"}`}
              >
                <header className="flex items-center gap-2 px-3 py-3">
                  {column.value === "WON" ? <Trophy size={14} className="text-emerald-500" /> : column.value === "LOST" ? <XCircle size={14} className="text-rose-500" /> : column.value === "LATER" ? <Clock3 size={14} className="text-amber-500" /> : <span className="h-2 w-2 rounded-full bg-primary" />}
                  <h3 className="text-sm font-semibold">{column.label}</h3>
                  <Badge variant="secondary" className="ml-auto text-[10px]">{cards.length}</Badge>
                </header>
                {column.value === "LATER" ? <div className="mx-3 mb-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[10px] leading-4 text-amber-700 dark:text-amber-300">Comptes mis en sommeil. Ils remontent en À relancer à la date prévue.</div> : null}
                <div className="min-h-[120px] flex-1 space-y-2 overflow-y-auto px-3 pb-3 minari-scrollbar">
                  {cards.map(company => {
                    const p = company.properties;
                    const contacts = Number(p.qualification_contacts_count || p.num_associated_contacts || 0);
                    const deals = Number(p.qualification_deals_count || p.num_associated_deals || 0);
                    const overdue = Number(p.qualification_overdue_tasks || 0);
                    const score = Number(p.qualification_score || 0);
                    const lastCall = p.qualification_last_call_status || p.statut_de_lappel;
                    const reminder = p.qualification_next_action_at || p.date_de_rappel || p.notes_next_activity_date;
                    const lastActivity = p.qualification_last_activity_at || p.notes_last_updated || p.hs_last_sales_activity_timestamp;
                    return (
                      <article
                        key={company.id}
                        draggable
                        onDragStart={event => { setDragId(company.id); event.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        className={`cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/30 hover:bg-muted/20 active:cursor-grabbing ${dragId === company.id || savingId === company.id ? "opacity-55" : ""}`}
                      >
                        <button onClick={() => onOpenCompany(company.id)} className="flex w-full items-start gap-2.5 text-left">
                          <Avatar className="h-8 w-8 shrink-0 rounded-lg bg-accent"><AvatarFallback className="rounded-lg bg-accent text-primary"><Building2 size={15} /></AvatarFallback></Avatar>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold hover:text-primary">{p.name || "Entreprise sans nom"}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{p.domain || [p.city, p.country].filter(Boolean).join(", ") || "Compte HubSpot"}</span></span>
                          {score > 0 ? <Badge variant="secondary" className="shrink-0 text-[10px]">Score {score}</Badge> : null}
                        </button>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground"><Users size={10} /> {contacts} contact{contacts > 1 ? "s" : ""}</Badge>
                          {deals > 0 ? <Badge variant="outline" className="text-[10px] text-primary">{deals} deal{deals > 1 ? "s" : ""}</Badge> : null}
                          {lastCall ? <Badge variant="outline" className="text-[10px]">{callLabel(lastCall)}</Badge> : null}
                          {overdue > 0 ? <Badge variant="destructive" className="text-[10px]">{overdue} tâche{overdue > 1 ? "s" : ""} en retard</Badge> : null}
                        </div>

                        {p.qualification_reason ? <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{p.qualification_reason}</p> : null}

                        {reminder && deriveCompanyStage(company) !== "WON" && deriveCompanyStage(company) !== "LOST" ? <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300"><CalendarClock size={12} /> {deriveCompanyStage(company) === "LATER" ? "Reprise" : "Action"} {formatDate(reminder)}</div> : null}
                        {deriveCompanyStage(company) === "WON" ? <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={12} /> Client gagné</div> : null}

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                          <span className="truncate">{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "Commercial" : "Non assigné"}</span>
                          {p.phone && !terminal ? <a href={`tel:${p.phone}`} onClick={event => event.stopPropagation()} className="inline-flex shrink-0 items-center gap-1 hover:text-primary"><Phone size={11} /> Appeler</a> : terminal ? <span className="inline-flex items-center gap-1"><RotateCcw size={10} /> Réactivable</span> : <span>{formatDate(lastActivity)}</span>}
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

      {laterCompany ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.currentTarget === event.target) setLaterCompany(null); }}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-popover p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg font-bold">Relance ultérieure</h3><p className="mt-1 text-sm text-muted-foreground">{laterCompany.properties.name || "Cette entreprise"} sort de la file active jusqu’à la date choisie.</p></div><Button variant="ghost" size="icon" onClick={() => setLaterCompany(null)}><XCircle size={17} /></Button></div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[1, 3, 6].map(months => <Button key={months} variant="outline" size="sm" onClick={() => setLaterAt(localDateTimeValue(addMonths(months)))}>+ {months} mois</Button>)}
            </div>
            <div className="mt-4"><label className="text-xs font-semibold text-muted-foreground">Date de reprise</label><Input type="datetime-local" value={laterAt} min={localDateTimeValue(new Date(Date.now() + 60_000))} onChange={event => setLaterAt(event.target.value)} className="mt-1.5" /></div>
            <div className="mt-4"><label className="text-xs font-semibold text-muted-foreground">Motif / contexte (optionnel)</label><Input value={laterReason} onChange={event => setLaterReason(event.target.value)} placeholder="Ex. saison prochaine, nouveau parc en janvier…" className="mt-1.5" /></div>
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setLaterCompany(null)}>Annuler</Button><Button onClick={() => void confirmLater()} disabled={!laterAt}><CalendarClock size={14} /> Planifier la reprise</Button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
