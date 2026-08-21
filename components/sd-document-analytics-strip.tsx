"use client";

import { useEffect, useState } from "react";
import { Clock3, Eye, Loader2, MousePointerClick } from "lucide-react";
import type { SDCode } from "@/lib/sd-room-types";

type Metric = { visits: number; opens: number; lastViewedAt: string | null };
type Payload = { documents?: Partial<Record<SDCode, Metric>> };

function date(value: string | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function SDDocumentAnalyticsStrip({ dealId, code }: { dealId: string; code: SDCode }) {
  const [metric, setMetric] = useState<Metric | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document-analytics`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((payload: Payload) => { if (active) setMetric(payload.documents?.[code] || { visits: 0, opens: 0, lastViewedAt: null }); })
      .catch(() => { if (active) setMetric({ visits: 0, opens: 0, lastViewedAt: null }); });
    return () => { active = false; };
  }, [code, dealId]);
  if (!metric) return <div className="flex h-10 items-center border-b border-border px-5 text-xs text-muted-foreground lg:px-7"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Statistiques de consultation…</div>;
  return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-muted/20 px-5 py-2.5 text-[11px] text-muted-foreground lg:px-7"><span className="font-black uppercase tracking-[0.12em] text-foreground">{code}</span><span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-primary" /> Visites <strong className="text-foreground">{metric.visits}</strong></span><span className="inline-flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5 text-primary" /> Ouvertures <strong className="text-foreground">{metric.opens}</strong></span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /> Dernière consultation <strong className="text-foreground">{date(metric.lastViewedAt)}</strong></span></div>;
}
