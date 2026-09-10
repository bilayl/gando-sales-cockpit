import { DirectProspectionSession } from "@/components/direct-prospection-session";

export const dynamic = "force-dynamic";

export default async function DirectSessionPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return <DirectProspectionSession companyId={companyId} />;
}
