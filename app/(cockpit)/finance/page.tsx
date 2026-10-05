import { redirect } from "next/navigation";
import { PageHeader } from "@/components/cockpit/page-header";
import { FinancePlanningDashboard } from "@/components/finance-planning-dashboard";
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
        title="Finance & Prévisionnel"
        description="Piloter la trésorerie, le cash-flow, les investissements et le recrutement à partir des données réelles de Gando."
      />
      <div className="mt-8">
        <FinancePlanningDashboard />
      </div>
    </div>
  );
}
