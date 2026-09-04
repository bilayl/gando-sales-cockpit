"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, BadgeEuro, CircleGauge, DatabaseZap, ShieldCheck, Target, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type KpiSystem = {
  period: { year: number; monthNumber: number } | null
  northStar: {
    depositsActivated: number | null
    depositsDelta: number | null
    activeRenters: number | null
    activeRentersDelta: number | null
    depositsPerMau: number | null
    tdv: number | null
  }
  acquisition: {
    acquisitionCost: number
    prospectsContacted: number | null
    meetings: number | null
    firstDepositRenters: number | null
    cacActivation: number | null
    cacMau30: number | null
    cohortName: string | null
  }
  activation: {
    rentersRegistered: number | null
    firstDepositRenters: number | null
    activationRate: number | null
    avgClosingDays: number | null
  }
  retention: {
    firstDepositRenters: number | null
    mau30Renters: number | null
    mau30Rate: number | null
    cohortName: string | null
  }
  economics: {
    revenue: number | null
    netMargin: number | null
    marginRate: number | null
    marginPerMau: number | null
    marginPerDeposit: number | null
    takeRate: number | null
    cacPaybackMonths: number | null
  }
  risk: {
    claimsCount: number | null
    claimRate: number | null
    cashoutAmount: number | null
    advancedGuarantee: number | null
    lossRate: number | null
    lossRateAvailable: boolean
  }
  quality: {
    automatic: string[]
    cohort: string[]
    missing: string[]
  }
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value)
}
function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}
function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value)
}
function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}
function delta(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Pas de comparaison"
  const sign = value > 0 ? "+" : ""
  return `${sign}${percent(value)} vs mois précédent`
}

const dictionary = [
  ["Cautions activées", "North Star", "Nombre de cautions réellement activées sur la période.", "COUNT(cautions activées)"],
  ["MAU loueurs", "Usage", "Loueurs ayant au moins une caution activée sur la période de référence.", "COUNT DISTINCT(loueur actif)"],
  ["Cautions / MAU", "Usage", "Fréquence moyenne d’utilisation de Gando par loueur actif.", "Cautions activées / MAU"],
  ["CAC activation", "Acquisition", "Coût nécessaire pour obtenir un loueur ayant activé sa première caution.", "Coûts acquisition / 1res cautions"],
  ["CAC MAU J+30", "Acquisition", "Coût d’acquisition par loueur d’une cohorte encore actif à J+30.", "Coût cohorte / MAU J+30"],
  ["Activation rate", "Activation", "Part des nouveaux loueurs inscrits atteignant une première caution.", "1res cautions / inscrits"],
  ["Retention J+30", "Rétention", "Part des loueurs activés d’une cohorte encore actifs à J+30.", "MAU J+30 / activés cohorte"],
  ["Marge / MAU", "Economics", "Marge nette moyenne générée par un loueur actif.", "Marge nette / MAU"],
  ["Marge / caution", "Economics", "Marge nette moyenne générée par une caution activée.", "Marge nette / cautions"],
  ["Take rate", "Economics", "Part du volume sécurisé transformée en revenu Gando.", "CA / TDV"],
  ["CAC payback", "Economics", "Nombre de mois de marge nécessaires pour rembourser le CAC MAU.", "CAC MAU / marge 30j par MAU"],
  ["Loss rate", "Risque", "Part du volume définitivement perdue après encaissement et recouvrement.", "Pertes définitives / volume exposé"],
] as const

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{label}</div>
      <div className="mt-2 text-[24px] font-semibold tracking-[-0.035em] tabular-nums">{value}</div>
      <div className="mt-1.5 text-[10px] font-medium text-muted-foreground">{detail}</div>
    </div>
  )
}

function Driver({ title, icon: Icon, children }: { title: string; icon: typeof Target; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
        <Icon className="size-4 text-primary" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  )
}

function Line({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-foreground">{label}</div>
        {detail ? <div className="mt-0.5 text-[9px] leading-4 text-muted-foreground">{detail}</div> : null}
      </div>
      <div className="shrink-0 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function KpiSystemDashboard() {
  const [data, setData] = useState<KpiSystem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/system", { cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Impossible de calculer les KPI.")
        setData(body)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de calculer les KPI.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const coverage = useMemo(() => {
    if (!data) return { ready: 0, cohort: 0, missing: 0, total: 0 }
    const ready = data.quality.automatic.length
    const cohort = data.quality.cohort.length
    const missing = data.quality.missing.length
    return { ready, cohort, missing, total: ready + cohort + missing }
  }, [data])

  if (loading) return <Skeleton className="h-[760px] w-full rounded-xl" />
  if (error || !data) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error || "Données indisponibles."}</div>

  const period = data.period ? `${MONTHS[data.period.monthNumber - 1]} ${data.period.year}` : "Période non renseignée"

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">KPI Operating System</div>
            <div className="mt-0.5 text-sm font-semibold">Une seule lecture : acquisition → activation → rétention → usage → économie → risque</div>
          </div>
          <Badge variant="secondary" className="text-[10px]">{period}</Badge>
        </div>

        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-6">
          <Metric label="North Star" value={integer(data.northStar.depositsActivated)} detail={delta(data.northStar.depositsDelta)} />
          <Metric label="MAU loueurs" value={integer(data.northStar.activeRenters)} detail={delta(data.northStar.activeRentersDelta)} />
          <Metric label="Cautions / MAU" value={decimal(data.northStar.depositsPerMau)} detail="Intensité d’usage" />
          <Metric label="CAC MAU J+30" value={euro(data.acquisition.cacMau30)} detail={data.acquisition.cohortName || "Cohorte à renseigner"} />
          <Metric label="Retention J+30" value={percent(data.retention.mau30Rate)} detail={data.retention.cohortName || "Cohorte à renseigner"} />
          <Metric label="Marge / MAU" value={euro(data.economics.marginPerMau, 1)} detail={`Marge totale ${euro(data.economics.netMargin)}`} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Driver title="Acquisition" icon={Target}>
          <Line label="Coût acquisition" value={euro(data.acquisition.acquisitionCost)} detail="Paid + sales + outils + agence + créa + autres" />
          <Line label="CAC activation" value={euro(data.acquisition.cacActivation)} detail="Coût / loueurs avec 1re caution" />
          <Line label="CAC MAU J+30" value={euro(data.acquisition.cacMau30)} detail="Mesuré par cohorte" />
        </Driver>

        <Driver title="Activation" icon={CircleGauge}>
          <Line label="Loueurs inscrits" value={integer(data.activation.rentersRegistered)} />
          <Line label="1re caution" value={integer(data.activation.firstDepositRenters)} />
          <Line label="Activation rate" value={percent(data.activation.activationRate)} detail="1re caution / inscrits" />
        </Driver>

        <Driver title="Rétention" icon={UsersRound}>
          <Line label="Loueurs activés cohorte" value={integer(data.retention.firstDepositRenters)} />
          <Line label="MAU J+30" value={integer(data.retention.mau30Renters)} />
          <Line label="Retention J+30" value={percent(data.retention.mau30Rate)} detail={data.retention.cohortName || "Aucune cohorte mature"} />
        </Driver>

        <Driver title="Usage" icon={Activity}>
          <Line label="Cautions activées" value={integer(data.northStar.depositsActivated)} />
          <Line label="MAU loueurs" value={integer(data.northStar.activeRenters)} />
          <Line label="Cautions / MAU" value={decimal(data.northStar.depositsPerMau)} detail="Cautions activées / loueurs actifs" />
        </Driver>

        <Driver title="Unit economics" icon={BadgeEuro}>
          <Line label="Take rate" value={percent(data.economics.takeRate)} detail={`${euro(data.economics.revenue)} CA / ${euro(data.northStar.tdv)} TDV`} />
          <Line label="Marge / caution" value={euro(data.economics.marginPerDeposit, 1)} />
          <Line label="CAC payback" value={data.economics.cacPaybackMonths == null ? "—" : `${decimal(data.economics.cacPaybackMonths)} mois`} detail="Basé sur la cohorte J+30" />
        </Driver>

        <Driver title="Risque" icon={ShieldCheck}>
          <Line label="Demandes d’encaissement" value={integer(data.risk.claimsCount)} />
          <Line label="Taux de demande" value={percent(data.risk.claimRate)} detail="Demandes / cautions activées" />
          <Line label="Loss rate" value={data.risk.lossRateAvailable ? percent(data.risk.lossRate) : "Donnée manquante"} detail="Nécessite les pertes définitives après recouvrement" />
        </Driver>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <DatabaseZap className="size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Qualité de la donnée</div>
              <div className="text-[10px] text-muted-foreground">Le Cockpit doit savoir ce qu’il sait réellement.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-[9px]">{coverage.ready} automatiques</Badge>
            <Badge variant="outline" className="text-[9px]">{coverage.cohort} cohortes</Badge>
            <Badge variant="destructive" className="text-[9px]">{coverage.missing} manquants</Badge>
          </div>
        </div>
        <div className="grid gap-px bg-border lg:grid-cols-3">
          {[
            ["Calculés", data.quality.automatic, "bg-card"],
            ["Calculés par cohorte", data.quality.cohort, "bg-card"],
            ["À connecter", data.quality.missing, "bg-card"],
          ].map(([title, items, className]) => (
            <div key={String(title)} className={String(className) + " p-4"}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{String(title)}</div>
              <div className="space-y-1.5">
                {(items as string[]).length ? (items as string[]).map(item => <div key={item} className="text-[11px] font-medium">• {item}</div>) : <div className="text-[11px] text-muted-foreground">Aucun pour le moment.</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">KPI Dictionary</div>
          <div className="mt-0.5 text-sm font-semibold">Définitions officielles Gando</div>
          <div className="mt-1 text-[10px] text-muted-foreground">Une métrique = une définition et une formule uniques dans toute l’entreprise.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="border-b border-border bg-muted/20 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              <tr><th className="px-4 py-2.5">KPI</th><th className="px-4 py-2.5">Moteur</th><th className="px-4 py-2.5">Définition</th><th className="px-4 py-2.5">Formule</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dictionary.map(([name, engine, definition, formula]) => (
                <tr key={name}>
                  <td className="px-4 py-3 text-[11px] font-semibold">{name}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-[9px]">{engine}</Badge></td>
                  <td className="max-w-[420px] px-4 py-3 text-[10px] leading-4 text-muted-foreground">{definition}</td>
                  <td className="px-4 py-3 text-[10px] font-medium tabular-nums">{formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
