import { ProspectionContactsDirectory } from "@/components/prospection-contacts-directory";
import { PostCallFollowupQueue } from "@/components/post-call-followup-queue";
import { getHubSpotIdentity, isAuthBypassEnabled } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const bypass = isAuthBypassEnabled();
  const identity = bypass ? null : await getHubSpotIdentity().catch(() => null);

  return (
    <>
      <ProspectionContactsDirectory />
      <PostCallFollowupQueue senderName={identity?.email || undefined} />
    </>
  );
}
