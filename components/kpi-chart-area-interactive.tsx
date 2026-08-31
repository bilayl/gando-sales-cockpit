"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/kpi-shadcn/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/kpi-shadcn/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/kpi-shadcn/ui/select"
import type { KpiMonthlyPoint } from "@/lib/kpi-dashboard"

type Metric = "revenue" | "tdv" | "deposits" | "activeRenters"

const METRICS: Record<Metric, { label: string; formatter: (value: number) => string }> = {
  revenue: { label: "CA Gando", formatter: value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value) },
  tdv: { label: "TDV sécurisé", formatter: value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(value) },
  deposits: { label: "Cautions activées", formatter: value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) },
  activeRenters: { label: "Loueurs actifs", formatter: value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value) },
}

export function KpiChartAreaInteractive({ data }: { data: KpiMonthlyPoint[] }) {
  const [metric, setMetric] = useState<Metric>("revenue")
  const [range, setRange] = useState("all")

  const visible = useMemo(() => {
    if (range === "6") return data.slice(-6)
    if (range === "12") return data.slice(-12)
    return data
  }, [data, range])

  const config = useMemo(() => ({
    value: {
      label: METRICS[metric].label,
      color: "#735DF3",
    },
  } satisfies ChartConfig), [metric])

  const chartData = visible.map(point => ({
    month: point.label,
    value: point[metric],
  }))

  return (
    <Card id="kpi-trajectory" className="shadow-sm">
      <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Trajectoire business</CardTitle>
          <CardDescription>Évolution mensuelle de la métrique sélectionnée.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={metric} onValueChange={value => setMetric(value as Metric)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(METRICS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout</SelectItem>
              <SelectItem value="12">12 mois</SelectItem>
              <SelectItem value="6">6 mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!chartData.length ? (
          <div className="grid h-[320px] place-items-center text-sm text-muted-foreground">Pas encore de données.</div>
        ) : (
          <ChartContainer config={config} className="h-[320px] w-full aspect-auto">
            <AreaChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="fillKpi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} minTickGap={26} />
              <YAxis
                width={56}
                tickLine={false}
                axisLine={false}
                tickFormatter={value => METRICS[metric].formatter(Number(value))}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={value => (
                      <div className="flex min-w-[140px] items-center justify-between gap-4">
                        <span className="text-muted-foreground">{METRICS[metric].label}</span>
                        <span className="font-mono font-medium tabular-nums text-foreground">{METRICS[metric].formatter(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <Area
                dataKey="value"
                type="monotone"
                fill="url(#fillKpi)"
                fillOpacity={1}
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-value)" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
