"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileSignature, Loader2, Send } from "lucide-react";
import type { SDRoomRecord } from "@/lib/sd-room-types";

function formatDate(value: string | null) {
  if (!value) return "À venir";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function elapsed(from: string | null, to: string | null) {
  if (!from || !to) return "";
  const ms = Math.max(0, new Date(to).getTime() - new Date(from).getTime());
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} j`;
}

export function SDQuickDealTimeline({ dealId, refreshKey = 0 }: { dealId: string; refreshKey?: number }) {
  const [room, setRoom] = useState<SDRoomRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setRoom(payload.room || null);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const steps = useMemo(() => room ? [
    { label: "Premier contact", value: room.first_contact_at || room.created_at, icon: Clock3, duration: "" },
    { label: "Propal envoyée", value: room.proposal_sent_at, icon: Send, duration: elapsed(room.first_contact_at || room.created_at, room.proposal_sent_at) },
    { label: "Accord obtenu", value: room.proposal_agreed_at, icon: CheckCircle2, duration: elapsed(room.proposal_sent_at, room.proposal_agreed_at) },
    { label: "Contrat signé", value: room.contract_signed_at, icon: FileSignature, duration: elapsed(room.proposal_agreed_at || room.proposal_sent_at, room.contract_signed_at) },
  ] : [], [room]);

  if (loading) return <div className="mx-auto flex max-w-[1180px] items-center gap-2 px-5 py-3 text-xs text-muted-foreground lg:px-7"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement du timing…</div>;
  if (!room) return null;

  return <div className="border-b border-border bg-muted/10">
    <div className="mx-auto grid max-w-[1180px] gap-2 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4 lg:px-7">
      {steps.map(({ label, value, icon: Icon, duration }) => <div key={label} className="rounded-xl border border-border bg-background px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <div className="mt-1 flex items-end justify-between gap-2"><span className="text-xs font-semibold">{formatDate(value)}</span>{duration ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">+{duration}</span> : null}</div>
      </div>)}
    </div>
  </div>;
}