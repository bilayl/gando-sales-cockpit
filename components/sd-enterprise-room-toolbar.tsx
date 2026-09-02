"use client";

import { useEffect, useState } from "react";
import { Clock3, Copy, ExternalLink, Eye, MessageSquareText, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SDRoomAnalytics, SDRoomComment, SDRoomRecord } from "@/lib/sd-room-types";

const ROOM_BASE_URL = (process.env.NEXT_PUBLIC_ROOM_BASE_URL || "https://room.gando.pro").replace(/\/$/, "");
const EMPTY_ANALYTICS: SDRoomAnalytics = { opens: 0, uniqueVisitors: 0, activeSeconds: 0, lastViewedAt: null, recentVisitors: [] };

type RoomPayload = {
  room: SDRoomRecord | null;
  analytics?: SDRoomAnalytics;
  comments?: SDRoomComment[];
};

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return `${seconds} s`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function SDEnterpriseRoomToolbar({ dealId }: { dealId: string }) {
  const [payload, setPayload] = useState<RoomPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
        const next = await response.json();
        if (!response.ok) throw new Error(next.message || next.error || "Chargement impossible");
        if (!cancelled) setPayload(next);
      } catch {
        if (!cancelled) setPayload(null);
      }
    }
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [dealId]);

  const room = payload?.room;
  if (!room || room.room_mode === "standard") return null;

  const analytics = payload?.analytics || EMPTY_ANALYTICS;
  const comments = payload?.comments || [];
  const openComments = comments.filter(comment => comment.status === "open").length;
  const shareUrl = `${ROOM_BASE_URL}/r/${room.share_token}`;
  const shareReady = room.status === "published";

  async function copyLink() {
    if (!shareReady) {
      toast.error("Publie au moins une étape avant de partager la Deal Room.");
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Lien client copié");
  }

  return (
    <div className="border-b border-border bg-muted/20 px-5 py-3 lg:px-7">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className={shareReady ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}>
            {shareReady ? "Room publiée" : "Room en brouillon"}
          </Badge>
          <Badge variant="outline"><Eye className="mr-1 h-3.5 w-3.5" /> {analytics.opens} consultation{analytics.opens > 1 ? "s" : ""}</Badge>
          <Badge variant="outline"><Users className="mr-1 h-3.5 w-3.5" /> {analytics.uniqueVisitors} visiteur{analytics.uniqueVisitors > 1 ? "s" : ""}</Badge>
          <Badge variant="outline"><Clock3 className="mr-1 h-3.5 w-3.5" /> {formatDuration(analytics.activeSeconds)}</Badge>
          <Badge variant="outline">Dernière activité : {formatDate(analytics.lastViewedAt)}</Badge>
          {openComments ? <Badge variant="outline" className="border-primary/25 text-primary"><MessageSquareText className="mr-1 h-3.5 w-3.5" /> {openComments} remarque{openComments > 1 ? "s" : ""}</Badge> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyLink()}>
            <Copy className="mr-2 h-4 w-4" /> Copier le lien
          </Button>
          <Button variant="outline" size="sm" disabled={!shareReady} onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}>
            <ExternalLink className="mr-2 h-4 w-4" /> Voir côté client
          </Button>
        </div>
      </div>
    </div>
  );
}
