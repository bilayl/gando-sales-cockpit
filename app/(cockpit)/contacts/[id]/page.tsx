import { CRMRecordPage } from "@/components/crm-record-page";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="crm-record-white-scope">
      <CRMRecordPage kind="contact" recordId={id} />
    </div>
  );
}
