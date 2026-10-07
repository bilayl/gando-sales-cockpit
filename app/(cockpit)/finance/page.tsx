import { redirect } from "next/navigation";
import { PageHeader } from "@/components/cockpit/page-header";
import { FinancePlanningDashboard } from "@/components/finance-planning-dashboard";
import { FinanceProfitabilityDashboard } from "@/components/finance-profitability-dashboard";
import { KpiCostControl } from "@/components/kpi-cost-control";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (access.role !== "admin") redirect("/");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Finance"
        title="Finance & Rentabilité"
        description="Suivre les dépenses mois par mois, mesurer le résultat réel et savoir exactement quel niveau de chiffre d’affaires Gando doit atteindre pour devenir rentable."
      />

      <div className="mt-8 space-y-6">
        <FinanceProfitabilityDashboard />

        <section id="monthly-expenses" className="scroll-mt-24">
          <KpiCostControl canEdit />
        </section>

        <FinancePlanningDashboard />
      </div>
    </div>
  );
}
