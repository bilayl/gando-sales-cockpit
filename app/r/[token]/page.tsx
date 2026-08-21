import { PublicSDRoomV5 } from "@/components/public-sd-room-v5";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSDRoomV5 token={token} />;
}
