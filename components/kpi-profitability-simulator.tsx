"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

const GANDO_CAUTION_RATE = 0.029
const PSP_PAYMENT_RATE = 0.016
const PSP_FIXED_FEE = 0.35

function euro(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function pct(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

type FieldProps = {
  label: string
  value: number
  suffix: string
  step?: number
  min?: number
  onChange: (value: number) => void
}

function Field({ label, value, suffix, step = 1, min = 0, onChange }: FieldProps) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div className="flex h-10 items-center rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/20">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(numberValue(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums outline-none"
        />
        <span className="ml-2 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </label>
  )
}

export function KpiProfitabilitySimulator() {
  const [cautionAmount, setCautionAmount] = useState(1000)
  const [paymentAmount, setPaymentAmount] = useState(500)
  const [monthlyTransactions, setMonthlyTransactions] = useState(100)
  const [netLossRate, setNetLossRate] = useState(1.7)
  const [paymentBilledRate, setPaymentBilledRate] = useState(0)
  const [paymentBilledFixed, setPaymentBilledFixed] = useState(0)

  const economics = useMemo(() => {
    const cautionRevenue = cautionAmount * GANDO_CAUTION_RATE
    const paymentRevenue = paymentAmount * (paymentBilledRate / 100) + paymentBilledFixed
    const pspCost = paymentAmount * PSP_PAYMENT_RATE + PSP_FIXED_FEE
    const expectedLoss = cautionAmount * (netLossRate / 100)
    const contribution = cautionRevenue + paymentRevenue - pspCost - expectedLoss
    const monthlyContribution = contribution * monthlyTransactions

    const breakEvenLossRate =
      cautionAmount > 0
        ? Math.max(0, (cautionRevenue + paymentRevenue - pspCost) / cautionAmount)
        : 0

    const contributionYield = cautionAmount > 0 ? contribution / cautionAmount : 0
    const lossRateCushion = breakEvenLossRate - netLossRate / 100

    const paymentMarginRate = paymentBilledRate / 100 - PSP_PAYMENT_RATE
    const fixedPaymentMargin = paymentBilledFixed - PSP_FIXED_FEE
    const cautionMarginBeforePayment =
      cautionAmount * (GANDO_CAUTION_RATE - netLossRate / 100)

    let maxPaymentBeforeLoss: number | null = null
    if (paymentMarginRate < 0) {
      maxPaymentBeforeLoss = Math.max(
        0,
        (cautionMarginBeforePayment + fixedPaymentMargin) / Math.abs(paymentMarginRate),
      )
    }

    return {
      cautionRevenue,
      paymentRevenue,
      pspCost,
      expectedLoss,
      contribution,
      monthlyContribution,
      breakEvenLossRate,
      contributionYield,
      lossRateCushion,
      maxPaymentBeforeLoss,
    }
  }, [
    cautionAmount,
    paymentAmount,
    monthlyTransactions,
    netLossRate,
    paymentBilledRate,
    paymentBilledFixed,
  ])

  const profitable = economics.contribution > 0
  const closeToBreakEven =
    profitable &&
    economics.lossRateCushion <= 0.003

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
            Rentabilité de l’offre · simulateur rapide
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            Est-ce que chaque réservation Gando gagne réellement de l’argent ?
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Prix caution : 2,9 % HT · coût paiement : 1,6 % + 0,35 € HT
          </div>
        </div>
        <Badge
          variant={profitable ? "secondary" : "destructive"}
          className="h-6 text-[10px]"
        >
          {profitable ? (closeToBreakEven ? "Rentable mais fragile" : "Rentable") : "Déficitaire"}
        </Badge>
      </div>

      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Caution moyenne" value={cautionAmount} suffix="€" step={50} onChange={setCautionAmount} />
        <Field label="Paiement moyen location" value={paymentAmount} suffix="€" step={25} onChange={setPaymentAmount} />
        <Field label="Réservations / mois" value={monthlyTransactions} suffix="résa." step={10} onChange={setMonthlyTransactions} />
        <Field label="Loss rate net attendu" value={netLossRate} suffix="%" step={0.1} onChange={setNetLossRate} />
        <Field label="Paiement refacturé" value={paymentBilledRate} suffix="%" step={0.1} onChange={setPaymentBilledRate} />
        <Field label="Fixe paiement refacturé" value={paymentBilledFixed} suffix="€" step={0.05} onChange={setPaymentBilledFixed} />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        <div className="px-4 py-4">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">CA caution Gando</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{euro(economics.cautionRevenue)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">2,9 % de {euro(cautionAmount, 0)}</div>
        </div>
        <div className="border-t border-border px-4 py-4 sm:border-l sm:border-t-0">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Coût PSP paiement</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">− {euro(economics.pspCost)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">1,6 % + 0,35 € sur {euro(paymentAmount, 0)}</div>
        </div>
        <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Perte attendue</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">− {euro(economics.expectedLoss)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">{netLossRate.toLocaleString("fr-FR")} % de la caution</div>
        </div>
        <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Marge / réservation</div>
          <div className={`mt-2 text-xl font-semibold tabular-nums ${profitable ? "text-foreground" : "text-destructive"}`}>
            {euro(economics.contribution)}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {pct(economics.contributionYield)} du montant de caution
          </div>
        </div>
      </div>

      <div className="grid border-t border-border lg:grid-cols-3">
        <div className="px-4 py-4">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Contribution mensuelle</div>
          <div className="mt-2 text-[22px] font-semibold tabular-nums">{euro(economics.monthlyContribution, 0)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">Avant coûts fixes, salaires et structure.</div>
        </div>

        <div className="border-t border-border px-4 py-4 lg:border-l lg:border-t-0">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Loss rate maximum supportable</div>
          <div className="mt-2 text-[22px] font-semibold tabular-nums">{pct(economics.breakEvenLossRate)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Ton KPI principal : rester en dessous de ce seuil après recouvrement.
          </div>
        </div>

        <div className="border-t border-border px-4 py-4 lg:border-l lg:border-t-0">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Paiement moyen max rentable</div>
          <div className="mt-2 text-[22px] font-semibold tabular-nums">
            {economics.maxPaymentBeforeLoss == null ? "Pas de plafond PSP" : euro(economics.maxPaymentBeforeLoss, 0)}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            À caution et loss rate constants, avant autres coûts variables.
          </div>
        </div>
      </div>

      <div className={`border-t border-border px-4 py-3 text-xs ${profitable ? "bg-muted/10" : "bg-destructive/5 text-destructive"}`}>
        <span className="font-bold">
          {profitable ? "Lecture :" : "Alerte :"}
        </span>{" "}
        {profitable
          ? `tu génères actuellement ${euro(economics.contribution)} de marge contributive par réservation dans ce scénario. Ton coussin de risque est de ${pct(Math.max(0, economics.lossRateCushion))} avant le point mort.`
          : `avec ces hypothèses, chaque réservation détruit ${euro(Math.abs(economics.contribution))}. Il faut augmenter le revenu, réduire le coût paiement, réduire le loss rate net ou augmenter le ratio caution / paiement.`}
      </div>
    </Card>
  )
}
