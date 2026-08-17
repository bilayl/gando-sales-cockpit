"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, PhoneCall, RefreshCw, Timer } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type HistoryItem = {
  type: "call" | "meeting";
  id: string;
  title: string;
  at: string;
  duration?: string;
  status?: string;
  disposition?: string;
  outcome?: string;
  ownerId?: string;
  toNumber?: string;
};

type ApiResponse = { items?: HistoryItem[]; error?: string };

function durationLabel(seconds?: string) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return null;
  if (s >= 60) return `${Math.floor(s / 60)} min ${s % 60 > 0 ? `${s % 60} s` : ""}`.trim();
  return `${s} s`;
}

export function HistoriqueView() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "call" | "meeting">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/historique");
      const d: ApiResponse = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur lors du chargement");
      setItems(d.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger l'historique");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((x) => x.type === filter)),
    [items, filter]
  );

  const calls = items.filter((x) => x.type === "call").length;
  const meetings = items.filter((x) => x.type === "meeting").length;

  return (
    <div className="page-shell min-h-screen minari-scrollbar"><div className="page-content">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.035em]">Historique</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Chargement…" : `${items.length} événements — ${calls} appels · ${meetings} rendez-vous`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={cn(loading && "animate-spin")} /> Actualiser
        </Button>
      </div>

      <div className="mt-5 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
        {([
          { key: "all", label: "Tout" },
          { key: "call", label: `Appels (${calls})` },
          { key: "meeting", label: `Rendez-vous (${meetings})` },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 text-xs h-7 gap-1.5 px-3 rounded-md",
              filter === tab.key ? "bg-secondary text-secondary-foreground shadow-sm" : "hover:bg-accent/60 hover:text-accent-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      <Card className="mt-5">
        <CardContent className="p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="animate-spin text-primary" /> Chargement de l&apos;historique…
            </div>
          ) : visible.length === 0 ? (
            <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Aucun événement sur cette période.
            </div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute bottom-2 left-[9px] top-2 w-px bg-border" />
              <div className="space-y-4">
                {visible.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="relative">
                    <span className="absolute -left-6 top-1 grid h-[18px] w-[18px] place-items-center rounded-full border border-border bg-background">
                      {item.type === "call" ? (
                        <PhoneCall size={9} className="text-primary" />
                      ) : (
                        <CalendarDays size={9} className="text-primary" />
                      )}
                    </span>
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/35">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold">{item.title}</span>
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", item.type === "call" ? "border-border bg-accent text-primary" : "border-sky-200 bg-sky-50 text-sky-700")}>
                            {item.type === "call" ? "Appel" : "Rendez-vous"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 font-mono">{formatDate(item.at)}</span>
                          {item.type === "call" && item.duration ? (
                            <span className="inline-flex items-center gap-1"><Timer size={12} /> {durationLabel(item.duration)}</span>
                          ) : null}
                          {item.type === "call" && item.status ? (
                            <span className="capitalize">{item.status.toLowerCase()}</span>
                          ) : null}
                          {item.type === "meeting" && item.outcome ? (
                            <span className="capitalize">Issue : {item.outcome.toLowerCase()}</span>
                          ) : null}
                          {item.toNumber ? <span className="font-mono">{item.toNumber}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div></div>
  );
}
