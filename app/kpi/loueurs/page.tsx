import { redirect } from "next/navigation";
import { KpiRenterGuaranteeBalance } from "@/components/kpi-renter-guarantee-balance";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiLoueursGuaranteesPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");
  return (
    <KpiPageShell
      role={access.role}
      title="Loueurs & garanties"
      description="Comparer, loueur par loueur, les revenus des frais de sécurisation, les garanties acceptées et les créances confirmées restant à encaisser."
    >
      <KpiRenterGuaranteeBalance />
    </KpiPageShell>
  );
}
