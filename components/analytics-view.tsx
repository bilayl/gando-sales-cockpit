"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, Loader2, PhoneCall, TrendingUp, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Analytics = {
  start: string;
  end: string;
  kpis: { calls: number; meetings: number; worked: number; conversion: number };
  distribution: Array<{ statut: string; count: number }>;
};

const BADGES: Record<string, string> = {
  "À prospecter": "border-border bg-muted text-muted-foreground",
  "En prospection": "border-amber-200 bg-amber-50 text-amber-700",
  "Conversation": "border-sky-200 bg-sky-50 text-sky-700",
  "RDV booké": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "À recycler": "border-orange-200 bg-orange-50 text-orange-700",
  "Non qualifié": "border-rose-200 bg-rose-50 text-rose-700",
  "Perdu": "border-rose-200 bg-rose-50 text-rose-700",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }

type Preset = "jour" | "semaine" | "mois" | "trimestre" | "annee" | "custom";

function presetRange(preset: Preset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "jour": return { start: startOfDay(now), end: endOfDay(now) };
    case "semaine": return { start: startOfWeek(now), end: endOfDay(now) };
    case "mois": return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case "trimestre": { const q = Math.floor(now.getMonth() / 3); return { start: new Date(now.getFullYear(), q * 3, 1), end: endOfDay(now) }; }
    case "annee": return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
    default: return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function AnalyticsView() {
  const [preset, setPreset] = useState<Preset>("mois");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/analytics?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible de charger les statistiques");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (preset === "custom") return;
    const { start, end } = presetRange(preset);
    void load(start, end);
  }, [preset, load]);

  function applyCustom() {
    if (!customStart || !customEnd) return;
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59`);
    if (start <= end) void load(start, end);
  }

  const presets: Array<{ key: Preset; label: string }> = [
    { key: "jour", label: "Jour" },
    { key: "semaine", label: "Semaine" },
    { key: "mois", label: "Mois" },
    { key: "trimestre", label: "Trimestre" },
    { key: "annee", label: "Année" },
    { key: "custom", label: "Personnalisé" },
  ];

  const k = data?.kpis;
  const metrics = [
    { label: "Appels", value: k?.calls ?? 0, suffix: "", icon: PhoneCall },
    { label: "Contacts travaillés", value: k?.worked ?? 0, suffix: "", icon: UsersRound },
    { label: "RDV bookés", value: k?.meetings ?? 0, suffix: "", icon: CalendarCheck2 },
    { label: "Conversion", value: k ? `${k.conversion}` : "—", suffix: k ? "%" : "", icon: TrendingUp },
  ];

  return (
    <div className="page-shell min-h-screen">
      <div className="page-content">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.035em]">Statistiques</h1>
            <p className="mt-1 text-sm text-muted-foreground">Performance commerciale synchronisée avec HubSpot.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
            {presets.map(item => (
              <Button
                key={item.key}
                onClick={() => setPreset(item.key)}
                variant={preset === item.key ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-7 px-3", preset === item.key && "bg-accent text-accent-foreground")}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </header>

        {preset === "custom" ? (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
            <div className="space-y-1.5"><Label htmlFor="custom-start" className="text-xs text-muted-foreground">Du</Label><Input id="custom-start" type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="w-44" /></div>
            <div className="space-y-1.5"><Label htmlFor="custom-end" className="text-xs text-muted-foreground">Au</Label><Input id="custom-end" type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="w-44" /></div>
            <Button onClick={applyCustom}>Appliquer</Button>
          </div>
        ) : null}

        {error ? <div role="alert" className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin text-primary" /> Calcul des indicateurs…</div>
        ) : data ? (
          <>
            <section className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4">
              {metrics.map(({ label, value, suffix, icon: Icon }, index) => (
                <div key={label} className={cn(
                  "flex min-h-24 items-center gap-3 px-4 py-4",
                  index % 2 === 1 && "border-l border-border",
                  index > 1 && "border-t border-border",
                  index > 0 && "lg:border-l lg:border-t-0"
                )}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted text-primary"><Icon className="h-[18px] w-[18px]" /></span>
                  <div><div className="text-2xl font-bold tracking-[-0.035em]">{value}<span className="ml-0.5 text-base text-primary">{suffix}</span></div><div className="mt-0.5 text-xs text-muted-foreground">{label}</div></div>
                </div>
              ))}
            </section>

            <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="section-title">Répartition par statut</h2>
                <p className="mt-1 text-xs text-muted-foreground">Contacts travaillés sur la période sélectionnée.</p>
              </div>
              {data.distribution.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">Aucun contact travaillé avec un statut sur cette période.</p>
              ) : (
                <div>
                  {data.distribution.map(({ statut, count }) => {
                    const max = data.distribution[0]?.count || 1;
                    return (
                      <div key={statut} className="grid items-center gap-4 border-b border-border/70 px-5 py-3 last:border-b-0 sm:grid-cols-[180px_1fr_64px]">
                        <Badge variant="outline" className={cn("w-fit font-medium", BADGES[statut])}>{statut}</Badge>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((count / max) * 100)}%` }} /></div>
                        <span className="text-right text-sm font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
