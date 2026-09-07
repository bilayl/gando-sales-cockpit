import { AttioCompanyRecordPage } from "@/components/attio-company-record-page";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AttioCompanyRecordPage recordId={id} />;
}
