import { CompanyFirstProspectionView } from "@/components/company-first-prospection-view";
import { ProspectionView } from "@/components/prospection-view";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";

export const dynamic = "force-dynamic";

export default async function ProspectionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  if (params.mode === "contacts") return <ProspectionView />;

  // Keep the account qualification model self-healing: opening the Company-first
  // cockpit ensures every qualification field exists as a real HubSpot Company property.
  // A permission/configuration error must not make the whole sales cockpit unavailable.
  await ensureCompanyQualificationProperties().catch(error => {
    console.error("HubSpot qualification schema bootstrap:", error);
  });

  return <CompanyFirstProspectionView />;
}
