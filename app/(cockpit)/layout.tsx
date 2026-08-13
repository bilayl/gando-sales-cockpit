import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { getHubSpotIdentity, isHubSpotAuthenticated } from "@/lib/hubspot";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  if (!(await isHubSpotAuthenticated())) redirect("/login");
  const identity = await getHubSpotIdentity();
  const accountLabel = identity?.mode === "oauth" && identity.hubId ? `HubSpot · ${identity.hubId}` : "HubSpot connecté";
  return (
    <main className="app-bg flex min-h-screen gap-3 p-3 pl-[248px]">
      <div className="animate-fade-in fixed left-3 top-3 bottom-3 z-10">
        <AppSidebar email={accountLabel} />
      </div>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
