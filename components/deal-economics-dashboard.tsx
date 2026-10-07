"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeEuro, BriefcaseBusiness, Calculator, CircleAlert, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DealEconomics = {
  id: string;
  companyName: string;
  title: string;
  stage: string;
  status: string;
  enabled: boolean;
  source: "dealroom" | "live" | "dealroom+live";
  basis: string;
  monthlyDeposits: number;
  averageDepositAmount: number;
  gandoRatePercent: number;
  partnerMarginPercent: number;
  monthlySecuredVolume: number;
  monthlyGrossRevenue: number;
  monthlyInsuranceCost: number;
  monthlyPartnerCost: number;
  monthlyPspCost: number;
  monthlyContribution: number;
  annualGrossRevenue: number;
  annualRecurringContribution: number;
  annualContribution: number;
  contributionMargin: number | null;
  probability: number;
  weightedAnnualContribution: number;
  oneTimeCost: number;
  actualMonthlyDeposits: number | null;
  actualMonthlySecuredVolume: number | null;
  actualMonthlyGrossRevenue: number | null;
  actualMonthlyContribution: number | null;
};

type DealEconomicsPayload = {
  assumptions: {
    insuranceRate: number;
    pspRate: number;
    pspFixedEur: number;
  };
  summary: {
    activeDeals: number;
    liveDeals: number;
    pipelineAnnualGrossRevenue: number;
    pipelineAnnualContribution: number;
    weightedPipelineContribution: number;
    averageAnnualContribution: number;
  };
  deals: DealEconomics[];
};

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(value);
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value);
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    SD01: "Qualification",
    SD02: "Plan / intégration",
    SD03: "Solution",
    SD04: "Proposition",
    SD05: "Contrat",
    LIVE: "Live",
  };
  return labels[stage] || stage;
}

export function DealEconomicsDashboard() {
  const [data, setData] = useState<DealEconomicsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/deal-economics", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Impossible de charger la valeur des deals.");
        setData(body);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger la valeur des deals.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const deals = useMemo(
    () => [...(data?.deals || [])].sort((a, b) => b.annualContribution - a.annualContribution),
    [data],
  );

  const topDeal = deals.find(deal => deal.enabled) || deals[0] || null;

  if (loading) return <Skeleton className="h-[640px] w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-primary/[0.025] px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <BriefcaseBusiness className="size-3.5" /> Valeur économique des deals
            </div>
            <h2 className="mt-1 text-lg font-bold">Combien chaque deal peut réellement rapporter à Gando</h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
              Le calcul combine les dealrooms, les propositions/contrats et le run-rate réel des comptes Gando. Un client live n’est donc plus invisible s’il n’a pas de SD01 complet.
            </p>
          </div>
          <Badge variant="secondary" className="text-[9px]">
            {data?.summary.activeDeals || 0} deals · {data?.summary.liveDeals || 0} live · assurance {percent(data?.assumptions.insuranceRate, 2)}
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["CA pipeline annuel", euro(data?.summary.pipelineAnnualGrossRevenue), "Avant coûts variables"],
            ["Contribution annuelle", euro(data?.summary.pipelineAnnualContribution), "Après assurance + paiement"],
            ["Pipeline pondéré", euro(data?.summary.weightedPipelineContribution), "Selon l’avancement commercial"],
            ["Deal moyen", euro(data?.summary.averageAnnualContribution), "Contribution annuelle moyenne"],
            ["Meilleur deal", topDeal?.companyName || "—", topDeal ? euro(topDeal.annualContribution) + " / an" : "Aucune estimation"],
          ].map(([label, value, helper]) => (
            <div key={label} className="border-border px-4 py-4 sm:border-l first:sm:border-l-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] tabular-nums">{value}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{helper}</div>
            </div>
          ))}
        </div>
      </Card>

      {topDeal ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BadgeEuro className="size-4 text-primary" />
              <div>
                <div className="text-sm font-semibold">{topDeal.companyName} · lecture du deal</div>
                <div className="text-[10px] text-muted-foreground">
                  {topDeal.basis} · assurance {percent(data?.assumptions.insuranceRate, 2)}.
                </div>
              </div>
            </div>
            <Badge variant="outline">{stageLabel(topDeal.stage)}</Badge>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-6">
            <DealMetric label="Cautions / mois" value={integer(topDeal.monthlyDeposits)} detail="Hypothèse de volume" />
            <DealMetric label="Caution moyenne" value={euro(topDeal.averageDepositAmount)} detail="Montant sécurisé" />
            <DealMetric label="Volume sécurisé / mois" value={euro(topDeal.monthlySecuredVolume)} detail="Base économique" />
            <DealMetric label="CA Gando / mois" value={euro(topDeal.monthlyGrossRevenue)} detail={topDeal.gandoRatePercent.toFixed(2) + " % HT"} />
            <DealMetric label="Contribution / mois" value={euro(topDeal.monthlyContribution)} detail={percent(topDeal.contributionMargin)} />
            <DealMetric label="Contribution / an" value={euro(topDeal.annualContribution)} detail={topDeal.oneTimeCost > 0 ? "Année 1 après " + euro(topDeal.oneTimeCost) + " de coût de lancement" : percent(topDeal.probability) + " de probabilité actuelle"} />
          </div>

          <div className="grid border-t border-border bg-muted/10 sm:grid-cols-3">
            <DealMetric label="Assurance estimée / mois" value={euro(topDeal.monthlyInsuranceCost)} detail={percent(data?.assumptions.insuranceRate, 2)} />
            <DealMetric label="Paiement + partenaire / mois" value={euro(topDeal.monthlyPspCost + topDeal.monthlyPartnerCost)} detail={(data?.assumptions.pspRate ? percent(data.assumptions.pspRate) : "—") + " + " + euro(data?.assumptions.pspFixedEur, 2) + "/transaction"} />
            <DealMetric label="Valeur pipeline pondérée" value={euro(topDeal.weightedAnnualContribution)} detail={topDeal.stage === "LIVE" ? "Client déjà actif" : "Contribution année 1 × probabilité du stage"} />
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <TrendingUp className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Tous les deals chiffrés</div>
            <div className="text-[10px] text-muted-foreground">
              Ce tableau devient la base du forecast commercial et des objectifs d’équipe.
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Cautions/mois</TableHead>
                <TableHead className="text-right">Volume sécurisé</TableHead>
                <TableHead className="text-right">CA/mois</TableHead>
                <TableHead className="text-right">Contribution/mois</TableHead>
                <TableHead className="text-right">Contribution/an</TableHead>
                <TableHead className="text-right">Réel CA/mois</TableHead>
                <TableHead className="text-right">Pondéré</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.length ? deals.map(deal => (
                <TableRow key={deal.id} className={!deal.enabled ? "opacity-55" : ""}>
                  <TableCell>
                    <div className="font-semibold">{deal.companyName}</div>
                    <div className="text-[9px] text-muted-foreground">
                      {deal.gandoRatePercent.toFixed(2)} % Gando · caution moyenne {euro(deal.averageDepositAmount)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] text-[9px] leading-4 text-muted-foreground">{deal.basis}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px]">{stageLabel(deal.stage)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{integer(deal.monthlyDeposits)}</TableCell>
                  <TableCell className="text-right">{euro(deal.monthlySecuredVolume)}</TableCell>
                  <TableCell className="text-right">{euro(deal.monthlyGrossRevenue)}</TableCell>
                  <TableCell className="text-right font-semibold">{euro(deal.monthlyContribution)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {euro(deal.annualContribution)}
                    {deal.oneTimeCost > 0 ? <div className="text-[9px] font-normal text-muted-foreground">- {euro(deal.oneTimeCost)} lancement</div> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {deal.actualMonthlyGrossRevenue != null ? (
                      <div>
                        <div className="font-semibold">{euro(deal.actualMonthlyGrossRevenue)}</div>
                        <div className="text-[9px] text-muted-foreground">{integer(deal.actualMonthlyDeposits)} cautions / 30 j</div>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{euro(deal.weightedAnnualContribution)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-xs text-muted-foreground">
                    Aucun dealroom ne contient encore assez de données pour calculer sa valeur.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>
          La contribution deal retire l’assurance à 1,14 %, les coûts partenaire connus et une estimation PSP. Les coûts de structure restent dans la page Rentabilité. Pour les clients live comme LR Location, le run-rate réel Gando des 30 derniers jours est utilisé ; pour Atlantis, la proposition/contrat complète le dealroom.
        </span>
      </div>
    </div>
  );
}

function DealMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-border px-4 py-4 sm:border-l first:sm:border-l-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}
