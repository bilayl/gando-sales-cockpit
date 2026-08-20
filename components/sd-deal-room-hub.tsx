"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  ImageIcon,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DealRoomDeal } from "@/lib/deal-room-types";
import type { SDCode, SDDocumentStatus } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type SDRoomHubDocument = {
  room_id: string;
  code: SDCode;
  status: SDDocumentStatus;
  source_mode: "manual" | "agent" | "mixed";
  version: number;
  published_version: number | null;
  updated_at: string;
};

type SDRoomSummary = {
  id: string;
  hubspot_deal_id: string;
  title: string;
  company_name: string;
  crm_link: string | null;
  prospect_logo_url: string | null;
  share_token: string;
  status: "draft" | "published" | "archived";
  current_stage: SDCode;
  published_at: string | null;
  last_shared_at: string | null;
  created_at: string;
  updated_at: string;
  documents: SDRoomHubDocument[];
  opens: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  openComments: number;
};

type TabKey = "all" | "active" | "late" | "inactive";
type Lifecycle = "not_started" | "in_progress" | "active" | "late" | "inactive";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "late", label: "Late" },
  { key: "inactive", label: "Inactive" },
];

function formatDate(value: string | null, withYear = true) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("fr-FR", withYear ? { day: "2-digit", month: "short", year: "numeric" } : { day: "2-digit", month: "short" }).format(date);
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "SD";
}

function dueDate(deal: DealRoomDeal | undefined) {
  return deal?.nextTaskDueAt || deal?.nextMeetingAt || deal?.closeDate || null;
}

function lifecycle(room: SDRoomSummary, deal: DealRoomDeal | undefined): Lifecycle {
  const now = Date.now();
  const due = dueDate(deal);
  if (room.status === "archived") return "inactive";
  const updated = new Date(room.updated_at).getTime();
  if (Number.isFinite(updated) && now - updated > 30 * 86_400_000) return "inactive";
  if (due && new Date(due).getTime() < now && !deal?.closed) return "late";
  if (room.status === "published") return "active";
  const progressed = room.documents.some(document => document.version > 1 || document.status !== "draft");
  return progressed ? "in_progress" : "not_started";
}

const lifecycleMeta: Record<Lifecycle, { label: string; className: string }> = {
  not_started: { label: "Not started", className: "border-slate-400/20 bg-slate-400/10 text-slate-300" },
  in_progress: { label: "In progress", className: "border-blue-400/20 bg-blue-400/10 text-blue-300" },
  active: { label: "Active", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  late: { label: "Late", className: "border-rose-400/20 bg-rose-400/10 text-rose-300" },
  inactive: { label: "Inactive", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-400" },
};

function Logo({ room }: { room: SDRoomSummary }) {
  if (room.prospect_logo_url) {
    return <img src={room.prospect_logo_url} alt="" className="h-9 w-9 rounded-lg border border-border bg-white object-contain p-1" />;
  }
  return <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted text-[11px] font-black text-muted-foreground">{initials(room.company_name)}</div>;
}

export function SDDealRoomHub() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealRoomDeal[]>([]);
  const [rooms, setRooms] = useState<SDRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [dealroomName, setDealroomName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [crmLink, setCrmLink] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dealsResponse, roomsResponse] = await Promise.all([
        fetch("/api/deals", { cache: "no-store" }),
        fetch("/api/sd-rooms", { cache: "no-store" }),
      ]);
      const [dealsPayload, roomsPayload] = await Promise.all([dealsResponse.json(), roomsResponse.json()]);
      if (!dealsResponse.ok) throw new Error(dealsPayload.message || dealsPayload.error || "Impossible de charger les deals.");
      if (!roomsResponse.ok) throw new Error(roomsPayload.message || roomsPayload.error || "Impossible de charger les dealrooms.");
      setDeals(dealsPayload.results || []);
      setRooms(roomsPayload.results || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dealMap = useMemo(() => new Map(deals.map(deal => [deal.id, deal])), [deals]);
  const roomDealIds = useMemo(() => new Set(rooms.map(room => room.hubspot_deal_id)), [rooms]);
  const availableDeals = useMemo(() => deals.filter(deal => !roomDealIds.has(deal.id)), [deals, roomDealIds]);

  const counts = useMemo(() => {
    const result = { all: rooms.length, active: 0, late: 0, inactive: 0 };
    for (const room of rooms) {
      const state = lifecycle(room, dealMap.get(room.hubspot_deal_id));
      if (state === "active" || state === "in_progress") result.active += 1;
      if (state === "late") result.late += 1;
      if (state === "inactive") result.inactive += 1;
    }
    return result;
  }, [dealMap, rooms]);

  const visibleRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter(room => {
      const deal = dealMap.get(room.hubspot_deal_id);
      const state = lifecycle(room, deal);
      if (tab === "active" && state !== "active" && state !== "in_progress") return false;
      if (tab === "late" && state !== "late") return false;
      if (tab === "inactive" && state !== "inactive") return false;
      if (!q) return true;
      return [room.title, room.company_name, deal?.name, deal?.ownerName]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    });
  }, [dealMap, query, rooms, tab]);

  function openCreate() {
    setCreateError("");
    setSelectedDealId("");
    setDealroomName("");
    setOrganizationName("");
    setCrmLink("");
    setLogoUrl("");
    setModalOpen(true);
  }

  function selectDeal(dealId: string) {
    setSelectedDealId(dealId);
    const deal = deals.find(item => item.id === dealId);
    if (!deal) return;
    const company = deal.company?.name || "Client";
    setOrganizationName(company);
    setDealroomName(`Gando × ${company}`);
    setCrmLink(deal.hubspotUrl || "");
  }

  async function createDealroom() {
    if (!selectedDealId || !dealroomName.trim() || !organizationName.trim()) {
      setCreateError("Sélectionne un compte CRM et renseigne le nom de la dealroom et de l’organisation.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(selectedDealId)}/sd-room`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: dealroomName.trim(),
          companyName: organizationName.trim(),
          crmLink: crmLink.trim(),
          prospectLogoUrl: logoUrl.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Création impossible.");
      setModalOpen(false);
      router.push(`/deal-room/${selectedDealId}/sd`);
    } catch (creationError) {
      setCreateError(creationError instanceof Error ? creationError.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-shell h-screen overflow-y-auto bg-background">
      <div className="mx-auto max-w-[1600px] px-5 py-5 lg:px-7 lg:py-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">Méthode SD</div>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">Dealrooms</h1>
            <p className="mt-1 text-sm text-muted-foreground">Crée, partage et suis les dossiers de décision grands comptes jusqu’au SD05.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une dealroom…" className="h-10 pl-9" />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => void load()} aria-label="Actualiser"><RefreshCw className="h-4 w-4" /></Button>
            <Button className="h-10 px-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New dealroom</Button>
          </div>
        </div>

        <div className="border-b border-border">
          <div className="flex gap-7 overflow-x-auto">
            {tabs.map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap pb-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                  tab === item.key && "text-foreground",
                )}
              >
                {item.label}
                <span className={cn("rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold", tab === item.key && "bg-foreground text-background")}>{counts[item.key]}</span>
                {tab === item.key ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground" /> : null}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          {loading ? (
            <div className="grid min-h-72 place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Chargement des dealrooms…</p></div></div>
          ) : visibleRooms.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 text-center">
              <div>
                <Building2 className="mx-auto h-9 w-9 text-muted-foreground" />
                <div className="mt-3 font-bold">Aucune dealroom ici</div>
                <p className="mt-1 text-sm text-muted-foreground">Crée une dealroom de test pour commencer le process SD01 → SD05.</p>
                <Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New dealroom</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="w-11 px-4 py-3"><input type="checkbox" className="h-4 w-4 rounded border-border bg-background" aria-label="Tout sélectionner" /></th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Contacts</th>
                    <th className="px-3 py-3">SD stage</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Next due date</th>
                    <th className="px-3 py-3">Activity</th>
                    <th className="px-3 py-3">Created</th>
                    <th className="w-24 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRooms.map(room => {
                    const deal = dealMap.get(room.hubspot_deal_id);
                    const state = lifecycle(room, deal);
                    const meta = lifecycleMeta[state];
                    const due = dueDate(deal);
                    return (
                      <tr key={room.id} className="group border-b border-border last:border-b-0 transition-colors hover:bg-muted/25">
                        <td className="px-4 py-4"><input type="checkbox" className="h-4 w-4 rounded border-border bg-background" aria-label={`Sélectionner ${room.title}`} /></td>
                        <td className="px-3 py-4">
                          <Link href={`/deal-room/${room.hubspot_deal_id}/sd`} className="flex min-w-[240px] items-center gap-3">
                            <Logo room={room} />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-foreground group-hover:text-primary">{room.title}</div>
                              <div className="mt-0.5 truncate text-xs text-muted-foreground">{room.company_name}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-semibold">{deal?.contacts.length || 0}</span>{(deal?.contacts.length || 0) > 0 ? <div className="flex -space-x-1.5">{deal?.contacts.slice(0, 3).map(contact => <span key={contact.id} title={contact.name} className="grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-muted text-[9px] font-black">{initials(contact.name)}</span>)}</div> : null}</div>
                        </td>
                        <td className="px-3 py-4"><Badge variant="outline" className="rounded-md border-primary/20 bg-primary/[0.06] text-primary">{room.current_stage}</Badge></td>
                        <td className="px-3 py-4"><Badge variant="outline" className={cn("rounded-md font-semibold", meta.className)}>{meta.label}</Badge></td>
                        <td className="px-3 py-4"><div className={cn("flex items-center gap-2 text-sm", state === "late" ? "font-semibold text-rose-300" : "text-muted-foreground")}><CalendarClock className="h-4 w-4" />{formatDate(due, false)}</div></td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{room.opens}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{room.openComments}</span>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-muted-foreground">{formatDate(room.created_at)}</td>
                        <td className="px-3 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {room.crm_link ? <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ouvrir le CRM"><a href={room.crm_link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button> : null}
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ouvrir la dealroom"><Link href={`/deal-room/${room.hubspot_deal_id}/sd`}><ArrowRight className="h-4 w-4" /></Link></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <span>Results : {visibleRooms.length} of {rooms.length}</span>
                <span>{availableDeals.length} compte{availableDeals.length > 1 ? "s" : ""} CRM disponible{availableDeals.length > 1 ? "s" : ""} pour une nouvelle room</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget && !creating) setModalOpen(false); }}>
          <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between px-6 pb-4 pt-6">
              <div>
                <h2 className="text-xl font-black tracking-[-0.025em]">Create new dealroom</h2>
                <p className="mt-1 text-xs text-muted-foreground">La room sera initialisée avec SD01 → SD05.</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModalOpen(false)} disabled={creating}><X className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-4 px-6 pb-6">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Dealroom name*</label>
                <Input value={dealroomName} onChange={event => setDealroomName(event.target.value)} placeholder="ex: Gando × Acme Corp." />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">CRM account*</label>
                <div className="relative">
                  <select value={selectedDealId} onChange={event => selectDeal(event.target.value)} className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Select CRM account…</option>
                    {availableDeals.map(deal => <option key={deal.id} value={deal.id}>{deal.company?.name || deal.name} — {deal.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                {availableDeals.length === 0 ? <p className="mt-1.5 text-[11px] text-amber-300">Tous les deals chargés ont déjà une dealroom.</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">CRM link</label>
                <Input value={crmLink} onChange={event => setCrmLink(event.target.value)} placeholder="https://app.hubspot.com/…" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Organization name*</label>
                <Input value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder="ex: Tesla" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Prospect logo</label>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground">
                    {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain p-1.5" /> : organizationName ? <span className="text-xs font-black">{initials(organizationName)}</span> : <ImageIcon className="h-5 w-5" />}
                  </div>
                  <Input value={logoUrl} onChange={event => setLogoUrl(event.target.value)} placeholder="URL du logo (optionnel)" />
                </div>
              </div>

              {createError ? <div className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5 text-xs text-rose-200">{createError}</div> : null}

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> Aucun changement n’est envoyé vers HubSpot.</div>
                <Button onClick={() => void createDealroom()} disabled={creating || !availableDeals.length} className="min-w-24">{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
