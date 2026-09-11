import { CompanyLocationEditor } from "@/components/company-location-editor";
import { CRMRecordPage } from "@/components/crm-record-page";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="crm-record-white-scope">
      <CompanyLocationEditor recordId={id} />
      <CRMRecordPage kind="company" recordId={id} />
    </div>
  );
}
