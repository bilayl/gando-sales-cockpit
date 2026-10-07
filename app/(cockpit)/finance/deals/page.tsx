import { redirect } from "next/navigation";
import { PageHeader } from "@/components/cockpit/page-header";
import { DealEconomicsDashboard } from "@/components/deal-economics-dashboard";
import { FinanceSectionNav } from "@/components/finance-section-nav";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function FinanceDealsPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (access.role !== "admin") redirect("/");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Finance"
        title="Valeur des deals"
        description="Transformer les volumes commerciaux des dealrooms en chiffre d’affaires, contribution et valeur de pipeline."
      />
      <div className="mt-6">
        <FinanceSectionNav />
        <DealEconomicsDashboard />
      </div>
    </div>
  );
}
