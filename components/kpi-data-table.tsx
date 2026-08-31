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
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>
  const up = value >= 0
  return (
    <Badge variant="outline" className="h-6 gap-1 rounded-md px-2 text-[11px] font-medium tabular-nums">
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {up ? "+" : "-"}{percent(Math.abs(value))}
    </Badge>
  )
}

export function KpiDataTable({ data }: { data: KpiMonthlyPoint[] }) {
  const rows = [...data].reverse()

  return (
    <Card id="kpi-history" className="overflow-hidden shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-base">Chiffres mensuels</CardTitle>
        <CardDescription>Données brutes et ratios calculés automatiquement, mois par mois.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[980px]">
          <TableHeader className="bg-muted/35">
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-[120px] bg-muted/95 pl-6">Mois</TableHead>
              <TableHead>CA Gando</TableHead>
              <TableHead>Δ CA</TableHead>
              <TableHead>TDV</TableHead>
              <TableHead>Take rate</TableHead>
              <TableHead>Cautions</TableHead>
              <TableHead>Δ cautions</TableHead>
              <TableHead>MAU</TableHead>
              <TableHead>ARPU</TableHead>
              <TableHead className="pr-6">Caution moy.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.key}>
                <TableCell className="sticky left-0 z-[1] bg-card pl-6 font-medium">{row.label}</TableCell>
                <TableCell className="font-medium tabular-nums">{euro(row.revenue, 2)}</TableCell>
                <TableCell><ChangeBadge value={row.revenueGrowth} /></TableCell>
                <TableCell className="tabular-nums">{euro(row.tdv)}</TableCell>
                <TableCell className="tabular-nums">{percent(row.takeRate, 2)}</TableCell>
                <TableCell className="tabular-nums">{integer(row.deposits)}</TableCell>
                <TableCell><ChangeBadge value={row.depositGrowth} /></TableCell>
                <TableCell className="tabular-nums">{integer(row.activeRenters)}</TableCell>
                <TableCell className="tabular-nums">{euro(row.arpu, 2)}</TableCell>
                <TableCell className="pr-6 tabular-nums">{euro(row.avgDeposit)}</TableCell>
              </TableRow>
            ))}
            {!rows.length ? <TableRow><TableCell colSpan={10} className="h-28 text-center text-muted-foreground">Aucune donnée mensuelle.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
