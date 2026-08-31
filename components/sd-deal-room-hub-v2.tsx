"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Unlink,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DealRoomDeal } from "@/lib/deal-room-types";
import type { SDCode, SDDocumentStatus, SDRoomMode } from "@/lib/sd-room-types";
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
  meeting_booking_url: string | null;
  room_mode: SDRoomMode;
  share_token: string;
  status: "draft" | "published" | "archived";
  current_stage: SDCode;
  created_at: string;
  updated_at: string;
  documents: SDRoomHubDocument[];
  opens: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  openComments: number;
  crmConnected: boolean;
};

type TabKey = "all" | "active" | "late" | "inactive";
type ModeFilter = "all" | SDRoomMode;
type Lifecycle = "not_started" | "in_progress" | "active" | "late" | "inactive";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "Actives" },
  { key: "late", label: "En retard" },
  { key: "inactive", label: "Inactives" },
];

const roomModeMeta: Record<SDRoomMode, { label: string; description: string; flow: string }> = {
  enterprise: {
    label: "Grand compte",
    description: "Plusieurs décideurs, achats/juridique, cycle plus long.",
    flow: "Décideurs → propal → comité → contrat → signature",
  },
  standard: {
    label: "Deal rapide",
    description: "Peu d’interlocuteurs, décision simple, cycle court.",
    flow: "Propal → rendez-vous → contrat → signature",
  },
};

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "SD";
}

function formatDate(value: string | null, withYear = true) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("fr-FR", withYear ? { day: "2-digit", month: "short", year: "numeric" } : { day: "2-digit", month: "short" }).format(date);
}

function dueDate(deal?: DealRoomDeal) {
  return deal?.nextTaskDueAt || deal?.nextMeetingAt || deal?.closeDate || null;
}

function lifecycle(room: SDRoomSummary, deal?: DealRoomDeal): Lifecycle {
  const now = Date.now();
  const updatedAt = new Date(room.updated_at).getTime();
  const due = dueDate(deal);
  if (room.status === "archived") return "inactive";
  if (Number.isFinite(updatedAt) && now - updatedAt > 30 * 86_400_000) return "inactive";
  if (due && new Date(due).getTime() < now && !deal?.closed) return "late";
  if (room.status === "published") return "active";
  const progressed = room.documents.some(document => document.version > 1 || document.status !== "draft");
  return progressed ? "in_progress" : "not_started";
}

const lifecycleMeta: Record<Lifecycle, { label: string; className: string }> = {
  not_started: { label: "À démarrer", className: "border-slate-400/20 bg-slate-400/10 text-slate-300" },
  in_progress: { label: "En cours", className: "border-blue-400/20 bg-blue-400/10 text-blue-300" },
  active: { label: "Active", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  late: { label: "En retard", className: "border-rose-400/20 bg-rose-400/10 text-rose-300" },
  inactive: { label: "Inactive", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-400" },
};

function isReady(document?: SDRoomHubDocument) {
  return document?.status === "published" || document?.status === "validated";
}

function Logo({ room }: { room: SDRoomSummary }) {
  if (room.prospect_logo_url) {
    return <img src={room.prospect_logo_url} alt="" className="h-9 w-9 rounded-lg border border-border bg-white object-contain p-1" />;
  }
  return <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted text-[11px] font-black text-muted-foreground">{initials(room.company_name)}</div>;
}

export function SDDealRoomHubV2() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealRoomDeal[]>([]);
  const [rooms, setRooms] = useState<SDRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [savingModeId, setSavingModeId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [dealroomName, setDealroomName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [crmLink, setCrmLink] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [meetingBookingUrl, setMeetingBookingUrl] = useState("");
  const [roomMode, setRoomMode] = useState<SDRoomMode>("standard");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dealsResponse, roomsResponse] = await Promise.all([
        fetch("/api/deals", { cache: "no-store" }),
        fetch("/api/sd-rooms", { cache: "no-store" }),
      ]);
      const [dealsPayload, roomsPayload] = await Promise.all([dealsResponse.json(), roomsResponse.json()]);
      if (!roomsResponse.ok) throw new Error(roomsPayload.message || roomsPayload.error || "Impossible de charger les dealrooms.");
      setRooms(roomsPayload.results || []);
      setDeals(dealsResponse.ok ? dealsPayload.results || [] : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dealMap = useMemo(() => new Map(deals.map(deal => [deal.id, deal])), [deals]);
  const usedCrmDeals = useMemo(() => new Set(rooms.filter(room => room.crmConnected).map(room => room.hubspot_deal_id)), [rooms]);
  const availableDeals = useMemo(() => deals.filter(deal => !usedCrmDeals.has(deal.id)), [deals, usedCrmDeals]);

  const counts = useMemo(() => {
    const result = { all: rooms.length, active: 0, late: 0, inactive: 0 };
    for (const room of rooms) {
      const state = lifecycle(room, room.crmConnected ? dealMap.get(room.hubspot_deal_id) : undefined);
      if (state === "active" || state === "in_progress") result.active += 1;
      if (state === "late") result.late += 1;
      if (state === "inactive") result.inactive += 1;
    }
    return result;
  }, [dealMap, rooms]);

  const modeCounts = useMemo(() => ({
    enterprise: rooms.filter(room => room.room_mode === "enterprise").length,
    standard: rooms.filter(room => room.room_mode !== "enterprise").length,
  }), [rooms]);

  const visibleRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter(room => {
      const deal = room.crmConnected ? dealMap.get(room.hubspot_deal_id) : undefined;
      const state = lifecycle(room, deal);
      if (modeFilter !== "all" && room.room_mode !== modeFilter) return false;
      if (tab === "active" && state !== "active" && state !== "in_progress") return false;
      if (tab === "late" && state !== "late") return false;
      if (tab === "inactive" && state !== "inactive") return false;
      if (!q) return true;
      return [room.title, room.company_name, deal?.name, deal?.ownerName]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    });
  }, [dealMap, modeFilter, query, rooms, tab]);

  function openCreate(mode: SDRoomMode = "standard") {
    setCreateError("");
    setSelectedDealId("");
    setDealroomName("");
    setOrganizationName("");
    setCrmLink("");
    setLogoUrl("");
    setMeetingBookingUrl("");
    setRoomMode(mode);
    setModalOpen(true);
  }

  function selectDeal(dealId: string) {
    setSelectedDealId(dealId);
    if (!dealId) {
      setCrmLink("");
      return;
    }
    const deal = deals.find(item => item.id === dealId);
    if (!deal) return;
    const company = deal.company?.name || deal.name || "Client";
    if (!organizationName.trim()) setOrganizationName(company);
    if (!dealroomName.trim()) setDealroomName(`Gando × ${company}`);
    setCrmLink(deal.hubspotUrl || "");
  }

  async function updateRoomMode(roomId: string, nextMode: SDRoomMode) {
    const previous = rooms.find(room => room.id === roomId)?.room_mode;
    setSavingModeId(roomId);
    setRooms(current => current.map(room => room.id === roomId ? { ...room, room_mode: nextMode } : room));
    try {
      const response = await fetch("/api/sd-rooms", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, roomMode: nextMode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Classement impossible.");
    } catch (modeError) {
      if (previous) setRooms(current => current.map(room => room.id === roomId ? { ...room, room_mode: previous } : room));
      setError(modeError instanceof Error ? modeError.message : "Classement impossible.");
    } finally {
      setSavingModeId("");
    }
  }

  async function createDealroom() {
    if (!dealroomName.trim() || !organizationName.trim()) {
      setCreateError("Renseigne simplement le nom de la dealroom et l’organisation. Le CRM est facultatif.");
      return;
    }
    const booking = meetingBookingUrl.trim();
    if (booking && !/^https?:\/\/\S+$/i.test(booking)) {
      setCreateError("Le lien de rendez-vous doit commencer par http:// ou https://.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const payloadBody = {
        title: dealroomName.trim(),
        companyName: organizationName.trim(),
        crmLink: crmLink.trim(),
        prospectLogoUrl: logoUrl.trim(),
        meetingBookingUrl: booking,
        roomMode,
      };
      const response = selectedDealId
        ? await fetch(`/api/deals/${encodeURIComponent(selectedDealId)}/sd-room`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payloadBody),
          })
        : await fetch("/api/sd-rooms", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payloadBody),
          });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Création impossible.");
      const editorKey = selectedDealId || payload.editorKey || payload.room?.hubspot_deal_id;
      if (!editorKey) throw new Error("La dealroom a été créée mais son identifiant d’édition est introuvable.");
      setModalOpen(false);
      router.push(`/deal-room/${editorKey}/sd`);
    } catch (creationError) {
      setCreateError(creationError instanceof Error ? creationError.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-shell h-screen overflow-y-auto bg-background">
      <div className="mx-auto max-w-[1680px] px-5 py-5 lg:px-7 lg:py-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">CRM · Closing</div>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">Deal Room</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pilote chaque opportunité de la proposition commerciale jusqu’à la signature, avec un parcours adapté au niveau de complexité du compte.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Entreprise, deal, commercial…" className="h-10 pl-9" />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => void load()} aria-label="Actualiser"><RefreshCw className="h-4 w-4" /></Button>
            <Button className="h-10 px-4" onClick={() => openCreate()}><Plus className="mr-2 h-4 w-4" /> Nouvelle Deal Room</Button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          {(["enterprise", "standard"] as SDRoomMode[]).map(mode => {
            const meta = roomModeMeta[mode];
            const selected = modeFilter === mode;
            return (
              <button key={mode} type="button" onClick={() => setModeFilter(selected ? "all" : mode)} className={cn("rounded-2xl border p-4 text-left transition-all", selected ? "border-primary bg-primary/[0.06] ring-2 ring-primary/10" : "border-border bg-card hover:border-primary/35 hover:bg-muted/20")}>
                <div className="flex items-start gap-3">
                  <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", mode === "enterprise" ? "bg-primary/10 text-primary" : "bg-emerald-400/10 text-emerald-300")}>{mode === "enterprise" ? <Building2 className="h-5 w-5" /> : <Zap className="h-5 w-5" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3"><div className="font-black">{meta.label}</div><span className="rounded-lg bg-muted px-2 py-1 text-xs font-black">{modeCounts[mode]}</span></div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{meta.description}</p>
                    <div className="mt-3 text-[11px] font-semibold text-foreground/80">{meta.flow}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-7 overflow-x-auto">
            {tabs.map(item => (
              <button key={item.key} onClick={() => setTab(item.key)} className={cn("relative flex items-center gap-2 whitespace-nowrap pb-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground", tab === item.key && "text-foreground")}>
                {item.label}
                <span className={cn("rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold", tab === item.key && "bg-foreground text-background")}>{counts[item.key]}</span>
                {tab === item.key ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground" /> : null}
              </button>
            ))}
          </div>
          {modeFilter !== "all" ? <button type="button" onClick={() => setModeFilter("all")} className="mb-2 text-xs font-semibold text-primary hover:underline">Voir tous les types</button> : null}
        </div>

        {error ? <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          {loading ? (
            <div className="grid min-h-72 place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Chargement des Deal Rooms…</p></div></div>
          ) : visibleRooms.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 text-center"><div><Building2 className="mx-auto h-9 w-9 text-muted-foreground" /><div className="mt-3 font-bold">Aucune Deal Room ici</div><p className="mt-1 text-sm text-muted-foreground">Crée une room pour commencer le cycle de closing.</p><Button className="mt-4" onClick={() => openCreate(modeFilter === "all" ? "standard" : modeFilter)}><Plus className="mr-2 h-4 w-4" /> Nouvelle Deal Room</Button></div></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1420px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="px-4 py-3">Compte</th>
                    <th className="px-3 py-3">Type de cycle</th>
                    <th className="px-3 py-3">Interlocuteurs</th>
                    <th className="px-3 py-3">Étape</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3">Prochaine action</th>
                    <th className="px-3 py-3">Closing</th>
                    <th className="px-3 py-3">Activité client</th>
                    <th className="w-20 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRooms.map(room => {
                    const deal = room.crmConnected ? dealMap.get(room.hubspot_deal_id) : undefined;
                    const state = lifecycle(room, deal);
                    const meta = lifecycleMeta[state];
                    const due = dueDate(deal);
                    const offer = room.documents.find(document => document.code === "SD04");
                    const contract = room.documents.find(document => document.code === "SD05");
                    const offerReady = isReady(offer);
                    const contractReady = isReady(contract);
                    return (
                      <tr key={room.id} className="group border-b border-border last:border-b-0 transition-colors hover:bg-muted/25">
                        <td className="px-4 py-4">
                          <Link href={`/deal-room/${room.hubspot_deal_id}/sd`} className="flex min-w-[235px] items-center gap-3">
                            <Logo room={room} />
                            <div className="min-w-0"><div className="truncate text-sm font-bold text-foreground group-hover:text-primary">{room.title}</div><div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground"><span className="truncate">{room.company_name}</span>{room.crmConnected ? <Link2 className="h-3 w-3 shrink-0 text-emerald-300" /> : <Unlink className="h-3 w-3 shrink-0" />}</div></div>
                          </Link>
                        </td>
                        <td className="px-3 py-4">
                          <div className="relative w-[145px]">
                            <select value={room.room_mode || "standard"} disabled={savingModeId === room.id} onChange={event => void updateRoomMode(room.id, event.target.value as SDRoomMode)} className={cn("h-8 w-full appearance-none rounded-lg border bg-background px-2.5 pr-8 text-xs font-bold outline-none focus:ring-2 focus:ring-ring", room.room_mode === "enterprise" ? "border-primary/30 text-primary" : "border-emerald-400/25 text-emerald-300")}>
                              <option value="standard">Deal rapide</option>
                              <option value="enterprise">Grand compte</option>
                            </select>
                            {savingModeId === room.id ? <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                        </td>
                        <td className="px-3 py-4"><div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-semibold">{deal?.contacts.length || 0}</span></div></td>
                        <td className="px-3 py-4"><Badge variant="outline" className="rounded-md border-primary/20 bg-primary/[0.06] text-primary">{room.current_stage}</Badge></td>
                        <td className="px-3 py-4"><Badge variant="outline" className={cn("rounded-md font-semibold", meta.className)}>{meta.label}</Badge></td>
                        <td className="px-3 py-4"><div className={cn("flex min-w-[130px] items-center gap-2 text-sm", state === "late" ? "font-semibold text-rose-300" : "text-muted-foreground")}><CalendarClock className="h-4 w-4" />{formatDate(due, false)}</div></td>
                        <td className="px-3 py-4">
                          <div className="flex min-w-[390px] items-center gap-1.5">
                            <Button variant={offerReady ? "secondary" : "outline"} size="sm" className="h-8 px-2.5 text-xs" asChild><Link href={`/deal-room/${room.hubspot_deal_id}/sd?tab=offer`}><Send className="mr-1.5 h-3.5 w-3.5" />Propal</Link></Button>
                            <Button variant={room.meeting_booking_url ? "secondary" : "outline"} size="sm" className="h-8 px-2.5 text-xs" asChild>{room.meeting_booking_url ? <a href={room.meeting_booking_url} target="_blank" rel="noreferrer"><CalendarDays className="mr-1.5 h-3.5 w-3.5" />RDV</a> : <Link href={`/deal-room/${room.hubspot_deal_id}/sd?tab=branding`}><CalendarDays className="mr-1.5 h-3.5 w-3.5" />RDV</Link>}</Button>
                            <Button variant={contractReady ? "secondary" : "outline"} size="sm" className="h-8 px-2.5 text-xs" asChild><Link href={`/deal-room/${room.hubspot_deal_id}/sd?tab=contract`}><FileText className="mr-1.5 h-3.5 w-3.5" />Contrat</Link></Button>
                            <Button variant={contractReady ? "secondary" : "outline"} size="sm" className="h-8 px-2.5 text-xs" asChild><Link href={`/deal-room/${room.hubspot_deal_id}/sd?tab=contract`}><FileSignature className="mr-1.5 h-3.5 w-3.5" />Signer</Link></Button>
                          </div>
                        </td>
                        <td className="px-3 py-4"><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{room.opens}</span><span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{room.openComments}</span></div></td>
                        <td className="px-3 py-4"><div className="flex items-center justify-end gap-1">{room.status === "published" ? <Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link href={`/r/${room.share_token}`} target="_blank"><Eye className="h-4 w-4" /></Link></Button> : null}{room.crm_link ? <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={room.crm_link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button> : null}<Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link href={`/deal-room/${room.hubspot_deal_id}/sd`}><ArrowRight className="h-4 w-4" /></Link></Button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>{visibleRooms.length} Deal Room{visibleRooms.length > 1 ? "s" : ""} affichée{visibleRooms.length > 1 ? "s" : ""}</span><span>CRM facultatif · {availableDeals.length} deal{availableDeals.length > 1 ? "s" : ""} HubSpot disponible{availableDeals.length > 1 ? "s" : ""}</span></div>
            </div>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget && !creating) setModalOpen(false); }}>
          <div className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between px-6 pb-4 pt-6">
              <div><h2 className="text-xl font-black tracking-[-0.025em]">Créer une Deal Room</h2><p className="mt-1 text-xs text-muted-foreground">Choisis d’abord le type de cycle commercial.</p></div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModalOpen(false)} disabled={creating}><X className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-4 px-6 pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["standard", "enterprise"] as SDRoomMode[]).map(mode => {
                  const meta = roomModeMeta[mode];
                  return <button key={mode} type="button" onClick={() => setRoomMode(mode)} className={cn("rounded-xl border p-4 text-left transition", roomMode === mode ? "border-primary bg-primary/[0.06] ring-2 ring-primary/10" : "border-border hover:border-primary/30")}><div className="flex items-center gap-2 text-sm font-black">{mode === "enterprise" ? <Building2 className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-emerald-300" />}{meta.label}</div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{meta.description}</p><div className="mt-2 text-[10px] font-semibold text-foreground/75">{meta.flow}</div></button>;
                })}
              </div>

              <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nom de la Deal Room*</label><Input value={dealroomName} onChange={event => setDealroomName(event.target.value)} placeholder="ex : Gando × Acme Corp." /></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Organisation*</label><Input value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder="ex : Acme Corp." /></div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Link2 className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">Associer à HubSpot <span className="font-normal text-muted-foreground">— optionnel</span></div>
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">Récupère les contacts, appels et prochaines actions. Une Deal Room peut aussi rester autonome.</p>
                    <div className="relative mt-3">
                      <select value={selectedDealId} onChange={event => selectDeal(event.target.value)} className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring">
                        <option value="">Aucun — Deal Room autonome</option>
                        {availableDeals.map(deal => <option key={deal.id} value={deal.id}>{deal.company?.name || deal.name} — {deal.name}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>

              <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Lien de prise de rendez-vous <span className="font-normal">(optionnel)</span></label><Input type="url" value={meetingBookingUrl} onChange={event => setMeetingBookingUrl(event.target.value)} placeholder="HubSpot Meetings, Calendly, Brevo…" /><p className="mt-1.5 text-[11px] text-muted-foreground">Le client verra un CTA de réservation directement dans sa Deal Room publique.</p></div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Lien CRM <span className="font-normal">(optionnel)</span></label><Input value={crmLink} onChange={event => setCrmLink(event.target.value)} placeholder="https://app.hubspot.com/…" /></div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Logo prospect <span className="font-normal">(optionnel)</span></label>
                  <div className="flex items-center gap-2"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground">{logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" /> : organizationName ? <span className="text-[10px] font-black">{initials(organizationName)}</span> : <ImageIcon className="h-4 w-4" />}</div><Input value={logoUrl} onChange={event => setLogoUrl(event.target.value)} placeholder="URL du logo" /></div>
                </div>
              </div>

              {createError ? <div className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5 text-xs text-rose-200">{createError}</div> : null}

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> Propal, RDV, contrat et signature seront accessibles depuis le cockpit.</div>
                <Button onClick={() => void createDealroom()} disabled={creating || !dealroomName.trim() || !organizationName.trim()} className="min-w-28">{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Créer</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
