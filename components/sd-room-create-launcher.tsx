"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DealRoomDeal } from "@/lib/deal-room-types";

type ExistingRoom = { hubspot_deal_id: string };

export function SDRoomCreateLauncher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deals, setDeals] = useState<DealRoomDeal[]>([]);
  const [existingRooms, setExistingRooms] = useState<ExistingRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function openCreator() {
    setOpen(true);
    if (deals.length) return;
    setLoading(true);
    setError("");
    try {
      const [dealsResponse, roomsResponse] = await Promise.all([
        fetch("/api/deals", { cache: "no-store" }),
        fetch("/api/sd-rooms", { cache: "no-store" }),
      ]);
      const [dealsPayload, roomsPayload] = await Promise.all([dealsResponse.json(), roomsResponse.json()]);
      if (!dealsResponse.ok) throw new Error(dealsPayload.message || dealsPayload.error || "Impossible de charger les deals.");
      if (!roomsResponse.ok) throw new Error(roomsPayload.message || roomsPayload.error || "Impossible de charger les Rooms SD.");
      setDeals(dealsPayload.results || []);
      setExistingRooms(roomsPayload.results || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les deals.");
    } finally {
      setLoading(false);
    }
  }

  const availableDeals = useMemo(() => {
    const existing = new Set(existingRooms.map(room => room.hubspot_deal_id));
    const q = query.trim().toLowerCase();
    return deals
      .filter(deal => !existing.has(deal.id))
      .filter(deal => !q || [deal.company?.name, deal.name, deal.ownerName, deal.company?.domain].filter(Boolean).some(value => String(value).toLowerCase().includes(q)))
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }, [deals, existingRooms, query]);

  async function createRoom(dealId: string) {
    setWorkingId(dealId);
    setError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Création impossible.");
      router.push(`/deal-room/${dealId}/sd`);
      router.refresh();
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Création impossible.");
      setWorkingId(null);
    }
  }

  return (
    <>
      <div className="fixed right-5 top-5 z-40 lg:right-7 lg:top-6">
        <Button onClick={() => void openCreator()} className="shadow-lg shadow-black/20">
          <Plus className="mr-1.5 h-4 w-4" /> Créer une Room SD
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.currentTarget === event.target) setOpen(false); }}>
          <Card className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden border-primary/25 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-primary"><Sparkles className="h-4 w-4" /> Nouvelle Room SD</div>
                <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">Choisis un deal pour créer ton test</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">La création initialise SD01 → SD05 dans Supabase. Elle ne modifie pas la fiche HubSpot du deal.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fermer"><X className="h-4 w-4" /></Button>
            </div>

            <div className="border-b border-border p-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une entreprise ou un deal…" className="pl-9" /></div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {error ? <div className="mb-3 rounded-lg border border-rose-400/25 bg-rose-400/[0.06] p-3 text-sm text-rose-200">{error}</div> : null}
              {loading ? (
                <div className="grid min-h-52 place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-2 text-sm text-muted-foreground">Chargement des deals…</p></div></div>
              ) : availableDeals.length ? (
                <div className="space-y-2">
                  {availableDeals.slice(0, 50).map(deal => (
                    <div key={deal.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black">{deal.company?.name || "Entreprise non associée"}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{deal.name}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {deal.stageLabel ? <Badge variant="outline" className="rounded-md text-[10px]">{deal.stageLabel}</Badge> : null}
                          {deal.ownerName ? <Badge variant="outline" className="rounded-md text-[10px]">{deal.ownerName}</Badge> : null}
                          <Badge variant="outline" className="rounded-md text-[10px]">Score {deal.score}/100</Badge>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => void createRoom(deal.id)} disabled={Boolean(workingId)} className="shrink-0">
                        {workingId === deal.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                        Créer ce test
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-52 place-items-center text-center"><div><Sparkles className="mx-auto h-7 w-7 text-primary" /><div className="mt-2 font-bold">Tous les deals visibles ont déjà une Room SD</div><p className="mt-1 text-xs text-muted-foreground">Ouvre une Room existante depuis la liste principale pour continuer les tests.</p></div></div>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
