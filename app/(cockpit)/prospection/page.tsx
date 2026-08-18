import { CompanyFirstProspectionView } from "@/components/company-first-prospection-view";
import { ProspectionView } from "@/components/prospection-view";

export default async function ProspectionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  return params.mode === "contacts" ? <ProspectionView /> : <CompanyFirstProspectionView />;
}
