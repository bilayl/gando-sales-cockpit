import { ProspectionContactsDirectory } from "@/components/prospection-contacts-directory";
import { PostCallFollowupQueue } from "@/components/post-call-followup-queue";
import { getHubSpotIdentity, isAuthBypassEnabled } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const bypass = isAuthBypassEnabled();
  const identity = bypass ? null : await getHubSpotIdentity().catch(() => null);

  return (
    <>
      <div className="h-[calc(100svh-3rem)] min-h-0 min-w-0 overflow-hidden"><ProspectionContactsDirectory /></div>
      <PostCallFollowupQueue senderName={identity?.email || undefined} />
    </>
  );
}
