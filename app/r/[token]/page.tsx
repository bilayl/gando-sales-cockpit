import { PublicQuickDealRoom } from "@/components/public-quick-deal-room";
import { PublicSDRoomV7 } from "@/components/public-sd-room-v7";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: room } = await getSupabaseAdmin()
    .from("deal_rooms")
    .select("room_mode")
    .eq("share_token", token)
    .maybeSingle();

  return room?.room_mode === "standard" ? <PublicQuickDealRoom token={token} /> : <PublicSDRoomV7 token={token} />;
}
