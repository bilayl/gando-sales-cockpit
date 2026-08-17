"use client";

import { useEffect, useState } from "react";
import type { DealRoomDeal, DealRoomHealth, DealRoomQuickView } from "@/lib/deal-room-types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export const HEALTH_META: Record<DealRoomHealth, { label: string; emoji: string; badge: string; dot: string; bar: string }> = {
  on_track: { label: "On Track", emoji: "🟢", badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", dot: "bg-emerald-400", bar: "bg-emerald-400" },
  attention: { label: "Attention", emoji: "🟠", badge: "border-amber-400/30 bg-amber-400/10 text-amber-300", dot: "bg-amber-400", bar: "bg-amber-400" },
  at_risk: { label: "At Risk", emoji: "🔴", badge: "border-rose-400/30 bg-rose-400/10 text-rose-300", dot: "bg-rose-400", bar: "bg-rose-400" },
};

export function HealthBadge({ health, className }: { health: DealRoomHealth; className?: string }) {
  const meta = HEALTH_META[health];
  return (
    <Badge variant="outline" className={cn("rounded-md font-semibold", meta.badge, className)}>
      <span className="mr-1">{meta.emoji}</span> {meta.label}
    </Badge>
  );
}

export function ScoreRing({ value, size = 44, label = "Deal Score" }: { value: number; size?: number; label?: string }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp(value) / 100);
  const color = value >= 66 ? "#34d399" : value >= 45 ? "#fbbf24" : "#fb7185";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} title={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[10px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function PriorityBar({ deal, className }: { deal: DealRoomDeal; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Priority Score</span>
        <span className="text-sm font-bold text-primary">{clamp(deal.priorityScore)}<span className="text-[10px] font-semibold text-muted-foreground">/100</span></span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", deal.priorityScore >= 70 ? "bg-primary" : deal.priorityScore >= 45 ? "bg-amber-400" : "bg-rose-400")}
          style={{ width: `${clamp(deal.priorityScore)}%` }}
        />
      </div>
    </div>
  );
}

export function BreakdownBars({ deal, className }: { deal: DealRoomDeal; className?: string }) {
  const rows: Array<{ label: string; value: number; max: number; color: string }> = [
    { label: "Valeur", value: deal.breakdown.economic, max: 25, color: "bg-primary" },
    { label: "Stratégie", value: deal.breakdown.strategic, max: 25, color: "bg-sky-400" },
    { label: "Momentum", value: deal.breakdown.momentum, max: 25, color: "bg-emerald-400" },
    { label: "Santé", value: deal.breakdown.health, max: 25, color: HEALTH_META[deal.health].bar },
  ];
  return (
    <div className={cn("space-y-1.5", className)}>
      {rows.map(row => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", row.color)} style={{ width: `${(row.value / row.max) * 100}%` }} />
          </div>
          <span className="w-5 text-right text-[10px] font-semibold text-muted-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function formatEuro(value: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)} %`;
}

export function formatDate(value?: string | null, withYear = false) {
  if (!value) return "Non renseigné";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Non renseigné";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatRelative(value?: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigné";
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  if (days === -1) return "Hier";
  if (days > 1 && days < 14) return `Dans ${days} jours`;
  if (days < -1 && days > -14) return `Il y a ${Math.abs(days)} jours`;
  return formatDate(value, true);
}

export function initials(name: string | null | undefined) {
  const clean = (name || "?").trim();
  const parts = clean.split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${second}`.toUpperCase();
}

export function AvatarTile({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-xs font-bold text-primary", className)}>
      {initials(name)}
    </span>
  );
}

export const QUICK_VIEWS: Array<{ key: DealRoomQuickView; label: string; emoji: string; match: (deal: DealRoomDeal) => boolean }> = [
  { key: "all", label: "Tous", emoji: "🎯", match: () => true },
  { key: "hot", label: "Hot Deals", emoji: "🔥", match: deal => deal.priorityScore >= 70 },
  { key: "at_risk", label: "At Risk", emoji: "⚠️", match: deal => deal.health === "at_risk" },
  { key: "closing_soon", label: "Closing Soon", emoji: "🏆", match: deal => {
    if (!deal.closeDate) return false;
    const days = Math.round((new Date(deal.closeDate).getTime() - Date.now()) / 86_400_000);
    return days >= 0 && days <= 30;
  } },
  { key: "highest_value", label: "Highest Value", emoji: "💰", match: () => false },
  { key: "no_activity", label: "No Activity", emoji: "🕒", match: deal => deal.daysSinceLastActivity === null || deal.daysSinceLastActivity > 7 },
  { key: "meeting_this_week", label: "Meeting This Week", emoji: "📅", match: deal => {
    if (!deal.nextMeetingAt) return false;
    return Math.round((new Date(deal.nextMeetingAt).getTime() - Date.now()) / 86_400_000) <= 7;
  } },
];

export const SCORE_TONE_CLASSES: Record<string, string> = {
  good: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300",
  warn: "border-amber-400/25 bg-amber-400/[0.07] text-amber-300",
  bad: "border-rose-400/25 bg-rose-400/[0.07] text-rose-300",
  neutral: "border-border bg-muted/45 text-muted-foreground",
};