"use client";

import { PublicSDRoomV4 } from "@/components/public-sd-room-v4";

export function PublicSDRoomV3({ token }: { token: string }) {
  return <div className="[&>main>section:first-child]:!rounded-none"><PublicSDRoomV4 token={token} /></div>;
}
