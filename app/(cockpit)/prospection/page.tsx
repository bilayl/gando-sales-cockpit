import { CompanyFirstProspectionView } from "@/components/company-first-prospection-view";
import { PostCallFollowupQueue } from "@/components/post-call-followup-queue";
import { ProspectionContactsDirectory } from "@/components/prospection-contacts-directory";
import { getHubSpotIdentity, isAuthBypassEnabled } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";

export const dynamic = "force-dynamic";

export default async function ProspectionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const bypass = isAuthBypassEnabled();
  const identity = bypass ? null : await getHubSpotIdentity().catch(() => null);
  const followup = <PostCallFollowupQueue senderName={identity?.email || undefined} />;

  if (params.mode === "contacts") {
    return <><ProspectionContactsDirectory />{followup}</>;
  }

  // La prospection Gando est account-first : une entreprise est le prospect commercial.
  // Les contacts restent accessibles dans Prospection comme répertoire de personnes
  // rattachées aux comptes, sans recréer un pipeline de leads parallèle.
  await ensureCompanyQualificationProperties().catch(error => {
    console.error("HubSpot qualification schema bootstrap:", error);
  });

  return <><CompanyFirstProspectionView />{followup}</>;
}
