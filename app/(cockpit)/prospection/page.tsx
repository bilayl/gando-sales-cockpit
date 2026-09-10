import { CompanyFirstProspectionView } from "@/components/company-first-prospection-view";
import { PostCallFollowupQueue } from "@/components/post-call-followup-queue";
import { getHubSpotIdentity, isAuthBypassEnabled } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";

export const dynamic = "force-dynamic";

export default async function ProspectionPage() {
  const bypass = isAuthBypassEnabled();
  const identity = bypass ? null : await getHubSpotIdentity().catch(() => null);

  // La prospection Gando est account-first : une entreprise est le prospect commercial.
  // Les contacts restent des personnes rattachees a cette entreprise et ne constituent
  // plus un pipeline de leads parallele.
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
