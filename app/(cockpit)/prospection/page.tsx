import { CompanyFirstProspectionView } from "@/components/company-first-prospection-view";
import { ContactFirstProspectionView } from "@/components/contact-first-prospection-view";
import { PostCallFollowupQueue } from "@/components/post-call-followup-queue";
import { getHubSpotIdentity, isAuthBypassEnabled } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";

export const dynamic = "force-dynamic";

export default async function ProspectionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const bypass = isAuthBypassEnabled();
  const identity = bypass ? null : await getHubSpotIdentity().catch(() => null);
  const followup = <PostCallFollowupQueue senderName={identity?.email || undefined} />;

  if (params.mode === "contacts") {
    return <><ContactFirstProspectionView />{followup}</>;
  }

  // Keep the account qualification model self-healing: opening the Company-first
  // cockpit ensures every qualification field exists as a real HubSpot Company property.
  // A permission/configuration error must not make the whole sales cockpit unavailable.
  await ensureCompanyQualificationProperties().catch(error => {
    console.error("HubSpot qualification schema bootstrap:", error);
  });

  return <><CompanyFirstProspectionView />{followup}</>;
}
