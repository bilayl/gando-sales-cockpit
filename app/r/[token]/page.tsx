import { PublicSDRoomV3 } from "@/components/public-sd-room-v3";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSDRoomV3 token={token} />;
}
