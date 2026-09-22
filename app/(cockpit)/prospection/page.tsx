import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CompanyFirstProspectionView } from "@/components/company-first-prospection-view";
import { PostCallFollowupQueue } from "@/components/post-call-followup-queue";
import { getHubSpotIdentity, isAuthBypassEnabled } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";

const ensureQualificationSchema = unstable_cache(
  async () => ensureCompanyQualificationProperties(),
  ["gando-company-qualification-schema"],
  { revalidate: 60 * 60 },
);

export const dynamic = "force-dynamic";

export default async function ProspectionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  if (params.mode === "contacts") redirect("/contacts");

  const bypass = isAuthBypassEnabled();
  const identity = bypass ? null : await getHubSpotIdentity().catch(() => null);

  await ensureQualificationSchema().catch(error => {
    console.error("HubSpot qualification schema bootstrap:", error);
  });

  return (
    <>
      <div className="h-[calc(100svh-3rem)] min-h-0 min-w-0 overflow-hidden">
        <CompanyFirstProspectionView />
      </div>
      <PostCallFollowupQueue senderName={identity?.email || undefined} />
    </>
  );
}
