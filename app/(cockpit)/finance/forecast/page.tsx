import { redirect } from "next/navigation";
import { PageHeader } from "@/components/cockpit/page-header";
import { FinanceForecastDashboard } from "@/components/finance-forecast-dashboard";
import { FinanceSectionNav } from "@/components/finance-section-nav";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function FinanceForecastPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (access.role !== "admin") redirect("/");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Finance"
        title="Prévisionnel"
        description="Comparer le réel mensuel au scénario futur en partant du vrai CA, des coûts variables et des dépenses enregistrées."
      />
      <div className="mt-6">
        <FinanceSectionNav />
        <FinanceForecastDashboard />
      </div>
    </div>
  );
}
