import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/kpi-shadcn/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/kpi-shadcn/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/kpi-shadcn/ui/table"
import type { KpiMonthlyPoint } from "@/lib/kpi-dashboard"

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value)
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[11px] text-muted-foreground/55">—</span>
  const up = value >= 0
  return (
    <Badge
      variant="outline"
      className={`h-5 gap-0.5 rounded-[5px] px-1.5 text-[10px] font-medium shadow-none tabular-nums ${up ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {up ? "+" : "-"}{percent(Math.abs(value))}
    </Badge>
  )
}

export function KpiDataTable({ data }: { data: KpiMonthlyPoint[] }) {
  const rows = [...data].reverse()

  return (
    <Card id="kpi-history" className="overflow-hidden rounded-lg border-border shadow-none">
      <CardHeader className="space-y-0.5 border-b border-border px-4 py-3">
        <CardTitle className="text-[13px] font-medium">Historique mensuel</CardTitle>
        <CardDescription className="text-[11px]">Données brutes et ratios calculés automatiquement.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[980px] text-[11px]">
          <TableHeader className="bg-[#fafafa]">
            <TableRow className="h-8 hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 h-8 min-w-[118px] border-r border-border bg-[#fafafa] pl-4 text-[10px] font-medium text-muted-foreground">Mois</TableHead>
              <TableHead className="h-8 text-[10px]">CA Gando</TableHead>
              <TableHead className="h-8 text-[10px]">Δ CA</TableHead>
              <TableHead className="h-8 text-[10px]">TDV</TableHead>
              <TableHead className="h-8 text-[10px]">Take rate</TableHead>
              <TableHead className="h-8 text-[10px]">Cautions</TableHead>
              <TableHead className="h-8 text-[10px]">Δ cautions</TableHead>
              <TableHead className="h-8 text-[10px]">MAU</TableHead>
              <TableHead className="h-8 text-[10px]">ARPU</TableHead>
              <TableHead className="h-8 pr-4 text-[10px]">Caution moy.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.key} className="h-10 hover:bg-muted/25">
                <TableCell className="sticky left-0 z-[1] border-r border-border bg-card py-2 pl-4 font-medium group-hover:bg-muted/25">{row.label}</TableCell>
                <TableCell className="py-2 font-medium tabular-nums">{euro(row.revenue, 2)}</TableCell>
                <TableCell className="py-2"><ChangeBadge value={row.revenueGrowth} /></TableCell>
                <TableCell className="py-2 tabular-nums">{euro(row.tdv)}</TableCell>
                <TableCell className="py-2 tabular-nums">{percent(row.takeRate, 2)}</TableCell>
                <TableCell className="py-2 tabular-nums">{integer(row.deposits)}</TableCell>
                <TableCell className="py-2"><ChangeBadge value={row.depositGrowth} /></TableCell>
                <TableCell className="py-2 tabular-nums">{integer(row.activeRenters)}</TableCell>
                <TableCell className="py-2 tabular-nums">{euro(row.arpu, 2)}</TableCell>
                <TableCell className="py-2 pr-4 tabular-nums">{euro(row.avgDeposit)}</TableCell>
              </TableRow>
            ))}
            {!rows.length ? <TableRow><TableCell colSpan={10} className="h-24 text-center text-[11px] text-muted-foreground">Aucune donnée mensuelle.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
