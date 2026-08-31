import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
    <Badge variant="outline" className={up ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {percent(Math.abs(value))}
    </Badge>
  )
}

export function KpiDataTable({ data }: { data: KpiMonthlyPoint[] }) {
  const rows = [...data].reverse()

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="text-base">Chiffres mensuels</CardTitle>
        <CardDescription>Les données brutes et les ratios calculés automatiquement, mois par mois.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Mois</TableHead>
              <TableHead>CA Gando</TableHead>
              <TableHead>Δ CA</TableHead>
              <TableHead>TDV</TableHead>
              <TableHead>Take rate</TableHead>
              <TableHead>Cautions</TableHead>
              <TableHead>Δ cautions</TableHead>
              <TableHead>MAU</TableHead>
              <TableHead>ARPU</TableHead>
              <TableHead className="pr-5">Caution moy.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.key}>
                <TableCell className="pl-5 font-semibold">{row.label}</TableCell>
                <TableCell className="font-semibold">{euro(row.revenue, 2)}</TableCell>
                <TableCell><ChangeBadge value={row.revenueGrowth} /></TableCell>
                <TableCell>{euro(row.tdv)}</TableCell>
                <TableCell>{percent(row.takeRate, 2)}</TableCell>
                <TableCell>{integer(row.deposits)}</TableCell>
                <TableCell><ChangeBadge value={row.depositGrowth} /></TableCell>
                <TableCell>{integer(row.activeRenters)}</TableCell>
                <TableCell>{euro(row.arpu, 2)}</TableCell>
                <TableCell className="pr-5">{euro(row.avgDeposit, 0)}</TableCell>
              </TableRow>
            ))}
            {!rows.length ? <TableRow><TableCell colSpan={10} className="h-28 text-center text-muted-foreground">Aucune donnée mensuelle.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
