import { PublicSDRoomV6 } from "@/components/public-sd-room-v6";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSDRoomV6 token={token} />;
}
