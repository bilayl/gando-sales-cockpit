import { redirect } from "next/navigation";
import { CompanyFirstProspectionView } from "@/components/company-first-prospection-view";
import { PostCallFollowupQueue } from "@/components/post-call-followup-queue";
import { getHubSpotIdentity, isAuthBypassEnabled } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";

export const dynamic = "force-dynamic";

export default async function ProspectionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  if (params.mode === "contacts") redirect("/contacts");

  const bypass = isAuthBypassEnabled();
  const identity = bypass ? null : await getHubSpotIdentity().catch(() => null);

  await ensureCompanyQualificationProperties().catch(error => {
    console.error("HubSpot qualification schema bootstrap:", error);
  });

  return (
    <>
      <CompanyFirstProspectionView />
      <PostCallFollowupQueue senderName={identity?.email || undefined} />
    </>
  );
}
