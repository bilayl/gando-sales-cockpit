"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Clock3, Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Visitor = {
  email: string;
  firstName: string;
  lastName: string;
  lastSeenAt: string;
  activeSeconds: number;
  sessions: number;
  stages: string[];
};

type Payload = {
  summary: {
    opens: number;
    uniqueVisitors: number;
    activeSeconds: number;
    sessions: number;
    lastViewedAt: string | null;
  };
  visitors: Visitor[];
};

function formatDate(value?: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function visitorName(visitor: Visitor) {
  return [visitor.firstName, visitor.lastName].filter(Boolean).join(" ") || visitor.email || "Visiteur";
}

export function SDLatestConsultationsCard({ dealId }: { dealId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/analytics`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setData(payload as Payload);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const visitors = data?.visitors?.slice(0, 3) || [];

  return (
    <div className="mx-auto max-w-[1500px] px-5 pt-4 lg:px-7">
      <Card className="rounded-[22px] border-border/80 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-black tracking-[-0.025em]">Dernières consultations</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Dernière activité : {formatDate(data?.summary.lastViewedAt)}</p>
          </div>
          <Link href="?tab=visitors" className="text-xs font-bold text-primary hover:underline">Voir tout l’historique</Link>
        </div>

        {loading && !data ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des consultations…</div>
        ) : visitors.length ? (
          <div className="mt-5 grid gap-2 md:grid-cols-3">
            {visitors.map(visitor => (
              <div key={visitor.email || `${visitor.firstName}-${visitor.lastName}`} className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="truncate text-sm font-bold">{visitorName(visitor)}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{visitor.email || "Email inconnu"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline">{visitor.sessions} visite{visitor.sessions > 1 ? "s" : ""}</Badge>
                  <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />{formatDuration(visitor.activeSeconds)}</Badge>
                  {visitor.stages.slice(0, 3).map(stage => <Badge key={stage} variant="secondary">{stage}</Badge>)}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">{formatDate(visitor.lastSeenAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">Aucune consultation pour le moment.</p>
        )}
      </Card>
    </div>
  );
}
