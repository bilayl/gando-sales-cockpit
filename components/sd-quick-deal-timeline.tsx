"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Clock3, FileSignature, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { SDRoomRecord } from "@/lib/sd-room-types";

function formatDate(value: string | null) {
  if (!value) return "À venir";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function nowLocalInput() {
  return toLocalInput(new Date().toISOString());
}

function elapsed(from: string | null, to: string | null) {
  if (!from || !to) return "";
  const ms = Math.max(0, new Date(to).getTime() - new Date(from).getTime());
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} j`;
}

type EditableField = "first_contact_at" | "proposal_sent_at";

export function SDQuickDealTimeline({ dealId, refreshKey = 0 }: { dealId: string; refreshKey?: number }) {
  const [room, setRoom] = useState<SDRoomRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<EditableField | null>(null);
  const [firstContact, setFirstContact] = useState("");
  const [proposalSent, setProposalSent] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) {
        const nextRoom = payload.room || null;
        setRoom(nextRoom);
        if (nextRoom) {
          setFirstContact(toLocalInput(nextRoom.first_contact_at || nextRoom.created_at));
          setProposalSent(toLocalInput(nextRoom.proposal_sent_at));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const steps = useMemo(() => room ? [
    { label: "Accord obtenu", value: room.proposal_agreed_at, icon: CheckCircle2, duration: elapsed(room.proposal_sent_at, room.proposal_agreed_at) },
    { label: "Contrat signé", value: room.contract_signed_at, icon: FileSignature, duration: elapsed(room.proposal_agreed_at || room.proposal_sent_at, room.contract_signed_at) },
  ] : [], [room]);

  async function saveTiming(field: EditableField, value: string) {
    if (saving) return;
    setSaving(field);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-timing`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, value: value ? new Date(value).toISOString() : null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setRoom(payload.room);
      setFirstContact(toLocalInput(payload.room.first_contact_at || payload.room.created_at));
      setProposalSent(toLocalInput(payload.room.proposal_sent_at));
      toast.success(field === "first_contact_at" ? "Premier contact mis à jour" : "Date d’envoi de la propal mise à jour");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="mx-auto flex max-w-[1180px] items-center gap-2 px-5 py-3 text-xs text-muted-foreground lg:px-7"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement du timing…</div>;
  if (!room) return null;

  return <div className="border-b border-border bg-muted/10">
    <div className="mx-auto grid max-w-[1180px] gap-2 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4 lg:px-7">
      <div className="rounded-xl border border-border bg-background px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Premier contact</div>
        <div className="mt-2 flex items-center gap-1.5">
          <input type="datetime-local" value={firstContact} onChange={event => setFirstContact(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[11px] font-semibold" />
          <button type="button" onClick={() => void saveTiming("first_contact_at", firstContact)} disabled={saving !== null || !firstContact} title="Enregistrer" className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-muted/30 hover:bg-muted disabled:opacity-45">{saving === "first_contact_at" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"><Send className="h-3.5 w-3.5" /> Propal envoyée</div>
        <div className="mt-2 flex items-center gap-1.5">
          <input type="datetime-local" value={proposalSent} onChange={event => setProposalSent(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[11px] font-semibold" />
          {!proposalSent ? <button type="button" onClick={() => setProposalSent(nowLocalInput())} className="h-8 shrink-0 rounded-md border border-border px-2 text-[10px] font-bold hover:bg-muted">Maintenant</button> : null}
          <button type="button" onClick={() => void saveTiming("proposal_sent_at", proposalSent)} disabled={saving !== null || !proposalSent} title="Enregistrer" className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-muted/30 hover:bg-muted disabled:opacity-45">{saving === "proposal_sent_at" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
        </div>
      </div>

      {steps.map(({ label, value, icon: Icon, duration }) => <div key={label} className="rounded-xl border border-border bg-background px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <div className="mt-1 flex items-end justify-between gap-2"><span className="text-xs font-semibold">{formatDate(value)}</span>{duration ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">+{duration}</span> : null}</div>
      </div>)}
    </div>
  </div>;
}
