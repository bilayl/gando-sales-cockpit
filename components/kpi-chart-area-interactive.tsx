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
    <Card id="kpi-trajectory" className="overflow-hidden rounded-lg border-border shadow-none">
      <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <CardTitle className="text-[13px] font-medium">Trajectoire business</CardTitle>
          <CardDescription className="text-[11px]">Évolution mensuelle depuis le début de l’activité.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Select value={metric} onValueChange={value => setMetric(value as Metric)}>
            <SelectTrigger className="h-7 w-[145px] rounded-md px-2 text-[11px] shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(METRICS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-7 w-[92px] rounded-md px-2 text-[11px] shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout</SelectItem>
              <SelectItem value="12">12 mois</SelectItem>
              <SelectItem value="6">6 mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-4 sm:px-3">
        {!chartData.length ? (
          <div className="grid h-[258px] place-items-center text-[12px] text-muted-foreground">Pas encore de données.</div>
        ) : (
          <ChartContainer config={config} className="h-[258px] w-full aspect-auto">
            <AreaChart data={chartData} margin={{ left: -2, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="fillKpi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.015} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="0" stroke="currentColor" opacity={0.055} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={9} minTickGap={30} fontSize={10} />
              <YAxis
                width={52}
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tickFormatter={value => METRICS[metric].formatter(Number(value))}
              />
              <ChartTooltip
                cursor={{ stroke: "#d9d9dc", strokeWidth: 1 }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    className="rounded-md shadow-lg"
                    formatter={value => (
                      <div className="flex min-w-[130px] items-center justify-between gap-4">
                        <span className="text-muted-foreground">{METRICS[metric].label}</span>
                        <span className="font-medium tabular-nums text-foreground">{METRICS[metric].formatter(Number(value))}</span>
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
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5, fill: "#735DF3", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
