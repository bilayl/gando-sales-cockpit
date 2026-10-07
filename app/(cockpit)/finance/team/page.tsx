import { redirect } from "next/navigation";
import { PageHeader } from "@/components/cockpit/page-header";
import { FinanceSectionNav } from "@/components/finance-section-nav";
import { TeamEfficiencyDashboard } from "@/components/team-efficiency-dashboard";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function FinanceTeamPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (access.role !== "admin") redirect("/");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Finance"
        title="Équipe & rendement"
        description="Mesurer le coût complet d’un recrutement et convertir ce coût en objectifs de contribution, d’opportunités et de deals."
      />
      <div className="mt-6">
        <FinanceSectionNav />
        <TeamEfficiencyDashboard />
      </div>
    </div>
  );
}
