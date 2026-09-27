"use client"

import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, CheckCircle2, CircleDollarSign, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

const MONTHS = 36

type PaymentTier = {
  from: number
  to: number | null
  rate: number
}

type MonthRow = {
  month: number
  paymentVolume: number
  europeanVolume: number
  internationalVolume: number
  transactions: number
  cautionCount: number
  cautionVolume: number
  paymentRevenue: number
  cautionRevenue: number
  revenue: number
  pspCost: number
  lossCost: number
  otherVariableCost: number
  fixedCost: number
  totalCost: number
  contribution: number
  cumulativeContribution: number
  marginRate: number
  contributionPerBooking: number
  cautionRate: number
}

function euro(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function compactEuro(value: number) {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function integer(value: number) {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

function pct(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

function progressiveRateRevenue(volume: number, cumulativeBefore: number, tiers: PaymentTier[]) {
  let remaining = Math.max(0, volume)
  let cursor = Math.max(0, cumulativeBefore)
  let revenue = 0

  for (const tier of tiers) {
    if (remaining <= 0) break
    const tierEnd = tier.to ?? Number.POSITIVE_INFINITY
    if (cursor >= tierEnd) continue

    const start = Math.max(cursor, tier.from)
    const available = tierEnd - start
    const amount = Math.min(remaining, available)
    if (amount > 0) {
      revenue += amount * tier.rate
      remaining -= amount
      cursor += amount
    }
  }

  return revenue
}

function getCautionRate(count: number, rates: number[]) {
  if (count < 1000) return rates[0]
  if (count < 3000) return rates[1]
  if (count < 5000) return rates[2]
  if (count < 10000) return rates[3]
  return rates[4]
}

type NumberFieldProps = {
  label: string
  value: number
  suffix: string
  onChange: (value: number) => void
  step?: number
  min?: number
  hint?: string
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
  step = 1,
  min = 0,
  hint,
}: NumberFieldProps) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div className="flex h-9 items-center rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/20">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={event => onChange(parseNumber(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold tabular-nums outline-none"
        />
        <span className="ml-2 text-[10px] text-muted-foreground">{suffix}</span>
      </div>
      {hint ? <span className="block text-[9px] leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

function SummaryCell({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-[22px] font-semibold tabular-nums">{value}</div>
      {detail ? <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</div> : null}
    </div>
  )
}

type TooltipItem = { name?: string; value?: number | string; color?: string }

function ProjectionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: number
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-card p-2.5 text-[10px] shadow-lg">
      <div className="mb-1.5 font-bold">Mois {label}</div>
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color || "var(--muted-foreground)" }} />
              {item.name}
            </span>
            <span className="font-semibold tabular-nums">{euro(Number(item.value || 0))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KpiOfferAnalysis() {
  const [offerName, setOfferName] = useState("Cityrent × Alizés × Simplycar")

  const [startingMonthlyPaymentVolume, setStartingMonthlyPaymentVolume] = useState(100000)
  const [monthlyGrowthRate, setMonthlyGrowthRate] = useState(5)
  const [averagePayment, setAveragePayment] = useState(500)
  const [internationalShare, setInternationalShare] = useState(0)
  const [cautionCoverage, setCautionCoverage] = useState(100)
  const [averageCaution, setAverageCaution] = useState(1000)

  const [paymentRate0To1m, setPaymentRate0To1m] = useState(1)
  const [paymentRate1To3m, setPaymentRate1To3m] = useState(0.95)
  const [paymentRate3To5m, setPaymentRate3To5m] = useState(0.9)
  const [paymentRate5mPlus, setPaymentRate5mPlus] = useState(0.9)
  const [internationalPaymentRate, setInternationalPaymentRate] = useState(4)
  const [paymentFixedRevenue, setPaymentFixedRevenue] = useState(0.5)

  const [cautionRate0To999, setCautionRate0To999] = useState(2.9)
  const [cautionRate1000To2999, setCautionRate1000To2999] = useState(2.6)
  const [cautionRate3000To4999, setCautionRate3000To4999] = useState(2.4)
  const [cautionRate5000To9999, setCautionRate5000To9999] = useState(2.2)
  const [cautionRate10000Plus, setCautionRate10000Plus] = useState(1.99)

  const [pspRate, setPspRate] = useState(1.6)
  const [pspFixedCost, setPspFixedCost] = useState(0.35)
  const [lossRate, setLossRate] = useState(1.7)
  const [otherVariableCostPerCaution, setOtherVariableCostPerCaution] = useState(0)
  const [monthlySupportCost, setMonthlySupportCost] = useState(0)
  const [implementationCost, setImplementationCost] = useState(0)

  const analysis = useMemo(() => {
    const paymentTiers: PaymentTier[] = [
      { from: 0, to: 1_000_000, rate: paymentRate0To1m / 100 },
      { from: 1_000_000, to: 3_000_000, rate: paymentRate1To3m / 100 },
      { from: 3_000_000, to: 5_000_000, rate: paymentRate3To5m / 100 },
      { from: 5_000_000, to: null, rate: paymentRate5mPlus / 100 },
    ]
    const cautionRates = [
      cautionRate0To999 / 100,
      cautionRate1000To2999 / 100,
      cautionRate3000To4999 / 100,
      cautionRate5000To9999 / 100,
      cautionRate10000Plus / 100,
    ]

    const rows: MonthRow[] = []
    let cumulativeEurope = 0
    let cumulativeContribution = 0

    for (let index = 0; index < MONTHS; index += 1) {
      const paymentVolume = startingMonthlyPaymentVolume * Math.pow(1 + monthlyGrowthRate / 100, index)
      const safeAveragePayment = Math.max(1, averagePayment)
      const transactions = paymentVolume / safeAveragePayment
      const internationalVolume = paymentVolume * Math.min(1, Math.max(0, internationalShare / 100))
      const europeanVolume = paymentVolume - internationalVolume
      const cautionCount = transactions * Math.min(1, Math.max(0, cautionCoverage / 100))
      const cautionVolume = cautionCount * averageCaution
      const cautionRate = getCautionRate(cautionCount, cautionRates)

      const europeanPaymentRevenue = progressiveRateRevenue(europeanVolume, cumulativeEurope, paymentTiers)
      const internationalRevenue = internationalVolume * (internationalPaymentRate / 100)
      const paymentRevenue = europeanPaymentRevenue + internationalRevenue + transactions * paymentFixedRevenue
      const cautionRevenue = cautionVolume * cautionRate
      const revenue = paymentRevenue + cautionRevenue

      const pspCost = paymentVolume * (pspRate / 100) + transactions * pspFixedCost
      const lossCost = cautionVolume * (lossRate / 100)
      const otherVariableCost = cautionCount * otherVariableCostPerCaution
      const fixedCost = monthlySupportCost + (index === 0 ? implementationCost : 0)
      const totalCost = pspCost + lossCost + otherVariableCost + fixedCost
      const contribution = revenue - totalCost
      cumulativeContribution += contribution

      rows.push({
        month: index + 1,
        paymentVolume,
        europeanVolume,
        internationalVolume,
        transactions,
        cautionCount,
        cautionVolume,
        paymentRevenue,
        cautionRevenue,
        revenue,
        pspCost,
        lossCost,
        otherVariableCost,
        fixedCost,
        totalCost,
        contribution,
        cumulativeContribution,
        marginRate: revenue > 0 ? contribution / revenue : 0,
        contributionPerBooking: transactions > 0 ? contribution / transactions : 0,
        cautionRate,
      })

      cumulativeEurope += europeanVolume
    }

    const totals = rows.reduce(
      (acc, row) => ({
        paymentVolume: acc.paymentVolume + row.paymentVolume,
        cautionVolume: acc.cautionVolume + row.cautionVolume,
        transactions: acc.transactions + row.transactions,
        cautionCount: acc.cautionCount + row.cautionCount,
        paymentRevenue: acc.paymentRevenue + row.paymentRevenue,
        cautionRevenue: acc.cautionRevenue + row.cautionRevenue,
        revenue: acc.revenue + row.revenue,
        pspCost: acc.pspCost + row.pspCost,
        lossCost: acc.lossCost + row.lossCost,
        otherVariableCost: acc.otherVariableCost + row.otherVariableCost,
        fixedCost: acc.fixedCost + row.fixedCost,
        totalCost: acc.totalCost + row.totalCost,
        contribution: acc.contribution + row.contribution,
      }),
      {
        paymentVolume: 0,
        cautionVolume: 0,
        transactions: 0,
        cautionCount: 0,
        paymentRevenue: 0,
        cautionRevenue: 0,
        revenue: 0,
        pspCost: 0,
        lossCost: 0,
        otherVariableCost: 0,
        fixedCost: 0,
        totalCost: 0,
        contribution: 0,
      },
    )

    const breakEvenMonth = rows.find(row => row.cumulativeContribution >= 0)?.month ?? null
    const firstNegativeMonth = rows.find(row => row.contribution < 0)?.month ?? null
    const worstMonth = rows.reduce((worst, row) => row.contribution < worst.contribution ? row : worst, rows[0])
    const marginRate = totals.revenue > 0 ? totals.contribution / totals.revenue : 0
    const contributionPerBooking = totals.transactions > 0 ? totals.contribution / totals.transactions : 0

    const yearly = [0, 1, 2].map(yearIndex => {
      const yearRows = rows.slice(yearIndex * 12, yearIndex * 12 + 12)
      const values = yearRows.reduce(
        (acc, row) => ({
          paymentVolume: acc.paymentVolume + row.paymentVolume,
          cautionCount: acc.cautionCount + row.cautionCount,
          revenue: acc.revenue + row.revenue,
          totalCost: acc.totalCost + row.totalCost,
          contribution: acc.contribution + row.contribution,
        }),
        { paymentVolume: 0, cautionCount: 0, revenue: 0, totalCost: 0, contribution: 0 },
      )
      return {
        year: yearIndex + 1,
        ...values,
        marginRate: values.revenue > 0 ? values.contribution / values.revenue : 0,
      }
    })

    return {
      rows,
      totals,
      breakEvenMonth,
      firstNegativeMonth,
      worstMonth,
      marginRate,
      contributionPerBooking,
      yearly,
    }
  }, [
    startingMonthlyPaymentVolume,
    monthlyGrowthRate,
    averagePayment,
    internationalShare,
    cautionCoverage,
    averageCaution,
    paymentRate0To1m,
    paymentRate1To3m,
    paymentRate3To5m,
    paymentRate5mPlus,
    internationalPaymentRate,
    paymentFixedRevenue,
    cautionRate0To999,
    cautionRate1000To2999,
    cautionRate3000To4999,
    cautionRate5000To9999,
    cautionRate10000Plus,
    pspRate,
    pspFixedCost,
    lossRate,
    otherVariableCostPerCaution,
    monthlySupportCost,
    implementationCost,
  ])

  const profitable = analysis.totals.contribution > 0
  const scaleSafe = analysis.firstNegativeMonth == null
  const finalMonth = analysis.rows[analysis.rows.length - 1]

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-primary/[0.025] px-4 py-4">
          <div className="min-w-[260px] flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Analyse offre · 36 mois</div>
            <input
              value={offerName}
              onChange={event => setOfferName(event.target.value)}
              className="mt-1 w-full max-w-2xl bg-transparent text-lg font-bold outline-none"
              aria-label="Nom de l'offre"
            />
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
              Projection des revenus paiement + caution, coûts PSP, pertes attendues et coûts variables pour vérifier si l’offre reste rentable quand les volumes cumulés augmentent.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={profitable ? "secondary" : "destructive"} className="h-7 gap-1.5">
              {profitable ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {profitable ? "Rentable sur 36 mois" : "Non rentable sur 36 mois"}
            </Badge>
            <Badge variant={scaleSafe ? "outline" : "destructive"} className="h-7 gap-1.5">
              {scaleSafe ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {scaleSafe ? "Rentable à chaque mois" : `Marge négative dès M${analysis.firstNegativeMonth}`}
            </Badge>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCell label="Volume paiement 36 mois" value={compactEuro(analysis.totals.paymentVolume)} detail={`${integer(analysis.totals.transactions)} réservations estimées`} />
          <div className="border-t border-border sm:border-l sm:border-t-0">
            <SummaryCell label="CA Gando 36 mois" value={compactEuro(analysis.totals.revenue)} detail={`${compactEuro(analysis.totals.paymentRevenue)} paiement + ${compactEuro(analysis.totals.cautionRevenue)} caution`} />
          </div>
          <div className="border-t border-border xl:border-l xl:border-t-0">
            <SummaryCell label="Coûts variables + offre" value={compactEuro(analysis.totals.totalCost)} detail={`PSP ${compactEuro(analysis.totals.pspCost)} · risque ${compactEuro(analysis.totals.lossCost)}`} />
          </div>
          <div className="border-t border-border sm:border-l xl:border-t-0">
            <SummaryCell label="Marge contributive 36 mois" value={compactEuro(analysis.totals.contribution)} detail={`${pct(analysis.marginRate)} du CA Gando`} />
          </div>
          <div className="border-t border-border xl:border-l xl:border-t-0">
            <SummaryCell label="Marge moyenne / réservation" value={euro(analysis.contributionPerBooking, 2)} detail={`M36 : ${euro(finalMonth.contributionPerBooking, 2)} / résa.`} />
          </div>
        </div>

        <div className={`border-t border-border px-4 py-3 text-xs ${profitable && scaleSafe ? "bg-emerald-50/50 text-emerald-950 dark:bg-emerald-950/10 dark:text-emerald-100" : "bg-amber-50/60 text-amber-950 dark:bg-amber-950/10 dark:text-amber-100"}`}>
          <span className="font-bold">Lecture CEO :</span>{" "}
          {profitable && scaleSafe
            ? `avec ces hypothèses, l’offre ${offerName} crée ${compactEuro(analysis.totals.contribution)} de marge contributive sur 36 mois et reste positive même au plus gros volume simulé.`
            : profitable
              ? `l’offre reste positive sur 36 mois, mais elle devient déficitaire mensuellement à partir du mois ${analysis.firstNegativeMonth}. Le pricing se dégrade donc avec l’échelle : il faut corriger un palier avant d’accélérer.`
              : `l’offre détruit ${compactEuro(Math.abs(analysis.totals.contribution))} sur 36 mois avec ces hypothèses. Il faut revoir le pricing, les coûts PSP, le loss rate ou le niveau de caution avant signature.`}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Hypothèses activité</div>
            <div className="mt-0.5 text-sm font-semibold">Volumes Cityrent + Alizés + Simplycar</div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField label="Volume paiement M1" value={startingMonthlyPaymentVolume} suffix="€/mois" step={10000} onChange={setStartingMonthlyPaymentVolume} />
            <NumberField label="Croissance mensuelle" value={monthlyGrowthRate} suffix="%" step={0.5} onChange={setMonthlyGrowthRate} />
            <NumberField label="Panier paiement moyen" value={averagePayment} suffix="€" step={25} min={1} onChange={setAveragePayment} />
            <NumberField label="Part international" value={internationalShare} suffix="%" step={1} onChange={setInternationalShare} />
            <NumberField label="Réservations avec caution Gando" value={cautionCoverage} suffix="%" step={1} onChange={setCautionCoverage} hint="100 % par défaut : caution Gando obligatoire dans l’offre." />
            <NumberField label="Caution moyenne" value={averageCaution} suffix="€" step={50} onChange={setAverageCaution} />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Coûts Gando</div>
            <div className="mt-0.5 text-sm font-semibold">Ce que l’offre doit absorber réellement</div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField label="Coût PSP" value={pspRate} suffix="%" step={0.1} onChange={setPspRate} />
            <NumberField label="Coût PSP fixe" value={pspFixedCost} suffix="€/paiement" step={0.05} onChange={setPspFixedCost} />
            <NumberField label="Loss rate net" value={lossRate} suffix="%" step={0.1} onChange={setLossRate} hint="Après recouvrement / récupération." />
            <NumberField label="Autre coût variable" value={otherVariableCostPerCaution} suffix="€/caution" step={0.1} onChange={setOtherVariableCostPerCaution} />
            <NumberField label="Support / compte" value={monthlySupportCost} suffix="€/mois" step={50} onChange={setMonthlySupportCost} />
            <NumberField label="Coût intégration initial" value={implementationCost} suffix="€" step={500} onChange={setImplementationCost} />
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
            <CircleDollarSign size={13} />
            Tarifs proposés
          </div>
          <div className="mt-0.5 text-sm font-semibold">Offre Cityrent × Alizés × Simplycar</div>
          <p className="mt-1 text-[10px] text-muted-foreground">Paiement : paliers progressifs sur le volume Europe cumulé. Caution : palier déterminé chaque mois par le nombre de cautions activées.</p>
        </div>

        <div className="grid gap-5 p-4 xl:grid-cols-2">
          <div>
            <div className="mb-3 text-xs font-bold">Paiement</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField label="0 → 1 M€" value={paymentRate0To1m} suffix="% HT" step={0.05} onChange={setPaymentRate0To1m} />
              <NumberField label="1 → 3 M€" value={paymentRate1To3m} suffix="% HT" step={0.05} onChange={setPaymentRate1To3m} />
              <NumberField label="3 → 5 M€" value={paymentRate3To5m} suffix="% HT" step={0.05} onChange={setPaymentRate3To5m} />
              <NumberField label="5 M€ +" value={paymentRate5mPlus} suffix="% HT" step={0.05} onChange={setPaymentRate5mPlus} />
              <NumberField label="International" value={internationalPaymentRate} suffix="% HT" step={0.1} onChange={setInternationalPaymentRate} />
              <NumberField label="Fixe facturé" value={paymentFixedRevenue} suffix="€/paiement" step={0.05} onChange={setPaymentFixedRevenue} />
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-bold">Caution Gando</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField label="0 → 999 / mois" value={cautionRate0To999} suffix="% HT" step={0.01} onChange={setCautionRate0To999} />
              <NumberField label="1 000 → 2 999" value={cautionRate1000To2999} suffix="% HT" step={0.01} onChange={setCautionRate1000To2999} />
              <NumberField label="3 000 → 4 999" value={cautionRate3000To4999} suffix="% HT" step={0.01} onChange={setCautionRate3000To4999} />
              <NumberField label="5 000 → 9 999" value={cautionRate5000To9999} suffix="% HT" step={0.01} onChange={setCautionRate5000To9999} />
              <NumberField label="10 000 +" value={cautionRate10000Plus} suffix="% HT" step={0.01} onChange={setCautionRate10000Plus} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Projection 36 mois</div>
          <div className="mt-0.5 text-sm font-semibold">La rentabilité tient-elle quand les paliers tarifaires baissent ?</div>
        </div>
        <div className="h-[340px] px-2 pb-3 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analysis.rows} margin={{ top: 6, right: 18, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={value => `M${value}`} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={22} />
              <YAxis tickFormatter={value => compactEuro(Number(value))} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={62} />
              <Tooltip content={<ProjectionTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="revenue" name="CA Gando / mois" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="totalCost" name="Coûts / mois" stroke="var(--chart-5)" strokeWidth={1.8} dot={false} />
              <Line type="monotone" dataKey="contribution" name="Marge / mois" stroke="var(--chart-2)" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Points de contrôle</div>
            <div className="mt-0.5 text-sm font-semibold">Ce qui peut rendre l’offre dangereuse</div>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="text-xs font-semibold">Point mort cumulé</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">Après intégration et coûts mensuels.</div>
              </div>
              <div className="text-sm font-bold tabular-nums">{analysis.breakEvenMonth ? `Mois ${analysis.breakEvenMonth}` : "Non atteint"}</div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="text-xs font-semibold">Premier mois déficitaire</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">Permet de voir si le pricing casse avec le scale.</div>
              </div>
              <div className="text-sm font-bold tabular-nums">{analysis.firstNegativeMonth ? `Mois ${analysis.firstNegativeMonth}` : "Aucun sur 36 mois"}</div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="text-xs font-semibold">Mois le plus faible</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">Contribution mensuelle minimale simulée.</div>
              </div>
              <div className="text-sm font-bold tabular-nums">M{analysis.worstMonth.month} · {euro(analysis.worstMonth.contribution)}</div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="text-xs font-semibold">Palier caution en M36</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{integer(finalMonth.cautionCount)} cautions estimées ce mois-là.</div>
              </div>
              <div className="text-sm font-bold tabular-nums">{pct(finalMonth.cautionRate)}</div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Synthèse annuelle</div>
            <div className="mt-0.5 text-sm font-semibold">Année 1 → Année 3</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-border bg-muted/20 text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-bold">Période</th>
                  <th className="px-4 py-3 font-bold">Volume paiement</th>
                  <th className="px-4 py-3 font-bold">Cautions</th>
                  <th className="px-4 py-3 font-bold">CA Gando</th>
                  <th className="px-4 py-3 font-bold">Coûts</th>
                  <th className="px-4 py-3 font-bold">Marge</th>
                  <th className="px-4 py-3 font-bold">Marge %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analysis.yearly.map(year => (
                  <tr key={year.year}>
                    <td className="px-4 py-3 font-semibold">Année {year.year}</td>
                    <td className="px-4 py-3 tabular-nums">{compactEuro(year.paymentVolume)}</td>
                    <td className="px-4 py-3 tabular-nums">{integer(year.cautionCount)}</td>
                    <td className="px-4 py-3 tabular-nums">{compactEuro(year.revenue)}</td>
                    <td className="px-4 py-3 tabular-nums">{compactEuro(year.totalCost)}</td>
                    <td className={`px-4 py-3 font-semibold tabular-nums ${year.contribution < 0 ? "text-destructive" : ""}`}>{compactEuro(year.contribution)}</td>
                    <td className="px-4 py-3 tabular-nums">{pct(year.marginRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
        Les valeurs de volume M1, croissance, panier et coûts d’intégration sont des hypothèses de simulation modifiables. Les tarifs préchargés reprennent la structure actuelle de l’offre Cityrent × Alizés × Simplycar. Le résultat affiché est une marge contributive de l’offre, avant salaires et coûts fixes généraux de Gando.
      </div>
    </div>
  )
}
