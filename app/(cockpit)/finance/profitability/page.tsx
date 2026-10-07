import { redirect } from "next/navigation";
import { PageHeader } from "@/components/cockpit/page-header";
import { FinanceProfitabilityDashboard } from "@/components/finance-profitability-dashboard";
import { FinanceSectionNav } from "@/components/finance-section-nav";
import { KpiCostControl } from "@/components/kpi-cost-control";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function FinanceProfitabilityPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (access.role !== "admin") redirect("/");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Finance"
        title="Rentabilité"
        description="Comprendre le point mort de Gando, suivre le résultat mensuel et savoir quel chiffre d’affaires doit être généré."
      />
      <div className="mt-6">
        <FinanceSectionNav />
        <div className="space-y-6">
          <FinanceProfitabilityDashboard />
          <KpiCostControl canEdit />
        </div>
      </div>
    </div>
  );
}
