import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function DealRoomLayout({ children }: { children: ReactNode }) {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessDealRoom) redirect("/?access=deal-room-denied");

  return <main className="min-h-screen bg-background">{children}</main>;
}
