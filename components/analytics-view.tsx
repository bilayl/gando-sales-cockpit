"use client";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarCheck2, Loader2, PhoneCall, TrendingUp, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  "À prospecter": "border-white/10 bg-white/5 text-slate-300",
  "En prospection": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "Conversation": "border-sky-400/30 bg-sky-400/10 text-sky-300",
  "RDV booké": "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "À recycler": "border-orange-400/30 bg-orange-400/10 text-orange-300",
  "Non qualifié": "border-rose-400/30 bg-rose-400/10 text-rose-300",
  "Perdu": "border-rose-400/30 bg-rose-400/10 text-rose-300",
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
      const r = await fetch(`/api/analytics?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Impossible de charger les analytics");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (preset === "custom") return;
    const { start, end } = presetRange(preset);
    load(start, end);
  }, [preset, load]);

  function applyCustom() {
    if (!customStart || !customEnd) return;
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59`);
    if (start > end) return;
    load(start, end);
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
  const cards = [
    { label: "Appels", value: k?.calls ?? 0, suffix: "", icon: PhoneCall },
    { label: "Contacts travaillés", value: k?.worked ?? 0, suffix: "", icon: UsersRound },
    { label: "RDV bookés", value: k?.meetings ?? 0, suffix: "", icon: CalendarCheck2 },
    { label: "Conversion", value: k ? `${k.conversion}` : "—", suffix: k ? "%" : "", icon: TrendingUp },
  ];

  return <div className="min-h-[calc(100vh-24px)] p-6 minari-scrollbar">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(115,93,243,0.9)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300">Performance</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">KPIs commerciaux HubSpot par période.</p>
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/60 p-1">
        {presets.map(p => <Button key={p.key} onClick={() => setPreset(p.key)} variant={preset === p.key ? "secondary" : "ghost"} size="sm" className={cn("h-7 rounded-lg px-3", preset === p.key && "bg-accent/70 text-violet-200 shadow-[inset_0_0_0_1px_rgba(115,93,243,0.2)]")}>{p.label}</Button>)}
      </div>
    </div>

    {preset === "custom" ? <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="custom-start" className="text-xs text-muted-foreground">Du</Label>
        <Input id="custom-start" type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-44" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-end" className="text-xs text-muted-foreground">Au</Label>
        <Input id="custom-end" type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-44" />
      </div>
      <Button onClick={applyCustom} className="h-9">Appliquer</Button>
    </div> : null}

    {error ? <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

    {loading ? <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin text-violet-300" /> Calcul des KPIs…</div> : data ? <>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {cards.map(({ label, value, suffix, icon: Icon }) => <Card key={label} className="hover-lift overflow-hidden p-5">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-violet-300 shadow-[inset_0_0_0_1px_rgba(115,93,243,0.2)]"><Icon size={18} /></div>
            <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">Live</span>
          </div>
          <div className="mt-5">
            <div className="font-display text-3xl font-bold tracking-tight">{value}<span className="text-lg text-violet-300">{suffix}</span></div>
            <div className="mt-1 text-sm text-muted-foreground">{label}</div>
          </div>
        </Card>)}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm font-semibold">Répartition par statut de prospection</CardTitle></CardHeader>
        <CardContent>
          {data.distribution.length === 0 ? <p className="text-sm text-muted-foreground">Aucun contact travaillé avec un statut sur la période.</p> :
            <div className="grid gap-2 sm:grid-cols-2">
              {data.distribution.map(({ statut, count }) => {
                const max = data.distribution[0]?.count || 1;
                return <div key={statut} className="rounded-xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:border-violet-400/25">
                  <div className="flex items-center justify-between text-sm"><Badge variant="outline" className={cn("font-medium", BADGES[statut])}>{statut}</Badge><span className="font-display text-lg font-bold">{count}</span></div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-300 shadow-[0_0_8px_rgba(115,93,243,0.6)]" style={{ width: `${Math.round((count / max) * 100)}%` }} /></div>
                </div>;
              })}
            </div>}
        </CardContent>
      </Card>
    </> : null}
  </div>;
}
