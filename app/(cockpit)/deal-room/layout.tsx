import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCockpitAccess } from "@/lib/cockpit-access";

export default async function DealRoomLayout({ children }: { children: ReactNode }) {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessDealRoom) redirect("/prospection?access=deal-room-denied");
  return children;
}
