import { redirect } from "next/navigation";
import { PageHeader } from "@/components/cockpit/page-header";
import { FinanceSectionNav } from "@/components/finance-section-nav";
import { FinanceTreasuryDashboard } from "@/components/finance-treasury-dashboard";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function FinanceTreasuryPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (access.role !== "admin") redirect("/");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Finance"
        title="Trésorerie"
        description="Piloter le cash, le burn, le runway, la réserve de sécurité et les capacités d’investissement."
      />
      <div className="mt-6">
        <FinanceSectionNav />
        <FinanceTreasuryDashboard />
      </div>
    </div>
  );
}
