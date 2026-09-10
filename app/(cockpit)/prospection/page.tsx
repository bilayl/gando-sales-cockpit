import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { CompanyFirstProspectionView } from "@/components/company-first-prospection-view";
import { PostCallFollowupQueue } from "@/components/post-call-followup-queue";
import { ProspectionContactsDirectory } from "@/components/prospection-contacts-directory";
import { getHubSpotIdentity, isAuthBypassEnabled } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";

export const dynamic = "force-dynamic";

export default async function ProspectionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const contactsMode = params.mode === "contacts";
  const bypass = isAuthBypassEnabled();
  const identity = bypass ? null : await getHubSpotIdentity().catch(() => null);

  if (!contactsMode) {
    // La prospection Gando est account-first : une entreprise est le prospect commercial.
    // Les contacts restent accessibles dans la même rubrique comme répertoire de personnes
    // rattachées aux comptes, sans recréer un pipeline de leads parallèle.
    await ensureCompanyQualificationProperties().catch(error => {
      console.error("HubSpot qualification schema bootstrap:", error);
    });
  }

  return (
    <>
      <div className="flex h-screen min-h-0 flex-col overflow-hidden">
        <nav className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-5 py-2 lg:px-7" aria-label="Type de données de prospection">
          <Link
            href="/prospection"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${!contactsMode ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <Building2 size={14} /> Entreprises
          </Link>
          <Link
            href="/prospection?mode=contacts"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${contactsMode ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <Users size={14} /> Contacts
          </Link>
          <span className="ml-2 hidden text-[11px] text-muted-foreground md:inline">Entreprise = prospect · Contact = personne à joindre</span>
        </nav>

        <div className="min-h-0 flex-1 overflow-hidden [&>.page-shell]:!h-full">
          {contactsMode ? <ProspectionContactsDirectory /> : <CompanyFirstProspectionView />}
        </div>
      </div>
      <PostCallFollowupQueue senderName={identity?.email || undefined} />
    </>
  );
}
