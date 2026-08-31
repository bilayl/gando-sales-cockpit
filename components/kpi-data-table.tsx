import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
  if (value == null) return <span className="text-[11px] text-muted-foreground/55">—</span>
  const up = value >= 0
  return (
    <Badge
      variant="outline"
      className={`h-5 gap-0.5 rounded-md px-1.5 text-[10px] font-semibold tabular-nums ${up ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-700" : "border-rose-200/80 bg-rose-50/70 text-rose-700"}`}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {up ? "+" : "-"}{percent(Math.abs(value))}
    </Badge>
  )
}

export function KpiDataTable({ data }: { data: KpiMonthlyPoint[] }) {
  const rows = [...data].reverse()

  return (
    <section id="kpi-history" className="min-w-0 bg-card">
      <div className="border-b border-border px-4 py-3 lg:px-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Historique</div>
        <div className="mt-0.5 text-sm font-semibold text-foreground">Chiffres mensuels</div>
      </div>
      <Table className="min-w-[980px] text-[11px]">
        <TableHeader className="bg-muted/35">
          <TableRow className="h-8 hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 h-8 min-w-[118px] border-r border-border bg-muted/95 pl-4 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Mois</TableHead>
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
            <TableRow key={row.key} className="group h-10 hover:bg-muted/25">
              <TableCell className="sticky left-0 z-[1] border-r border-border bg-card py-2 pl-4 font-semibold group-hover:bg-muted/25">{row.label}</TableCell>
              <TableCell className="py-2 font-semibold tabular-nums">{euro(row.revenue, 2)}</TableCell>
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
    </section>
  )
}
