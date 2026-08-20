import { PublicSDRoomV2 } from "@/components/public-sd-room-v2";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSDRoomV2 token={token} />;
}
