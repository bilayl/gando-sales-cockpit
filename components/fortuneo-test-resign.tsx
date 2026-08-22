"use client";

import { RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isFortuneoTestResignRoom } from "@/lib/sd05-test-deal";

type RoomPayload = {
  room?: { id?: string; company_name?: string } | null;
  documents?: Array<{ code?: string; status?: string; content?: { contractStatus?: string } }>;
};

function readableError(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["error", "message", "detail", "details"]) {
      const nested = record[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }
  return "Impossible de renvoyer le contrat.";
}

export function FortuneoTestResign({ dealId }: { dealId: string }) {
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sd05Status, setSd05Status] = useState("");

  async function loadEligibility() {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as RoomPayload;
      if (!response.ok) return;
      const isTestDeal = isFortuneoTestResignRoom(payload.room?.id);
      setEligible(isTestDeal);
      const sd05 = payload.documents?.find(document => document.code === "SD05");
      setSd05Status(sd05?.content?.contractStatus || sd05?.status || "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEligibility();
  }, [dealId]);

  async function resend() {
    if (!eligible || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-test-resign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readableError(payload));
      const sent = Array.isArray(payload.sent) ? payload.sent.length : 0;
      if (!sent) throw new Error(readableError(payload));
      toast.success(`Contrat Fortuneo renvoyé à ${sent} signataire${sent > 1 ? "s" : ""}. Une nouvelle signature peut être effectuée.`);
      setSd05Status("ready_to_sign");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de renvoyer le contrat Fortuneo.");
    } finally {
      setSending(false);
    }
  }

  if (loading || !eligible) return null;

  return (
    <div className="mx-auto mt-5 flex max-w-[1400px] flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"><ShieldCheck className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-sm font-bold">Mode test Fortuneo uniquement</div>
          <p className="mt-0.5 text-xs leading-5 opacity-80">Ce deal peut renvoyer le même contrat après validation et créer une nouvelle preuve de signature. Les autres deals restent verrouillés après signature.</p>
          {sd05Status ? <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">Statut SD05 : {sd05Status}</div> : null}
        </div>
      </div>
      <Button type="button" variant="outline" onClick={() => void resend()} disabled={sending} className="shrink-0 border-amber-400/50 bg-white/80 text-amber-900 hover:bg-amber-100 dark:bg-background/60 dark:text-amber-100">
        {sending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? "Renvoi en cours…" : "Renvoyer pour signature"}
      </Button>
    </div>
  );
}
