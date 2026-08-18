import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { getHubSpotIdentity, isHubSpotAuthenticated } from "@/lib/hubspot";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  if (!(await isHubSpotAuthenticated())) redirect("/login");
  const identity = await getHubSpotIdentity();
  const accountLabel = identity?.mode === "oauth"
    ? identity.email || identity.hubDomain || (identity.hubId ? `HubSpot · ${identity.hubId}` : "HubSpot connecté")
    : "HubSpot local";

  return (
    <main className="app-bg min-h-screen pl-[72px] lg:pl-[216px]">
      <div className="animate-fade-in fixed inset-y-0 left-0 z-20">
        <AppSidebar email={accountLabel} />
      </div>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
