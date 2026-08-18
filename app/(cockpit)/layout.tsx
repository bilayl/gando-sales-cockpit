import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { getHubSpotIdentity, isAuthBypassEnabled, isHubSpotAuthenticated } from "@/lib/hubspot";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const bypass = isAuthBypassEnabled();

  if (!bypass && !(await isHubSpotAuthenticated())) redirect("/login");

  const identity = bypass ? null : await getHubSpotIdentity();
  const accountLabel = bypass
    ? "Mode test · HubSpot"
    : identity?.mode === "oauth"
      ? identity.email || identity.hubDomain || (identity.hubId ? `HubSpot · ${identity.hubId}` : "HubSpot connecté")
      : "HubSpot connecté";

  return (
    <main className="app-bg min-h-screen pl-[72px] lg:pl-[216px]">
      <div className="animate-fade-in fixed inset-y-0 left-0 z-20">
        <AppSidebar email={accountLabel} />
      </div>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
