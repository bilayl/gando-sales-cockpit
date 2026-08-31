"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { KpiMonthlyPoint } from "@/lib/kpi-dashboard"

type Metric = "revenue" | "tdv" | "deposits" | "activeRenters"

const METRICS: Record<Metric, { label: string; formatter: (value: number) => string }> = {
  revenue: { label: "CA Gando", formatter: value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value) },
  tdv: { label: "TDV sécurisé", formatter: value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(value) },
  deposits: { label: "Cautions activées", formatter: value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) },
  activeRenters: { label: "Loueurs actifs", formatter: value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) },
}

function pathFor(values: number[], width: number, height: number, padding: number) {
  if (!values.length) return { line: "", area: "", coords: [] as Array<[number, number]> }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(1, max - min)
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2
  const coords = values.map((value, index) => {
    const x = padding + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth)
    const y = padding + innerHeight - ((value - min) / range) * innerHeight
    return [x, y] as [number, number]
  })
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${line} L${coords.at(-1)?.[0] ?? padding},${height - padding} L${coords[0]?.[0] ?? padding},${height - padding} Z`
  return { line, area, coords }
}

export function KpiChartAreaInteractive({ data }: { data: KpiMonthlyPoint[] }) {
  const [metric, setMetric] = useState<Metric>("revenue")
  const [range, setRange] = useState("all")

  const visible = useMemo(() => {
    if (range === "6") return data.slice(-6)
    if (range === "12") return data.slice(-12)
    return data
  }, [data, range])

  const values = visible.map(point => point[metric])
  const chart = pathFor(values, 1000, 300, 42)
  const metricConfig = METRICS[metric]

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-col gap-4 space-y-0 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Trajectoire business</CardTitle>
          <CardDescription className="mt-1">Évolution mensuelle depuis le début de l’activité.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={metric} onValueChange={value => setMetric(value as Metric)}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(METRICS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout</SelectItem>
              <SelectItem value="12">12 mois</SelectItem>
              <SelectItem value="6">6 mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-5 sm:px-5">
        {!visible.length ? <div className="grid h-[280px] place-items-center text-sm text-muted-foreground">Pas encore de données.</div> : (
          <div className="overflow-hidden rounded-xl bg-muted/25">
            <svg viewBox="0 0 1000 300" className="h-[300px] w-full" role="img" aria-label={`Graphique ${metricConfig.label}`}>
              <defs>
                <linearGradient id="kpi-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map(index => {
                const y = 42 + index * 54
                return <line key={index} x1="42" y1={y} x2="958" y2={y} stroke="currentColor" strokeOpacity="0.08" />
              })}
              <g className="text-primary" color="currentColor">
                <path d={chart.area} fill="url(#kpi-area)" />
                <path d={chart.line} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {chart.coords.map(([x, y], index) => (
                  <g key={`${x}-${y}`}>
                    <circle cx={x} cy={y} r="5" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="3">
                      <title>{`${visible[index].label} · ${metricConfig.formatter(values[index])}`}</title>
                    </circle>
                  </g>
                ))}
              </g>
              {visible.map((point, index) => {
                if (visible.length > 8 && index % Math.ceil(visible.length / 6) !== 0 && index !== visible.length - 1) return null
                const x = 42 + (visible.length === 1 ? 458 : (index / (visible.length - 1)) * 916)
                return <text key={point.key} x={x} y="286" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.5">{point.label}</text>
              })}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
