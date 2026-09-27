import { redirect } from "next/navigation";
import { KpiOfferAnalysis } from "@/components/kpi-offer-analysis";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiOfferAnalysisPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Analyse offre"
      description="Teste une proposition commerciale sur 36 mois pour vérifier sa rentabilité, son point mort et sa solidité quand les volumes augmentent."
    >
      <KpiOfferAnalysis />
    </KpiPageShell>
  );
}
