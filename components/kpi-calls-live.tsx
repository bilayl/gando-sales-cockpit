"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Clock3, PhoneCall, PhoneOutgoing, RefreshCw, Target, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type UserStats = {
  key: string
  name: string
  email: string | null
  number: string | null
  calls: number
  outbound: number
  answered: number
  outboundAnswered: number
  talkSeconds: number
  meaningfulCalls: number
  lastCallAt: string | null
  avgTalkSeconds: number
  answerRate: number | null
}

type LiveStats = {
  source: string
  start: string
  end: string
  targetOutboundCalls: number
  kpis: {
    calls: number
    outbound: number
    inbound: number
    answered: number
    outboundAnswered: number
    talkSeconds: number
    avgTalkSeconds: number
    meaningfulCalls: number
    answerRate: number | null
    pacing: number
    lastCallAt: string | null
  }
  users: UserStats[]
  freshness: {
    lastReceivedAt: string | null
    staleHours: number | null
    isStale: boolean
  }
}

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

function percent(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}

function duration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "—"
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours) return `${hours} h ${String(minutes).padStart(2, "0")} min`
  if (minutes) return `${minutes} min ${String(secs).padStart(2, "0")} s`
  return `${secs} s`
}

function time(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date)
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Jamais reçu"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date inconnue"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
}

export function KpiCallsLive() {
  const [data, setData] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError("")
    try {
      const { start, end } = todayRange()
      const params = new URLSearchParams({ start, end })
      const response = await fetch(`/api/analytics/onoff-live?${params.toString()}`, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de charger Onoff.")
      setData(body)
      setLastRefresh(new Date())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger Onoff.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  const progress = useMemo(() => Math.min(1, Math.max(0, data?.kpis.pacing || 0)), [data])

  if (loading) return <Skeleton className="h-[620px] w-full rounded-xl" />

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div> : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Onoff · aujourd’hui</div>
            <div className="mt-0.5 text-sm font-semibold">La journée d’appels, sans attendre l’agrégation mensuelle.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data?.freshness.isStale ? "destructive" : "secondary"} className="text-[9px]">
              {data?.freshness.isStale ? "Flux Onoff à vérifier" : "Onoff direct"}
            </Badge>
            <span className="text-[9px] text-muted-foreground">Actualisé {lastRefresh ? time(lastRefresh.toISOString()) : "—"}</span>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        {data?.freshness.isStale ? (
          <div className="flex gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div><strong>Le flux n’est pas frais.</strong> Dernier CDR Onoff reçu : {dateTime(data.freshness.lastReceivedAt)}. Un zéro aujourd’hui ne doit donc pas être interprété comme “aucun appel”.</div>
          </div>
        ) : null}

        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-6">
          {[
            ["Appels sortants", integer(data?.kpis.outbound), `${integer(data?.kpis.calls)} appels au total`, PhoneOutgoing],
            ["Temps en conversation", duration(data?.kpis.talkSeconds), `${integer(data?.kpis.outboundAnswered)} sortants décrochés`, Clock3],
            ["Durée moyenne", duration(data?.kpis.avgTalkSeconds), "sur appels décrochés", PhoneCall],
            ["Taux de décroché", percent(data?.kpis.answerRate), `${integer(data?.kpis.outboundAnswered)} / ${integer(data?.kpis.outbound)}`, UsersRound],
            ["Appels > 30 s", integer(data?.kpis.meaningfulCalls), "conversations significatives", PhoneCall],
            ["Objectif appels", percent(data?.kpis.pacing), `${integer(data?.kpis.outbound)} / ${integer(data?.targetOutboundCalls || 80)}`, Target],
          ].map(([label, value, detail, Icon]) => (
            <div key={String(label)} className="px-4 py-4">
              <div className="flex items-center justify-between gap-2"><div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{String(label)}</div>{typeof Icon !== "string" ? <Icon className="size-3.5 text-primary" /> : null}</div>
              <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{String(value)}</div>
              <div className="mt-1 text-[10px] font-medium text-muted-foreground">{String(detail)}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-[10px]"><span className="font-semibold">Rythme vers {data?.targetOutboundCalls || 80} appels</span><span className="text-muted-foreground">Dernier appel {time(data?.kpis.lastCallAt)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Performance par commercial</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Données CDR Onoff reçues aujourd’hui, regroupées par utilisateur.</div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Commercial</TableHead><TableHead className="text-right">Sortants</TableHead><TableHead className="text-right">Décrochés</TableHead><TableHead className="text-right">Taux</TableHead><TableHead className="text-right">Temps conversation</TableHead><TableHead className="text-right">Moyenne</TableHead><TableHead className="text-right">&gt; 30 s</TableHead><TableHead className="text-right">Dernier appel</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.users.length ? data.users.map(user => (
                <TableRow key={user.key}>
                  <TableCell><div className="text-xs font-semibold">{user.name}</div>{user.email ? <div className="text-[9px] text-muted-foreground">{user.email}</div> : null}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{integer(user.outbound)}</TableCell>
                  <TableCell className="text-right tabular-nums">{integer(user.outboundAnswered)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(user.answerRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{duration(user.talkSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{duration(user.avgTalkSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{integer(user.meaningfulCalls)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{time(user.lastCallAt)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={8} className="h-24 text-center text-xs text-muted-foreground">Aucun CDR Onoff reçu aujourd’hui.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
